"use client";

import { useEffect, useState } from "react";
import { identifyOpening } from "@/lib/opening-book";
import type { GameMove, OpeningContext } from "@/lib/types";

type LookupState = {
  moves: GameMove[];
  startFen: string;
  opening: OpeningContext;
};

export function useOpening(moves: GameMove[], startFen: string) {
  const [lookupState, setLookupState] = useState<LookupState | null>(null);

  useEffect(() => {
    if (moves.length === 0) return;

    let active = true;
    void identifyOpening(moves, startFen).then((opening) => {
      if (active) setLookupState({ moves, startFen, opening });
    });

    return () => {
      active = false;
    };
  }, [moves, startFen]);

  if (moves.length === 0) return null;
  if (lookupState?.moves === moves && lookupState.startFen === startFen) {
    return lookupState.opening;
  }

  return {
    status: "loading",
    eco: null,
    nameEn: null,
    nameHe: null,
    deviationPly: null,
    deviationMove: null,
    isFirstDeviationMove: false,
  } satisfies OpeningContext;
}