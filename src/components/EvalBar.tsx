"use client";

import { evalBarPercent, formatWhiteCp } from "@/lib/eval";

type Props = {
  whiteCp: number | null;
  boardOrientation: "white" | "black";
};

export function EvalBar({ whiteCp, boardOrientation }: Props) {
  const perspectiveCp =
    boardOrientation === "white" || whiteCp === null ? whiteCp : -whiteCp;
  const whiteHeight = Math.max(2, Math.min(98, evalBarPercent(whiteCp)));
  const label = formatWhiteCp(perspectiveCp);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative h-[min(72vw,520px)] w-5 overflow-hidden rounded-full border border-zinc-300 bg-zinc-950 sm:w-6 dark:border-zinc-700 ${
          boardOrientation === "black" ? "rotate-180" : ""
        }`}
        title={label}
        aria-label={`Evaluation ${label}`}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-zinc-100 transition-[height] duration-300"
          style={{ height: `${whiteHeight}%` }}
        />
        <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-emerald-500/80" />
      </div>
      <span className="w-12 text-center font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
        {label}
      </span>
    </div>
  );
}
