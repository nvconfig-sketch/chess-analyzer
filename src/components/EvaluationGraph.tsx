"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CLASSIFICATION_META } from "@/lib/classify";
import { formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import type { AnalyzedMove, MoveClassification } from "@/lib/types";

type Props = {
  analyzed: AnalyzedMove[];
  currentPly: number;
  onSelect: (ply: number) => void;
};

const BADGE_COLORS: Record<MoveClassification, { fill: string; text: string; symbol: string }> = {
  brilliant: { fill: "#67e8f9", text: "#164e63", symbol: "✦" },
  great: { fill: "#6ee7b7", text: "#064e3b", symbol: "↗" },
  best: { fill: "#22c55e", text: "#ffffff", symbol: "★" },
  excellent: { fill: "#bef264", text: "#365314", symbol: "✓" },
  good: { fill: "#bbf7d0", text: "#14532d", symbol: "+" },
  book: { fill: "#7dd3fc", text: "#0c4a6e", symbol: "B" },
  inaccuracy: { fill: "#fde047", text: "#713f12", symbol: "!" },
  mistake: { fill: "#fdba74", text: "#7c2d12", symbol: "?" },
  poor: { fill: "#f97316", text: "#ffffff", symbol: "−" },
  blunder: { fill: "#e11d48", text: "#ffffff", symbol: "×" },
  forced: { fill: "#d4d4d8", text: "#27272a", symbol: "=" },
};

const HEBREW_CLASSIFICATIONS: Record<MoveClassification, string> = {
  brilliant: "מבריק",
  great: "מציאה מצוינת",
  best: "הטוב ביותר",
  excellent: "מצוין",
  good: "טוב",
  book: "תיאוריה",
  inaccuracy: "אי-דיוק",
  mistake: "טעות",
  poor: "חלש",
  blunder: "טעות חמורה",
  forced: "כפוי",
};

const HEIGHT = 360;
const LEFT = 38;
const RIGHT = 12;
const TOP = 18;
const BOTTOM = 36;
export function EvaluationGraph({ analyzed, currentPly, onSelect }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(360);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setChartWidth(Math.max(1, Math.floor(entry.contentRect.width)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (analyzed.length === 0) return null;

  const width = chartWidth;
  const plotWidth = Math.max(1, width - LEFT - RIGHT);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const step = plotWidth / analyzed.length;
  const points = analyzed.map((move, index) => {
    const whiteCp = whiteCpFromFen(move.afterFen, move.evalAfter);
    const pawns = whiteCp === null ? null : whiteCp / 100;
    const boundedPawns = pawns === null ? null : Math.max(-10, Math.min(10, pawns));
    const x = LEFT + step * (index + 0.5);
    const y =
      boundedPawns === null
        ? TOP + plotHeight / 2
        : TOP + ((10 - boundedPawns) / 20) * plotHeight;

    return { move, whiteCp, pawns, x, y };
  });
  const lineSegments = points.slice(1).flatMap((point, index) => {
    const previous = points[index];
    if (point.pawns === null || previous.pawns === null) return [];
    return [`${previous.x},${previous.y} ${point.x},${point.y}`];
  });
  const tickValues = [10, 5, 0, -5, -10];

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Evaluation graph / עקומת הערכה
        </h2>
        <span className="text-[11px] text-zinc-500">
          White advantage / יתרון ללבן
        </span>
      </div>
      <div ref={chartRef} className="mt-2 w-full min-w-0">
        <svg
          className="block h-auto w-full touch-pan-y"
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="group"
          aria-label="Evaluation by move / הערכת העמדה לפי מסע"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
            if (pointerX < LEFT || pointerX > LEFT + plotWidth) return;

            const nearestPoint = points.reduce((nearest, point) =>
              Math.abs(point.x - pointerX) < Math.abs(nearest.x - pointerX) ? point : nearest,
            );
            onSelect(nearestPoint.move.ply);
          }}
        >
          {tickValues.map((tick) => {
            const y = TOP + ((10 - tick) / 20) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={LEFT}
                  x2={LEFT + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? "#71717a" : "#a1a1aa"}
                  strokeOpacity={tick === 0 ? 0.72 : 0.22}
                  strokeDasharray={tick === 0 ? undefined : "3 5"}
                />
                <text
                  x={LEFT - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500"
                  fontSize="10"
                >
                  {tick > 0 ? `+${tick}` : tick}
                </text>
              </g>
            );
          })}

          {lineSegments.map((segment, index) => (
            <polyline
              key={index}
              points={segment}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {points.map(({ move, whiteCp, x, y }) => {
            const badge = BADGE_COLORS[move.classification];
            const meta = CLASSIFICATION_META[move.classification];
            const moveNumber = Math.ceil(move.ply / 2);
            const moveNotation = `${moveNumber}${move.ply % 2 ? "." : "..."} ${move.san}`;
            const scoreText =
              whiteCp === null
                ? "Evaluation unavailable / הערכה לא זמינה"
                : Math.abs(whiteCp) >= 90_000
                  ? `${formatWhiteCp(whiteCp)} (mate / מט)`
                  : `${formatWhiteCp(whiteCp)} pawns / רגלים`;
            const tooltip = `${moveNotation} · ${meta.label} / ${HEBREW_CLASSIFICATIONS[move.classification]} · ${scoreText}`;
            const selected = currentPly === move.ply;
            const markerRadius = Math.min(9, step * 0.42);
            const hitRadius = Math.min(13, step * 0.48);

            return (
              <g
                key={move.ply}
                role="button"
                tabIndex={0}
                aria-label={`${tooltip}. Go to move / מעבר למסע`}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(move.ply);
                }}
                onKeyDown={(event: KeyboardEvent<SVGGElement>) =>
                  activateOnKeyboard(event, () => onSelect(move.ply))
                }
              >
                <title>{tooltip}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={hitRadius}
                  fill="transparent"
                  stroke={selected ? "#10b981" : "transparent"}
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={markerRadius}
                  fill={badge.fill}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={y + markerRadius * 0.35}
                  textAnchor="middle"
                  fontSize={Math.min(9, markerRadius * 0.95)}
                  fontWeight="800"
                  fill={badge.text}
                  pointerEvents="none"
                >
                  {markerRadius >= 5 ? badge.symbol : ""}
                </text>
              </g>
            );
          })}

          <text
            x={13}
            y={TOP + plotHeight / 2}
            textAnchor="middle"
            className="fill-zinc-500"
            fontSize="9"
            transform={`rotate(-90 13 ${TOP + plotHeight / 2})`}
          >
            Pawns / רגלים
          </text>
          <line x1={LEFT} x2={LEFT} y1={TOP} y2={TOP + plotHeight} stroke="#a1a1aa" strokeOpacity="0.55" />
          <line
            x1={LEFT}
            x2={LEFT + plotWidth}
            y1={TOP + plotHeight}
            y2={TOP + plotHeight}
            stroke="#a1a1aa"
            strokeOpacity="0.55"
          />
        </svg>
      </div>
    </section>
  );
}

function activateOnKeyboard(event: KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}