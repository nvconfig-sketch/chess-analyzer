"use client";

import { useMemo, useState } from "react";
import { SAMPLE_PGN } from "@/lib/sample-pgn";

type Props = {
  onLoadPgn: (pgn: string) => void;
  onLoadFen: (fen: string) => void;
  error: string | null;
};

export function GameImport({ onLoadPgn, onLoadFen, error }: Props) {
  const [pgn, setPgn] = useState(SAMPLE_PGN.trim());
  const [fen, setFen] = useState("");

  const hint = useMemo(
    () => "Paste a PGN, upload a .pgn file, or load a FEN to jump to a position.",
    [],
  );

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
        Import game
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>

      <textarea
        value={pgn}
        onChange={(event) => setPgn(event.target.value)}
        spellCheck={false}
        className="mt-3 h-28 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        placeholder="Paste PGN here"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLoadPgn(pgn)}
          className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Load PGN
        </button>
        <label className="flex min-h-11 cursor-pointer items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Upload .pgn
          <input
            type="file"
            accept=".pgn,text/plain"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setPgn(text);
              onLoadPgn(text);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setPgn(SAMPLE_PGN.trim());
            onLoadPgn(SAMPLE_PGN);
          }}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Sample game
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={fen}
          onChange={(event) => setFen(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          placeholder="FEN string"
        />
        <button
          type="button"
          onClick={() => onLoadFen(fen)}
          className="min-h-11 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Load FEN
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-rose-500">{error}</p>
      ) : null}
    </section>
  );
}
