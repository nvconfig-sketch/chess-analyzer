"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PieceDropHandlerArgs } from "react-chessboard";
import type { LoadedGame } from "@/lib/types";
import {
  appendMove,
  fenAtPly,
  needsPromotion,
  parseFen,
  parsePgn,
  tryMove,
} from "@/lib/game";
import { SAMPLE_PGN } from "@/lib/sample-pgn";

export function useChessGame() {
  const [game, setGame] = useState<LoadedGame>(() => parsePgn(SAMPLE_PGN));
  const [ply, setPly] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const fen = useMemo(() => fenAtPly(game, ply), [game, ply]);
  const currentMove = ply > 0 ? game.moves[ply - 1] : null;

  const loadPgn = useCallback((pgn: string) => {
    try {
      const loaded = parsePgn(pgn);
      setGame(loaded);
      setPly(0);
      setImportError(null);
      setPendingPromotion(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not parse PGN");
    }
  }, []);

  const loadFen = useCallback((fenString: string) => {
    try {
      const loaded = parseFen(fenString);
      setGame(loaded);
      setPly(0);
      setImportError(null);
      setPendingPromotion(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not parse FEN");
    }
  }, []);

  const go = useCallback(
    (nextPly: number) => {
      setPly(Math.max(0, Math.min(game.moves.length, nextPly)));
    },
    [game.moves.length],
  );

  const applyMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const played = tryMove(fen, from, to, promotion);
      if (!played) return false;
      const next = appendMove(game, ply, played);
      setGame(next);
      setPly(ply + 1);
      setPendingPromotion(null);
      return true;
    },
    [fen, game, ply],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      if (needsPromotion(fen, sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false;
      }
      return applyMove(sourceSquare, targetSquare);
    },
    [applyMove, fen],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(ply - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(ply + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        go(0);
      } else if (event.key === "End") {
        event.preventDefault();
        go(game.moves.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.moves.length, go, ply]);

  return {
    game,
    ply,
    fen,
    currentMove,
    importError,
    pendingPromotion,
    loadPgn,
    loadFen,
    go,
    onPieceDrop,
    applyMove,
    cancelPromotion: () => setPendingPromotion(null),
  };
}
