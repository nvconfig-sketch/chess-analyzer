"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { EvalBar } from "@/components/EvalBar";
import { EvaluationGraph } from "@/components/EvaluationGraph";
import { GameImport } from "@/components/GameImport";
import { MoveList } from "@/components/MoveList";
import { NavigationControls } from "@/components/NavigationControls";
import { PromotionDialog } from "@/components/PromotionDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useChessGame } from "@/hooks/useChessGame";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { useOpening } from "@/hooks/useOpening";
import { useTheme } from "@/hooks/useTheme";
import { evalBarPercent, formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import { gameTitle } from "@/lib/game";
import type { MoveClassification } from "@/lib/types";

const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { symbol: string; label: string; labelHe: string; style: string }
> = {
  brilliant: { symbol: "✦", label: "BRILLIANT", labelHe: "מבריק", style: "bg-cyan-300 text-cyan-950" },
  great: { symbol: "↗", label: "GREAT FIND", labelHe: "מהלך מצוין", style: "bg-emerald-300 text-emerald-950" },
  best: { symbol: "★", label: "BEST", labelHe: "הטוב ביותר", style: "bg-green-500 text-white" },
  excellent: { symbol: "✓", label: "EXCELLENT", labelHe: "מצוין", style: "bg-lime-300 text-lime-950" },
  good: { symbol: "+", label: "GOOD", labelHe: "טוב", style: "bg-green-200 text-green-950" },
  inaccuracy: { symbol: "!", label: "INACCURACY", labelHe: "אי-דיוק", style: "bg-yellow-300 text-yellow-950" },
  mistake: { symbol: "?", label: "MISTAKE", labelHe: "טעות", style: "bg-orange-300 text-orange-950" },
  poor: { symbol: "−", label: "POOR", labelHe: "חלש", style: "bg-orange-500 text-white" },
  blunder: { symbol: "×", label: "BLUNDER", labelHe: "טעות חמורה", style: "bg-rose-600 text-white" },
  book: { symbol: "B", label: "BOOK", labelHe: "תיאוריה", style: "bg-sky-300 text-sky-950" },
  forced: { symbol: "=", label: "FORCED", labelHe: "כפוי", style: "bg-zinc-300 text-zinc-900" },
};

const Chessboard = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard),
  { ssr: false, loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" /> },
);

export function ChessAnalyzer() {
  const { theme, toggleTheme } = useTheme();
  const gameState = useChessGame();
  const analysis = useGameAnalysis();

  const currentAnalysis =
    gameState.ply > 0 ? (analysis.analyzed?.[gameState.ply - 1] ?? null) : null;
  const openingMoves = useMemo(
    () => gameState.game.moves.slice(0, gameState.ply),
    [gameState.game.moves, gameState.ply],
  );
  const opening = useOpening(openingMoves, gameState.game.startFen);

  const whiteCp = useMemo(() => {
    if (currentAnalysis?.evalAfter) {
      return whiteCpFromFen(currentAnalysis.afterFen, currentAnalysis.evalAfter);
    }
    if (analysis.liveEval?.evalAfter) {
      return whiteCpFromFen(gameState.fen, analysis.liveEval.evalAfter);
    }
    return null;
  }, [analysis.liveEval, currentAnalysis, gameState.fen]);

  useEffect(() => {
    if (!analysis.analyzing) {
      void analysis.analyzeLive(gameState.fen);
    }
    // Intentionally re-run when the displayed position changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.fen, analysis.analyzing, analysis.engineReady]);

  const lastMove = gameState.currentMove;
  const squareStyles = lastMove
    ? {
        [lastMove.from]: { backgroundColor: "rgba(16, 185, 129, 0.35)" },
        [lastMove.to]: { backgroundColor: "rgba(16, 185, 129, 0.55)" },
      }
    : undefined;

  const best = currentAnalysis?.bestMove ?? analysis.liveEval?.bestMove;
  const arrows = best
    ? [
        {
          startSquare: best.slice(0, 2),
          endSquare: best.slice(2, 4),
          color: "rgba(16, 185, 129, 0.75)",
        },
      ]
    : [];

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900 dark:bg-[#0b0f14] dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Chess Analyzer
            </p>
            <h1 className="text-lg font-semibold">{gameTitle(gameState.game.headers)}</h1>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        <section className="flex flex-col gap-4">
          <div className="relative flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <EvalBar percent={evalBarPercent(whiteCp)} label={formatWhiteCp(whiteCp)} />
            <div className="relative min-w-0 flex-1">
              <Chessboard
                options={{
                  position: gameState.fen,
                  boardOrientation: "white",
                  onPieceDrop: gameState.onPieceDrop,
                  squareStyles,
                  squareRenderer: ({ children, square }) => {
                    const badge =
                      currentAnalysis && square === currentAnalysis.to
                        ? CLASSIFICATION_BADGES[currentAnalysis.classification]
                        : null;

                    if (!badge) return <>{children}</>;

                    return (
                      <div className="relative h-full w-full">
                        {children}
                        <span
                          className={`pointer-events-none absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold leading-none shadow ring-1 ring-white/90 dark:ring-zinc-950/90 ${badge.style}`}
                          role="img"
                          aria-label={`${badge.label} / ${badge.labelHe}`}
                          title={`${badge.label} / ${badge.labelHe}`}
                        >
                          {badge.symbol}
                        </span>
                      </div>
                    );
                  },
                  arrows,
                  allowDrawingArrows: true,
                  animationDurationInMs: 180,
                  boardStyle: {
                    borderRadius: "12px",
                    overflow: "hidden",
                    width: "100%",
                  },
                  darkSquareStyle: { backgroundColor: theme === "dark" ? "#3d5a4c" : "#769656" },
                  lightSquareStyle: { backgroundColor: theme === "dark" ? "#c5d5c0" : "#eeeed2" },
                }}
              />
              {gameState.pendingPromotion ? (
                <PromotionDialog
                  from={gameState.pendingPromotion.from}
                  to={gameState.pendingPromotion.to}
                  color={gameState.fen.split(" ")[1] === "b" ? "b" : "w"}
                  onChoose={(piece) =>
                    gameState.applyMove(
                      gameState.pendingPromotion!.from,
                      gameState.pendingPromotion!.to,
                      piece,
                    )
                  }
                  onCancel={gameState.cancelPromotion}
                />
              ) : null}
            </div>
          </div>
          <NavigationControls
            ply={gameState.ply}
            total={gameState.game.moves.length}
            onGo={gameState.go}
          />
          {analysis.analyzed && analysis.analyzed.length > 0 ? (
            <EvaluationGraph
              analyzed={analysis.analyzed}
              currentPly={gameState.ply}
              onSelect={gameState.go}
            />
          ) : null}
          <MoveList
            moves={gameState.game.moves}
            analyzed={analysis.analyzed}
            ply={gameState.ply}
            onSelect={gameState.go}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <GameImport
            onLoadPgn={(pgn) => {
              gameState.loadPgn(pgn);
              analysis.resetAnalysis();
            }}
            onLoadFen={(fen) => {
              gameState.loadFen(fen);
              analysis.resetAnalysis();
            }}
            error={gameState.importError}
          />
          <AnalysisPanel
            move={currentAnalysis}
            analyzing={analysis.analyzing}
            progress={analysis.progress}
            engineReady={analysis.engineReady}
            engineError={analysis.engineError}
            onAnalyze={() => void analysis.analyzeGame(gameState.game)}
            liveBest={
              currentAnalysis?.bestMoveSan ??
              analysis.liveEval?.bestMoveSan ??
              analysis.liveEval?.bestMove ??
              null
            }
            liveEval={formatWhiteCp(whiteCp)}
            opening={opening}
          />
        </aside>
      </main>
    </div>
  );
}
