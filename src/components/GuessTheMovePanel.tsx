"use client";

import { CLASSIFICATION_META } from "@/lib/classify";
import type { useGuessTheMove } from "@/hooks/useGuessTheMove";

type Training = ReturnType<typeof useGuessTheMove>;

type Props = {
  training: Training;
  engineReady: boolean;
  totalMoves: number;
};

export function GuessTheMovePanel({ training, engineReady, totalMoves }: Props) {
  if (!training.active) {
    return (
      <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Guess the Move / נחשו את המסע
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Find Stockfish&apos;s best move at each position before it is revealed.
            </p>
          </div>
          <button
            type="button"
            onClick={training.start}
            disabled={!engineReady || totalMoves === 0}
            className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600"
          >
            Start training
          </button>
        </div>
        {!engineReady ? (
          <p className="mt-2 text-xs text-zinc-500">Waiting for Stockfish…</p>
        ) : null}
        {training.error ? (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {training.error}
          </p>
        ) : null}
      </section>
    );
  }

  const meta = training.feedback
    ? training.feedback.engineFallback
      ? null
      : CLASSIFICATION_META[training.feedback.classification]
    : null;

  return (
    <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Guess the Move / נחשו את המסע
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Position {Math.min(training.ply + 1, totalMoves)} / {totalMoves} · Find the engine&apos;s best move
          </p>
        </div>
        <button
          type="button"
          onClick={training.stop}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Exit training
        </button>
      </div>

      {training.checking ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300" role="status">
          Checking your move… / בודקים את המסע…
        </p>
      ) : null}
      {training.error ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {training.error}
        </p>
      ) : null}

      {training.feedback ? (
        <div className="mt-3 border-t border-emerald-200 pt-3 dark:border-emerald-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-bold ${training.feedback.correct ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
              {training.feedback.correct ? "Correct! / נכון!" : "Not the engine's top choice / לא הבחירה המובילה של המנוע"}
            </p>
            {meta ? (
              <span className={`text-sm font-semibold ${meta.color}`}>
                {meta.glyph} {meta.label}
              </span>
            ) : null}
          </div>
          {training.feedback.engineFallback ? (
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
              Stockfish timed out or failed. Your legal move was accepted; moving to the next position shortly.
              <span className="mt-1 block" lang="he" dir="rtl">
                Stockfish התעכב או נכשל. המסע החוקי התקבל; עוברים בקרוב לעמדה הבאה.
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            {training.feedback.engineFallback ? (
              "Engine evaluation unavailable; this legal guess was accepted."
            ) : (
              <>
                Best move: <strong>{training.feedback.bestMove}</strong>
                {training.feedback.evalLossCp === null
                  ? ""
                  : ` · Eval loss ${Math.max(0, training.feedback.evalLossCp / 100).toFixed(2)} pawns`}
              </>
            )}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase text-zinc-500">Coach note / הערת מאמן</h3>
            <div className="inline-flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700" role="group" aria-label="Feedback language">
              {(["en", "he"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => training.setLanguage(language)}
                  aria-pressed={training.language === language}
                  className={`min-h-9 min-w-10 rounded px-2 text-xs font-semibold ${training.language === language ? "bg-emerald-600 text-white" : "text-zinc-600 dark:text-zinc-300"}`}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200" lang={training.language} dir={training.language === "he" ? "rtl" : "ltr"}>
            {training.feedback.explanation[training.language]}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {training.feedback.source === "ai" ? "AI coach / מאמן AI" : "Engine coach / מאמן מנוע"}
          </p>
          {training.feedback.correct ? (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">
              Next position in a moment… / העמדה הבאה תוצג בעוד רגע…
            </p>
          ) : null}
          <button
            type="button"
            onClick={training.next}
            className="mt-3 min-h-11 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
          >
            {training.ply + 1 >= totalMoves ? "Finish training / סיום אימון" : "Next position / העמדה הבאה"}
          </button>
        </div>
      ) : !training.checking ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Make your move on the board. The game&apos;s next move stays hidden until you guess.
        </p>
      ) : null}
    </section>
  );
}
