"use client";

import { Chess } from "chess.js";
import { CLASSIFICATION_META } from "@/lib/classify";
import { formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import type { AnalyzedMove, GameHeaders, OpeningContext } from "@/lib/types";
import type { LoadedGame } from "@/lib/types";
import { useExplanation } from "@/hooks/useExplanation";
import { GameReview } from "@/components/GameReview";
import { PlayerProfileCard } from "@/components/PlayerProfileCard";
import { createAnnotatedPgn } from "@/lib/export-pgn";
import { gameTitle } from "@/lib/game";
import { useState } from "react";

type Props = {
  move: AnalyzedMove | null;
  game: LoadedGame;
  currentMoveIndex: number;
  selectedFen: string;
  totalMoves: number;
  analyzing: boolean;
  progress: { done: number; total: number };
  engineReady: boolean;
  engineError: string | null;
  onAnalyze: () => void;
  liveBest: string | null;
  liveEval: string;
  opening: OpeningContext | null;
  analyzed: AnalyzedMove[] | null;
  mistakeMoves: AnalyzedMove[];
  onTrainMistakes?: () => void;
  gameHeaders: GameHeaders;
  gameAnalysisComplete: boolean;
};

export function AnalysisPanel({
  move,
  game,
  currentMoveIndex,
  selectedFen,
  totalMoves,
  analyzing,
  progress,
  engineReady,
  engineError,
  onAnalyze,
  liveBest,
  liveEval,
  opening,
  analyzed,
  mistakeMoves,
  onTrainMistakes,
  gameHeaders,
  gameAnalysisComplete,
}: Props) {
  const [exportError, setExportError] = useState<string | null>(null);
  const selectedMove =
    currentMoveIndex > 0
      ? analyzed?.[currentMoveIndex - 1] ??
        (move?.ply === currentMoveIndex ? move : null)
      : null;
  const selectedPosition = new Chess(selectedFen);
  const atGameEnd = currentMoveIndex >= totalMoves;
  const recordedResult = atGameEnd
    ? gameHeaders.Result
    : undefined;
  const hasRecordedResult = recordedResult === "1-0" ||
    recordedResult === "0-1" ||
    recordedResult === "1/2-1/2";
  const checkmate = selectedPosition.isCheckmate() ||
    (atGameEnd && selectedMove?.san.includes("#") === true);
  const gameOver = checkmate || selectedPosition.isGameOver() || hasRecordedResult;
  const gameOverText = checkmate
    ? "Checkmate."
    : recordedResult === "1/2-1/2" || selectedPosition.isDraw()
      ? "Game over — draw."
      : recordedResult === "1-0"
        ? "Game over — White wins."
        : recordedResult === "0-1"
          ? "Game over — Black wins."
          : "Game over.";
  const gameOverTextHe = checkmate
    ? "מט."
    : gameOverText === "Game over — draw."
      ? "המשחק הסתיים בתיקו."
      : gameOverText === "Game over — White wins."
        ? "המשחק הסתיים בניצחון ללבן."
        : gameOverText === "Game over — Black wins."
          ? "המשחק הסתיים בניצחון לשחור."
          : "המשחק הסתיים.";
  const explanation = useExplanation(gameOver ? null : selectedMove, opening);
  const meta = selectedMove ? CLASSIFICATION_META[selectedMove.classification] : null;

  const exportAnnotatedPgn = () => {
    if (!analyzed) return;
    try {
      const explanations =
        selectedMove && explanation.bilingual
          ? { [selectedMove.ply]: explanation.bilingual }
          : {};
      const pgn = createAnnotatedPgn(game, analyzed, explanations);
      const url = URL.createObjectURL(new Blob([pgn], { type: "application/x-chess-pgn;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${gameTitle(game.headers)
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-|-$/g, "") || "chess-game"}-analysis.pgn`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError(null);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Could not export annotated PGN.");
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Engine analysis
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Stockfish 19 lite runs in your browser (WASM). Depth 12 for the full game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gameAnalysisComplete && analyzed ? (
            <button
              type="button"
              onClick={exportAnnotatedPgn}
              className="min-h-11 shrink-0 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
            >
              Export Annotated PGN / הורד PGN מוער
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!engineReady || analyzing}
            className="min-h-11 shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : "Analyze game"}
          </button>
        </div>
      </div>

      {exportError ? <p className="text-sm text-rose-500" role="alert">{exportError}</p> : null}
      {engineError ? <p className="text-sm text-rose-500">{engineError}</p> : null}
      {!engineReady && !engineError ? (
        <p className="text-sm text-zinc-500">Loading Stockfish…</p>
      ) : null}

      {analyzing ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {progress.done} / {progress.total} moves
          </p>
        </div>
      ) : null}

      {gameAnalysisComplete && analyzed ? (
        <>
          <PlayerProfileCard
            key={`${gameHeaders.White ?? "White"}:${analyzed.length}:${analyzed.at(-1)?.afterFen ?? ""}`}
            analyzed={analyzed}
            headers={gameHeaders}
          />
          <GameReview
            analyzed={analyzed}
            headers={gameHeaders}
            mistakeMoves={mistakeMoves}
            onTrainMistakes={onTrainMistakes}
          />
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Live eval (White)" value={liveEval} />
        <Stat label="Best move" value={liveBest ?? "—"} />
      </div>

      {opening ? (
        <div
          className="border-l-2 border-emerald-500 pl-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase text-zinc-500">
              Opening / פתיחה
            </p>
            {opening.eco ? (
              <span className="font-mono text-[11px] text-zinc-400">{opening.eco}</span>
            ) : null}
          </div>
          {opening.status === "loading" ? (
            <p className="mt-1 text-sm text-zinc-500">Checking theory / בודקים תיאוריה…</p>
          ) : opening.status === "unavailable" ? (
            <p className="mt-1 text-sm text-zinc-500">
              Opening not identified / הפתיחה לא זוהתה
            </p>
          ) : opening.nameEn ? (
            <>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100" lang="en" dir="ltr">
                  {opening.nameEn}
                </p>
                {opening.eco ? (
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ECO {opening.eco}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300" lang="he" dir="rtl">
                {opening.nameHe}
              </p>
            </>
          ) : null}
          {opening.status === "out-of-book" ? (
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {opening.isFirstDeviationMove
                ? "Out of Book / מחוץ לתיאוריה"
                : "Open game / משחק פתוח"}
              {opening.isFirstDeviationMove && opening.deviationPly && opening.deviationMove
                ? ` · ${Math.ceil(opening.deviationPly / 2)}${opening.deviationPly % 2 ? "." : "..."} ${opening.deviationMove}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedMove && meta ? (
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              {selectedMove.color === "w" ? "White" : "Black"} played {selectedMove.san}
            </p>
            <span className={`text-sm font-semibold ${meta.color}`}>
              {meta.glyph} {meta.label}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Eval loss {selectedMove.evalLossCp === null ? "—" : `${(selectedMove.evalLossCp / 100).toFixed(2)} pawns`}
            {selectedMove.bestMoveSan ? ` · Engine: ${selectedMove.bestMoveSan}` : ""}
            {` · After: ${formatWhiteCp(whiteCpFromFen(selectedMove.afterFen, selectedMove.evalAfter))}`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Step through the game, then run analysis to tag inaccuracies, mistakes, and blunders.
        </p>
      )}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {gameOver ? "Checkmate / Game Over" : "Verbal explanation"}
          </h3>
          <div
            className="inline-flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700"
            role="group"
            aria-label="Explanation language"
          >
            {(["en", "he"] as const).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => explanation.setLanguage(language)}
                aria-pressed={explanation.language === language}
                className={`min-h-11 min-w-11 rounded px-2 py-2 text-xs font-semibold ${
                  explanation.language === language
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {gameOver ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <span lang="en" dir="ltr">{gameOverText}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span lang="he" dir="rtl">{gameOverTextHe}</span>
          </p>
        ) : explanation.loading ? (
          <p className="mt-2 text-sm text-zinc-500">Writing a coach note…</p>
        ) : explanation.error ? (
          <p className="mt-2 text-sm text-rose-500">{explanation.error}</p>
        ) : explanation.text ? (
          <p
            className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            dir={explanation.language === "he" ? "rtl" : "ltr"}
            lang={explanation.language}
          >
            {explanation.text}
            {explanation.source === "local" ? (
              <span className="mt-2 block text-xs text-zinc-400" dir="auto">
                {explanation.language === "he"
                  ? "הערת הדרכה מקומית. הוסיפו מפתח ספק בהגדרות AI להסברים מותאמים אישית."
                  : "Local coach note. Add a provider key in AI settings for personalized explanations."}
              </span>
            ) : (
              <span className="mt-2 block text-xs text-zinc-400" dir="auto">
                {explanation.language === "he"
                  ? `נוצר באמצעות ${explanation.source === "openai" ? "OpenAI" : "Gemini"}.`
                  : `Generated with ${explanation.source === "openai" ? "OpenAI" : "Gemini"}.`}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Analyze the game and select a move to hear why it worked or failed.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-950">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
