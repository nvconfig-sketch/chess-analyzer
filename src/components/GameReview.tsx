"use client";

import { useRef, useState } from "react";
import { useAiSettings } from "@/hooks/useAiSettings";
import { generateGameReview, aggregateGameReviewStats } from "@/lib/game-review";
import type { AnalyzedMove, BilingualExplanation, GameHeaders } from "@/lib/types";

type Props = {
  analyzed: AnalyzedMove[];
  headers: GameHeaders;
};

export function GameReview({ analyzed, headers }: Props) {
  const settings = useAiSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [review, setReview] = useState<BilingualExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stats = aggregateGameReviewStats(analyzed);
  const apiKey = settings.apiKeys[settings.provider].trim();

  const generate = async () => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setReview(null);
    setError(null);
    setLoading(true);
    dialogRef.current?.showModal();

    try {
      const result = await generateGameReview(
        settings.provider,
        apiKey,
        headers,
        analyzed,
        controller.signal,
      );
      if (!controller.signal.aborted) setReview(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not generate the game review");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const close = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    dialogRef.current?.close();
  };

  return (
    <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Game review / סקירת משחק
          </h2>
          {!apiKey ? (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Add a provider key in AI settings to generate a review.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!apiKey || loading}
          className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Generate game review
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          controllerRef.current?.abort();
          setLoading(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        aria-labelledby="game-review-title"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Post-game report
              </p>
              <h2 id="game-review-title" className="mt-1 text-lg font-semibold">
                Game review / סקירת משחק
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="min-h-11 min-w-11 rounded-md text-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close game review"
            >
              ×
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <ReviewStat label="Analyzed plies" value={String(stats.totalMoves)} />
            <ReviewStat label="Blunders" value={String(stats.classifications.blunder)} />
            <ReviewStat label="Mistakes" value={String(stats.classifications.mistake)} />
            <ReviewStat label="Inaccuracies" value={String(stats.classifications.inaccuracy)} />
            <ReviewStat
              label="Average CPL"
              value={stats.averageCentipawnLoss === null ? "—" : String(stats.averageCentipawnLoss)}
            />
            <ReviewStat label="Accuracy" value="Not calculated" />
          </dl>

          {loading ? (
            <p className="mt-5 text-sm text-zinc-500" role="status">
              Reviewing the game… / מנתחים את המשחק…
            </p>
          ) : error ? (
            <p className="mt-5 text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : review ? (
            <div className="mt-5 space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200" lang="en" dir="ltr">
                {review.en}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200" lang="he" dir="rtl">
                {review.he}
              </p>
            </div>
          ) : null}

          <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
            Generated with {settings.provider === "gemini" ? "Google Gemini" : "OpenAI"} using your saved key.
          </p>
        </div>
      </dialog>
    </section>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/80 px-3 py-2 dark:bg-zinc-950/70">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}