"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AiSettings } from "@/components/AiSettings";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { GameExport } from "@/components/GameExport";
import { EvalBar } from "@/components/EvalBar";
import { EvaluationGraph } from "@/components/EvaluationGraph";
import { GameImport } from "@/components/GameImport";
import { GuessTheMovePanel } from "@/components/GuessTheMovePanel";
import { MoveList } from "@/components/MoveList";
import { NavigationControls } from "@/components/NavigationControls";
import { PromotionDialog } from "@/components/PromotionDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useChessGame } from "@/hooks/useChessGame";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { useGuessTheMove } from "@/hooks/useGuessTheMove";
import { useOpening } from "@/hooks/useOpening";
import { useTheme } from "@/hooks/useTheme";
import { CLASSIFICATION_BADGES } from "@/lib/classification-badges";
import { evalBarPercent, formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import { gameTitle } from "@/lib/game";
import { calculateHeatmap, squareControlCss } from "@/lib/heatmap";

const Chessboard = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard),
  { ssr: false, loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" /> },
);

export function ChessAnalyzer() {
  const { theme, toggleTheme } = useTheme();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const gameState = useChessGame();
  const analysis = useGameAnalysis();
  const training = useGuessTheMove({
    game: gameState.game,
    initialPly: gameState.ply,
    analyzed: analysis.analyzed,
    analyzePosition: analysis.analyzePosition,
  });

  const currentAnalysis =
    gameState.ply > 0 ? (analysis.analyzed?.[gameState.ply - 1] ?? null) : null;
  const openingMoves = useMemo(
    () => gameState.game.moves.slice(0, gameState.ply),
    [gameState.game.moves, gameState.ply],
  );
  const opening = useOpening(openingMoves, gameState.game.startFen, gameState.game.headers);

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
  const boardFen = training.active
    ? training.replayFen ?? training.correctionFen ?? training.positionFen ?? gameState.fen
    : gameState.fen;
  const replayedMove = training.replaying
    ? gameState.game.moves.find((move) => move.afterFen === training.replayFen)
    : null;
  const trainingLastMove = training.correctionExecuted && training.feedback?.bestMoveUci
    ? {
        from: training.feedback.bestMoveUci.slice(0, 2),
        to: training.feedback.bestMoveUci.slice(2, 4),
      }
    : replayedMove ?? (
        training.feedback
          ? { from: training.feedback.guessedFrom, to: training.feedback.guessedTo }
          : training.ply > 0
            ? gameState.game.moves[training.ply - 1]
            : null
      );
  const displayedLastMove = training.active ? trainingLastMove : lastMove;
  const squareControls = useMemo(
    () => showHeatmap ? calculateHeatmap(boardFen, "w") : null,
    [boardFen, showHeatmap],
  );
  const lastMoveSquareNames = displayedLastMove
    ? [displayedLastMove.from, displayedLastMove.to]
    : [];
  const lastMoveSquares = displayedLastMove
    ? {
        [displayedLastMove.from]: showHeatmap
          ? { boxShadow: "inset 0 0 0 4px rgba(250, 204, 21, 0.95)" }
          : { backgroundColor: "#facc15", opacity: 0.75, zIndex: 10 },
        [displayedLastMove.to]: showHeatmap
          ? { boxShadow: "inset 0 0 0 4px rgba(250, 204, 21, 0.95)" }
          : { backgroundColor: "#facc15", opacity: 0.75, zIndex: 10 },
      }
    : undefined;
  const heatmapStyles = squareControls
    ? Object.fromEntries(
        Object.entries(squareControls)
          .filter(([, control]) => control.style.backgroundColor)
          .map(([square, control]) => [
            square,
            {
              ...control.style,
              boxShadow: "inset 0 0 0 2px rgba(0, 0, 0, 0.15)",
              borderRadius: "4px",
            },
          ]),
      )
    : {};
  const boardSquareStyles = { ...heatmapStyles, ...lastMoveSquares };
  const boardOverlayCss = squareControls
    ? squareControlCss(squareControls, lastMoveSquareNames)
    : lastMoveSquareNames
        .map(
          (square) =>
            `.analysis-board [data-square="${square}"] { background-color: rgba(250, 204, 21, 0.75) !important; }`,
        )
        .join("\n");

  const best = training.active
    ? training.feedback?.bestMoveUci ?? null
    : currentAnalysis?.bestMove ?? analysis.liveEval?.bestMove;
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Chess Analyzer
            </p>
            <h1 className="break-words text-lg font-semibold">{gameTitle(gameState.game.headers)}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AiSettings />
            {!analysis.analyzing &&
            gameState.game.moves.length > 0 &&
            analysis.analyzed?.length === gameState.game.moves.length ? (
              <GameExport
                game={gameState.game}
                analyzed={analysis.analyzed}
                theme={theme}
              />
            ) : null}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 md:flex-row">
        <section className="flex min-w-0 w-full flex-col gap-4 md:flex-1">
          <div className="relative flex min-w-0 items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/80 p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <EvalBar percent={evalBarPercent(whiteCp)} label={formatWhiteCp(whiteCp)} />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHeatmap((visible) => !visible)}
                  aria-pressed={showHeatmap}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    showHeatmap
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span
                    className={`relative h-4 w-7 rounded-full transition-colors ${showHeatmap ? "bg-emerald-300" : "bg-zinc-300 dark:bg-zinc-600"}`}
                    aria-hidden="true"
                  >
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${showHeatmap ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </span>
                  Threat Heatmap / מפת איומים
                </button>
              </div>
              <div className="analysis-board relative aspect-square w-full">
                {boardOverlayCss ? <style>{boardOverlayCss}</style> : null}
                <Chessboard
                  options={{
                    position: boardFen,
                    boardOrientation: "white",
                    onPieceDrop: training.active ? training.onPieceDrop : gameState.onPieceDrop,
                    canDragPiece: training.active
                      ? ({ square }) => training.canDragPiece(square)
                      : undefined,
                    squareStyles: boardSquareStyles,
                    squareRenderer: ({ children, square }) => {
                      const badge =
                        !training.active && currentAnalysis && square === currentAnalysis.to
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
                    animationDurationInMs: training.replaying ? 450 : 180,
                    boardStyle: {
                      borderRadius: "12px",
                      overflow: "hidden",
                      width: "100%",
                      aspectRatio: "1 / 1",
                    },
                    darkSquareStyle: { backgroundColor: theme === "dark" ? "#3d5a4c" : "#769656" },
                    lightSquareStyle: { backgroundColor: theme === "dark" ? "#c5d5c0" : "#eeeed2" },
                  }}
                />
              </div>
              {gameState.pendingPromotion ? (
                <PromotionDialog
                  from={gameState.pendingPromotion.from}
                  to={gameState.pendingPromotion.to}
                  color={boardFen.split(" ")[1] === "b" ? "b" : "w"}
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
              {training.pendingPromotion ? (
                <PromotionDialog
                  from={training.pendingPromotion.from}
                  to={training.pendingPromotion.to}
                  color={boardFen.split(" ")[1] === "b" ? "b" : "w"}
                  onChoose={training.applyPromotion}
                  onCancel={training.cancelPromotion}
                />
              ) : null}
            </div>
          </div>
          <GuessTheMovePanel
            training={training}
            engineReady={analysis.engineReady}
            totalMoves={training.mistakeMode ? training.mistakeSequence.length : gameState.game.moves.length}
          />
          {!training.active ? (
            <>
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
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 w-full flex-col gap-4 md:w-[22rem] md:flex-none lg:w-[26rem]">
          <GameImport
            onLoadPgn={(pgn) => {
              training.stop();
              gameState.loadPgn(pgn);
              analysis.resetAnalysis();
            }}
            onLoadFen={(fen) => {
              training.stop();
              gameState.loadFen(fen);
              analysis.resetAnalysis();
            }}
            error={gameState.importError}
          />
          <AnalysisPanel
            move={currentAnalysis}
            currentMoveIndex={gameState.ply}
            selectedFen={gameState.fen}
            totalMoves={gameState.game.moves.length}
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
            analyzed={analysis.analyzed}
            mistakeMoves={analysis.mistakeMoves}
            onTrainMistakes={() => {
              training.startMistakes(analysis.mistakeMoves.map((move) => move.ply - 1));
            }}
            gameHeaders={gameState.game.headers}
            gameAnalysisComplete={
              !analysis.analyzing &&
              analysis.analyzed?.length === gameState.game.moves.length &&
              gameState.game.moves.length > 0
            }
          />
        </aside>
      </main>
    </div>
  );
}
