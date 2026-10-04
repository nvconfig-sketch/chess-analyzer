"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { useAiSettings } from "@/hooks/useAiSettings";
import { classifyMove } from "@/lib/classify";
import { requestClientExplanation } from "@/lib/client-explanation";
import { lanToSan, needsPromotion, toGameMove, tryMove } from "@/lib/game";
import { localExplanation } from "@/lib/local-explanation";
import { formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import type { AnalyzedMove, BilingualExplanation, LoadedGame, MoveClassification } from "@/lib/types";
import type { EngineAnalysis } from "@/lib/stockfish-engine";

export type GuessFeedback = {
  correct: boolean;
  guessedMove: string;
  bestMove: string;
  classification: MoveClassification;
  evalLossCp: number | null;
  guessedFrom: string;
  guessedTo: string;
  explanation: BilingualExplanation;
  source: "ai" | "local";
  bestMoveUci: string | null;
};

type Props = {
  game: LoadedGame;
  initialPly: number;
  analyzed: AnalyzedMove[] | null;
  analyzePosition: (fen: string, depth?: number) => Promise<EngineAnalysis>;
};

export function useGuessTheMove({ game, initialPly, analyzed, analyzePosition }: Props) {
  const aiSettings = useAiSettings();
  const requestController = useRef<AbortController | null>(null);
  const [active, setActive] = useState(false);
  const [ply, setPly] = useState(0);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<GuessFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [language, setLanguage] = useState<"en" | "he">("en");

  const positionFen = useMemo(() => {
    if (!active) return null;
    return ply === 0 ? game.startFen : game.moves[ply - 1]?.afterFen ?? game.startFen;
  }, [active, game, ply]);

  const start = useCallback(() => {
    if (game.moves.length === 0) {
      setError("Load a game with moves before starting training.");
      return;
    }
    setPly(Math.min(initialPly, game.moves.length - 1));
    setFeedback(null);
    setError(null);
    setActive(true);
  }, [game.moves.length, initialPly]);

  const stop = useCallback(() => {
    requestController.current?.abort();
    requestController.current = null;
    setActive(false);
    setChecking(false);
    setFeedback(null);
    setError(null);
    setPendingPromotion(null);
  }, []);

  const submitGuess = useCallback(async (from: string, to: string, promotion?: string) => {
    if (!active || checking || feedback || !positionFen) return;

    const played = tryMove(positionFen, from, to, promotion);
    if (!played) {
      setError("That move is not legal in this position.");
      return;
    }

    setChecking(true);
    setError(null);
    setPendingPromotion(null);
    const controller = new AbortController();
    requestController.current?.abort();
    requestController.current = controller;
    try {
      const preAnalysis = analyzed?.[ply]?.bestMove
        ? {
            bestMove: analyzed[ply].bestMove,
            score: analyzed[ply].evalBefore,
            pv: analyzed[ply].pv,
            depth: 0,
          }
        : await analyzePosition(positionFen);
      const postAnalysis = await analyzePosition(played.after);
      if (controller.signal.aborted) return;
      const move = toGameMove(played, ply);
      const correct = normalizeUci(move.lan) === normalizeUci(preAnalysis.bestMove ?? "");
      const { classification, evalLossCp } = classifyMove({
        move,
        evalBefore: preAnalysis.score,
        evalAfter: postAnalysis.score,
        bestMove: preAnalysis.bestMove,
        plyIndex: ply,
      });
      const bestMoveSan = lanToSan(positionFen, preAnalysis.bestMove);
      const payload = {
        fen: positionFen,
        moveSan: move.san,
        moveLan: move.lan,
        bestMove: preAnalysis.bestMove,
        bestMoveSan,
        classification,
        evalBefore: formatWhiteCp(whiteCpFromFen(positionFen, preAnalysis.score)),
        evalAfter: formatWhiteCp(whiteCpFromFen(played.after, postAnalysis.score)),
        evalDelta: evalLossCp === null ? "unknown" : `${(evalLossCp / 100).toFixed(2)} pawns`,
        side: move.color === "w" ? "White" as const : "Black" as const,
        opening: null,
      };
      let explanation: BilingualExplanation;
      let source: "ai" | "local" = "local";
      const apiKey = aiSettings.apiKeys[aiSettings.provider].trim();

      if (apiKey) {
        try {
          explanation = await requestClientExplanation(
            aiSettings.provider,
            apiKey,
            payload,
            controller.signal,
          );
          source = "ai";
        } catch {
          if (controller.signal.aborted) return;
          explanation = localExplanation(payload);
        }
      } else {
        explanation = localExplanation(payload);
      }

      setFeedback({
        correct,
        guessedMove: move.san,
        bestMove: bestMoveSan ?? preAnalysis.bestMove ?? "unknown",
        classification,
        evalLossCp,
        guessedFrom: move.from,
        guessedTo: move.to,
        explanation,
        source,
        bestMoveUci: preAnalysis.bestMove,
      });
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error && cause.message.toLowerCase().includes("timed out")
            ? "Stockfish took too long to evaluate this position. Your guess was not submitted; please try again."
            : cause instanceof Error
              ? cause.message
              : "Could not check that move. Please try again.",
        );
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setChecking(false);
      }
    }
  }, [active, aiSettings, analyzed, analyzePosition, checking, feedback, ply, positionFen]);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare || !positionFen || feedback || checking) return false;
    if (needsPromotion(positionFen, sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }
    void submitGuess(sourceSquare, targetSquare);
    return false;
  }, [checking, feedback, positionFen, submitGuess]);

  const next = useCallback(() => {
    setFeedback(null);
    setError(null);
    setPly((current) => {
      if (current + 1 >= game.moves.length) {
        setActive(false);
        return current;
      }
      return current + 1;
    });
  }, [game.moves.length]);

  const targetMove = active ? game.moves[ply] ?? null : null;
  const currentAnalysis = active ? analyzed?.[ply] ?? null : null;

  return {
    active,
    ply,
    targetMove,
    positionFen,
    currentAnalysis,
    checking,
    feedback,
    error,
    pendingPromotion,
    language,
    setLanguage,
    start,
    stop,
    next,
    onPieceDrop,
    applyPromotion: (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion) return;
      void submitGuess(pendingPromotion.from, pendingPromotion.to, piece);
    },
    cancelPromotion: () => setPendingPromotion(null),
  };
}

function normalizeUci(uci: string): string {
  return uci.toLowerCase().trim();
}
