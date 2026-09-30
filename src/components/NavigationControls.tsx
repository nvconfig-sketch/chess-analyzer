"use client";

type Props = {
  ply: number;
  total: number;
  onGo: (ply: number) => void;
};

export function NavigationControls({ ply, total, onGo }: Props) {
  const btn =
    "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 enabled:hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:enabled:hover:bg-zinc-800";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={ply <= 0} onClick={() => onGo(0)}>
          First
        </button>
        <button type="button" className={btn} disabled={ply <= 0} onClick={() => onGo(ply - 1)}>
          Previous
        </button>
        <button type="button" className={btn} disabled={ply >= total} onClick={() => onGo(ply + 1)}>
          Next
        </button>
        <button type="button" className={btn} disabled={ply >= total} onClick={() => onGo(total)}>
          Last
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Move {ply === 0 ? 0 : Math.ceil(ply / 2)} / {Math.ceil(total / 2)} · arrows to step
      </p>
    </div>
  );
}
