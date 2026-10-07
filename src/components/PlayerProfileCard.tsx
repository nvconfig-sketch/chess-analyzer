"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregatePlayerProfileMetrics,
  generatePlayerProfile,
  type PlayerPersonalityProfile,
} from "@/lib/player-profile";
import type { AnalyzedMove, GameHeaders } from "@/lib/types";

type Props = {
  analyzed: AnalyzedMove[];
  headers: GameHeaders;
};

export function PlayerProfileCard({ analyzed, headers }: Props) {
  const controllerRef = useRef<AbortController | null>(null);
  const [profile, setProfile] = useState<PlayerPersonalityProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const metrics = aggregatePlayerProfileMetrics(analyzed, headers, "w");

  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const result = await generatePlayerProfile(metrics, controller.signal);
      if (!controller.signal.aborted) setProfile(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not generate the player profile.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4 shadow-sm dark:border-violet-900/70 dark:from-violet-950/40 dark:via-zinc-900 dark:to-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
            White player profile
          </p>
          <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {metrics.playerName}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || metrics.playerMoves === 0}
          className="min-h-11 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {loading ? "Building profile…" : profile ? "Regenerate profile" : "Generate personality profile"}
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Based on {metrics.playerMoves} White moves across {metrics.totalPlies} plies. One game is only a snapshot of playing style.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      {profile ? (
        <div className="mt-4 border-t border-violet-200 pt-4 dark:border-violet-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{profile.archetype}</h3>
            <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
              GM style match · {profile.grandmasterMatch}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{profile.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProfileList title="Strengths" items={profile.strengths} />
            <ProfileList title="Areas to improve" items={profile.areasToImprove} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProfileList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-200">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
