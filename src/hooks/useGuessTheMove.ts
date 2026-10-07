"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  engineFallback: boolean;
  explanation: BilingualExplanation;
  source: "ai" | "local";
  bestMoveUci: string | null;
};

export type MistakeDrillSummary = {
  total: number;
  correct: number;
  accuracy: number;
  takeaways: string[];
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
  const advanceTimer = useRef<number | null>(null);
  const correctionTimer = useRef<number | null>(null);
  const replayTimer = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [active, setActive] = useState(false);
  const [mistakeMode, setMistakeMode] = useState(false);
  const [mistakeSequence, setMistakeSequence] = useState<number[]>([]);
  const [mistakeProgress, setMistakeProgress] = useState(0);
  const [replayFen, setReplayFen] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [correctionFen, setCorrectionFen] = useState<string | null>(null);
  const [correctionExecuted, setCorrectionExecuted] = useState(false);
  const [mistakeResults, setMistakeResults] = useState<boolean[]>([]);
  const [mistakeSummary, setMistakeSummary] = useState<MistakeDrillSummary | null>(null);
  const [ply, setPly] = useState(0);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<GuessFeedback | null>(null);
  const [guessedFen, setGuessedFen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [language, setLanguage] = useState<"en" | "he">("en");

  const positionFen = useMemo(() => {
    if (!active) return null;
    if (guessedFen) return guessedFen;
    return ply === 0 ? game.startFen : game.moves[ply - 1]?.afterFen ?? game.startFen;
  }, [active, game, guessedFen, ply]);

  const startMistakeReplay = useCallback((targetPly: number) => {
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    replayTimer.current = null;

    const replayStartPly = Math.max(0, targetPly - 3);
    const replayMoves = game.moves.slice(replayStartPly, targetPly);
    if (replayMoves.length === 0) {
      setReplayFen(null);
      setReplaying(false);
      return;
    }

    const startFen = replayStartPly === 0
      ? game.startFen
      : game.moves[replayStartPly - 1]?.afterFen ?? game.startFen;
    let frame = 0;
    setReplayFen(startFen);
    setReplaying(true);

    const advanceReplay = () => {
      if (frame >= replayMoves.length) {
        replayTimer.current = null;
        setReplayFen(null);
        setReplaying(false);
        return;
      }

      setReplayFen(replayMoves[frame].afterFen);
      frame += 1;
      replayTimer.current = window.setTimeout(advanceReplay, 650);
    };

    replayTimer.current = window.setTimeout(advanceReplay, 650);
  }, [game.moves, game.startFen]);

  useEffect(() => () => {
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    if (correctionTimer.current !== null) window.clearTimeout(correctionTimer.current);
    if (audioContext.current && audioContext.current.state !== "closed") {
      void audioContext.current.close();
    }
  }, []);

  const playMoveSound = useCallback(() => {
    if (typeof window === "undefined" || !window.AudioContext) return;

    const context = audioContext.current ?? new window.AudioContext();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }, []);

  const summarizeMistakeDrill = useCallback((results: boolean[]): MistakeDrillSummary => {
    const total = results.length;
    const correct = results.filter(Boolean).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const takeaways =
      accuracy >= 70
        ? [
            "Strong tactical awareness on the key moments.",
            "Keep spotting the critical defensive resource before moving on.",
          ]
        : accuracy >= 40
          ? [
              "Good instincts, but a few positions still needed calmer evaluation.",
              "Try to look for the opponent's most forcing move before choosing a plan.",
            ]
          : [
              "The critical mistakes are recurring in high-pressure spots.",
              "Slow down and calculate checks, captures, and the opponent's counterplay before committing.",
            ];

    return { total, correct, accuracy, takeaways };
  }, []);

  const start = useCallback(() => {
    if (game.moves.length === 0) {
      setError("Load a game with moves before starting training.");
      return;
    }
    if (correctionTimer.current !== null) window.clearTimeout(correctionTimer.current);
    correctionTimer.current = null;
    setMistakeMode(false);
    setMistakeSequence([]);
    setMistakeProgress(0);
    setMistakeResults([]);
    setMistakeSummary(null);
    setReplayFen(null);
    setReplaying(false);
    setCorrectionFen(null);
    setCorrectionExecuted(false);
    setPly(Math.min(initialPly, game.moves.length - 1));
    setFeedback(null);
    setGuessedFen(null);
    setError(null);
    setActive(true);
  }, [game.moves.length, initialPly]);

  const startMistakes = useCallback((moveIndices: number[]) => {
    const sanitized = [...new Set(moveIndices)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < game.moves.length)
      .sort((left, right) => left - right);

    if (sanitized.length === 0) {
      setError("No mistake positions were found in this game.");
      return;
    }

    if (correctionTimer.current !== null) window.clearTimeout(correctionTimer.current);
    correctionTimer.current = null;
    setMistakeMode(true);
    setMistakeSequence(sanitized);
    setMistakeProgress(0);
    setMistakeResults([]);
    setMistakeSummary(null);
    setCorrectionFen(null);
    setCorrectionExecuted(false);
    setPly(sanitized[0]);
    setFeedback(null);
    setGuessedFen(null);
    setError(null);
    setActive(true);
    startMistakeReplay(sanitized[0]);
  }, [game.moves.length, startMistakeReplay]);

  const stop = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    replayTimer.current = null;
    requestController.current?.abort();
    requestController.current = null;
    setActive(false);
    setMistakeMode(false);
    setMistakeSequence([]);
    setMistakeProgress(0);
    setReplayFen(null);
    setReplaying(false);
    setCorrectionFen(null);
    setCorrectionExecuted(false);
    setMistakeResults([]);
    setMistakeSummary(null);
    setChecking(false);
    setFeedback(null);
    setGuessedFen(null);
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
    setGuessedFen(played.after);
    const controller = new AbortController();
    requestController.current?.abort();
    requestController.current = controller;
    try {
      let preAnalysis: EngineAnalysis | null = analyzed?.[ply]?.bestMove
        ? {
            bestMove: analyzed[ply].bestMove,
            score: analyzed[ply].evalBefore,
            pv: analyzed[ply].pv,
            depth: 0,
          }
        : null;
      let postAnalysis: EngineAnalysis | null = null;
      let engineFallback = false;
      if (!preAnalysis) {
        try {
          preAnalysis = await analyzePosition(positionFen);
          if (!preAnalysis.bestMove) throw new Error("Stockfish did not return a best move");
          postAnalysis = await analyzePosition(played.after);
        } catch {
          if (controller.signal.aborted) return;
          engineFallback = true;
          preAnalysis = null;
          postAnalysis = null;
        }
      } else {
        try {
          postAnalysis = await analyzePosition(played.after);
        } catch {
          if (controller.signal.aborted) return;
          engineFallback = true;
          preAnalysis = null;
          postAnalysis = null;
        }
      }
      if (controller.signal.aborted) return;

      const move = toGameMove(played, ply);
      const correct = engineFallback || normalizeUci(move.lan) === normalizeUci(preAnalysis?.bestMove ?? "");
      const { classification, evalLossCp } = engineFallback
        ? { classification: "good" as const, evalLossCp: null }
        : classifyMove({
            move,
            evalBefore: preAnalysis?.score ?? null,
            evalAfter: postAnalysis?.score ?? null,
            bestMove: preAnalysis?.bestMove ?? null,
            plyIndex: ply,
          });
      const bestMoveSan = engineFallback ? null : lanToSan(positionFen, preAnalysis?.bestMove ?? null);
      const payload = {
        fen: positionFen,
        moveSan: move.san,
        moveLan: move.lan,
        bestMove: preAnalysis?.bestMove ?? null,
        bestMoveSan,
        classification,
        evalBefore: formatWhiteCp(whiteCpFromFen(positionFen, preAnalysis?.score ?? null)),
        evalAfter: formatWhiteCp(whiteCpFromFen(played.after, postAnalysis?.score ?? null)),
        evalDelta: evalLossCp === null ? "unknown" : `${(evalLossCp / 100).toFixed(2)} pawns`,
        side: move.color === "w" ? "White" as const : "Black" as const,
        opening: null,
      };
      let explanation: BilingualExplanation;
      let source: "ai" | "local" = "local";
      const apiKey = aiSettings.apiKeys[aiSettings.provider].trim();

      if (engineFallback) {
        explanation = {
          en: "Stockfish was unavailable, so your legal move was accepted. Training will continue to the next position.",
          he: "Stockfish אינו זמין כרגע, ולכן המסע החוקי שלך התקבל. האימון ימשיך לעמדה הבאה.",
        };
      } else if (apiKey) {
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

      setGuessedFen(null);
      setFeedback({
        correct,
        guessedMove: move.san,
        bestMove: bestMoveSan ?? preAnalysis?.bestMove ?? "Engine unavailable",
        classification,
        evalLossCp,
        guessedFrom: move.from,
        guessedTo: move.to,
        engineFallback,
        explanation,
        source,
        bestMoveUci: preAnalysis?.bestMove ?? null,
      });
      if (active && mistakeMode) {
        setMistakeResults((current) => [...current, correct]);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setGuessedFen(null);
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
  }, [active, aiSettings, analyzed, analyzePosition, checking, feedback, mistakeMode, ply, positionFen]);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare || !positionFen || checking || replaying || correctionExecuted) return false;

    if (feedback) {
      if (feedback.correct || !feedback.bestMoveUci) return false;
      const expected = normalizeUci(feedback.bestMoveUci);
      if (!expected.startsWith(`${sourceSquare}${targetSquare}`)) return false;
      if (needsPromotion(positionFen, sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false;
      }
      const played = tryMove(positionFen, sourceSquare, targetSquare);
      if (!played || normalizeUci(played.lan) !== expected) return false;
      setCorrectionFen(played.after);
      setCorrectionExecuted(true);
      setError(null);
      playMoveSound();
      return true;
    }

    if (needsPromotion(positionFen, sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }
    if (!tryMove(positionFen, sourceSquare, targetSquare)) {
      setError("That move is not legal in this position.");
      return false;
    }
    void submitGuess(sourceSquare, targetSquare);
    return true;
  }, [checking, correctionExecuted, feedback, playMoveSound, positionFen, replaying, submitGuess]);

  const canDragPiece = useCallback((square: string | null) => {
    if (
      !square ||
      !active ||
      checking ||
      replaying ||
      pendingPromotion ||
      correctionExecuted ||
      feedback?.correct
    ) {
      return false;
    }
    if (feedback) {
      return Boolean(feedback.bestMoveUci && normalizeUci(feedback.bestMoveUci).startsWith(square));
    }
    return true;
  }, [active, checking, correctionExecuted, feedback, pendingPromotion, replaying]);

  const next = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (correctionTimer.current !== null) window.clearTimeout(correctionTimer.current);
    correctionTimer.current = null;
    setFeedback(null);
    setError(null);
    setCorrectionFen(null);
    setCorrectionExecuted(false);

    if (mistakeMode && mistakeSequence.length > 0) {
      const nextProgress = mistakeProgress + 1;
      if (nextProgress >= mistakeSequence.length) {
        if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
        replayTimer.current = null;
        const summary = summarizeMistakeDrill(mistakeResults);
        setMistakeSummary(summary);
        setActive(false);
        setMistakeMode(false);
        setMistakeProgress(0);
        setMistakeResults([]);
        setReplayFen(null);
        setReplaying(false);
        setGuessedFen(null);
        return;
      }
      setMistakeProgress(nextProgress);
      setPly(mistakeSequence[nextProgress]);
      startMistakeReplay(mistakeSequence[nextProgress]);
      return;
    }

    if (ply + 1 >= game.moves.length) {
      setActive(false);
      setGuessedFen(null);
      return;
    }
    setPly(ply + 1);
  }, [game.moves.length, mistakeMode, mistakeProgress, mistakeResults, mistakeSequence, ply, startMistakeReplay, summarizeMistakeDrill]);

  useEffect(() => {
    if (!correctionExecuted) return;

    correctionTimer.current = window.setTimeout(next, 800);
    return () => {
      if (correctionTimer.current !== null) window.clearTimeout(correctionTimer.current);
      correctionTimer.current = null;
    };
  }, [correctionExecuted, next]);

  useEffect(() => {
    if (!active || !feedback?.correct) return;

    advanceTimer.current = window.setTimeout(next, 2200);
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    };
  }, [active, feedback, next]);

  const targetMove = active ? game.moves[ply] ?? null : null;
  const currentAnalysis = active ? analyzed?.[ply] ?? null : null;

  return {
    active,
    mistakeMode,
    mistakeSequence,
    mistakeProgress,
    ply,
    targetMove,
    positionFen,
    correctionFen,
    correctionExecuted,
    replayFen,
    replaying,
    replayMistake: () => startMistakeReplay(ply),
    replayMoveCount: Math.min(3, ply),
    currentAnalysis,
    checking,
    feedback,
    error,
    pendingPromotion,
    language,
    mistakeSummary,
    setLanguage,
    start,
    startMistakes,
    stop,
    next,
    onPieceDrop,
    canDragPiece,
    applyPromotion: (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion || !positionFen) return;
      if (feedback && !feedback.correct && feedback.bestMoveUci) {
        const expected = normalizeUci(feedback.bestMoveUci);
        const played = tryMove(positionFen, pendingPromotion.from, pendingPromotion.to, piece);
        if (!played || normalizeUci(played.lan) !== expected) {
          setPendingPromotion(null);
          return;
        }
        setCorrectionFen(played.after);
        setCorrectionExecuted(true);
        setError(null);
        setPendingPromotion(null);
        playMoveSound();
        return;
      }
      void submitGuess(pendingPromotion.from, pendingPromotion.to, piece);
    },
    cancelPromotion: () => setPendingPromotion(null),
  };
}

function normalizeUci(uci: string): string {
  return uci.toLowerCase().trim();
}
