"use client";

import { CLASSIFICATION_META } from "@/lib/classify";
import type { AnalyzedMove, GameMove } from "@/lib/types";

type Props = {
  moves: GameMove[];
  analyzed: AnalyzedMove[] | null;
  ply: number;
  onSelect: (ply: number) => void;
};

export function MoveList({ moves, analyzed, ply, onSelect }: Props) {
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Move history</h2>
      <ol className="mt-3 max-h-72 overflow-auto font-mono text-sm">
        {pairs.map((pair) => (
          <li key={pair.number} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 py-0.5">
            <span className="text-zinc-400">{pair.number}.</span>
            <MoveCell
              move={pair.white}
              analysis={analyzed?.[pair.white.ply - 1]}
              active={ply === pair.white.ply}
              onClick={() => onSelect(pair.white.ply)}
            />
            {pair.black ? (
              <MoveCell
                move={pair.black}
                analysis={analyzed?.[pair.black.ply - 1]}
                active={ply === pair.black.ply}
                onClick={() => onSelect(pair.black.ply)}
              />
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function MoveCell({
  move,
  analysis,
  active,
  onClick,
}: {
  move: GameMove;
  analysis?: AnalyzedMove;
  active: boolean;
  onClick: () => void;
}) {
  const meta = analysis ? CLASSIFICATION_META[analysis.classification] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md px-1.5 py-2 text-left text-sm sm:px-2 ${
        active
          ? "bg-emerald-600 text-white"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      <span>{move.san}</span>
      {meta && !active ? (
        <span className={`ml-1 text-[10px] ${meta.color}`}>{meta.glyph || meta.label[0]}</span>
      ) : null}
    </button>
  );
}
