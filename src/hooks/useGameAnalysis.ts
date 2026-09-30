"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzedMove, LoadedGame } from "@/lib/types";
import { classifyMove } from "@/lib/classify";
import { lanToSan } from "@/lib/game";
import { StockfishEngine } from "@/lib/stockfish-engine";

export function useGameAnalysis() {
  const engineRef = useRef<StockfishEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [analyzed, setAnalyzed] = useState<AnalyzedMove[] | null>(null);
  const [liveEval, setLiveEval] = useState<AnalyzedMove | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine
      .start()
      .then(() => setEngineReady(true))
      .catch((error: unknown) => {
        setEngineError(error instanceof Error ? error.message : "Failed to start Stockfish");
      });
    return () => {
      cancelled.current = true;
      engine.dispose();
    };
  }, []);

  const analyzeGame = useCallback(async (game: LoadedGame, depth = 12) => {
    const engine = engineRef.current;
    if (!engine) return;
    cancelled.current = false;
    setAnalyzing(true);
    setEngineError(null);
    setProgress({ done: 0, total: game.moves.length });

    const results: AnalyzedMove[] = [];
    try {
      for (let i = 0; i < game.moves.length; i += 1) {
        if (cancelled.current) break;
        const move = game.moves[i];
        const before = await engine.analyze(move.beforeFen, depth);
        const after = await engine.analyze(move.afterFen, depth);
        const { classification, evalLossCp } = classifyMove({
          move,
          evalBefore: before.score,
          evalAfter: after.score,
          bestMove: before.bestMove,
          plyIndex: i,
        });
        results.push({
          ...move,
          classification,
          evalBefore: before.score,
          evalAfter: after.score,
          bestMove: before.bestMove,
          bestMoveSan: lanToSan(move.beforeFen, before.bestMove),
          evalLossCp,
          pv: before.pv,
        });
        setProgress({ done: i + 1, total: game.moves.length });
        setAnalyzed([...results]);
      }
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const analyzeLive = useCallback(async (fen: string, depth = 14) => {
    const engine = engineRef.current;
    if (!engine || analyzing) return;
    try {
      const result = await engine.analyze(fen, depth);
      setLiveEval({
        ply: 0,
        san: "",
        lan: result.bestMove ?? "",
        from: result.bestMove?.slice(0, 2) ?? "",
        to: result.bestMove?.slice(2, 4) ?? "",
        color: fen.includes(" w ") ? "w" : "b",
        beforeFen: fen,
        afterFen: fen,
        classification: "best",
        evalBefore: result.score,
        evalAfter: result.score,
        bestMove: result.bestMove,
        bestMoveSan: lanToSan(fen, result.bestMove),
        evalLossCp: 0,
        pv: result.pv,
      });
    } catch {
      // Live eval is best-effort while a full game analysis is not running.
    }
  }, [analyzing]);

  return {
    engineReady,
    engineError,
    analyzing,
    progress,
    analyzed,
    liveEval,
    analyzeGame,
    analyzeLive,
    resetAnalysis: () => {
      setAnalyzed(null);
      setLiveEval(null);
      setProgress({ done: 0, total: 0 });
    },
  };
}
