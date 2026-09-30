import type { EngineScore, GameMove, MoveClassification, PlayerColor } from "./types";
import { scoreToWhiteCp, whiteCpForPlayer } from "./eval";

export type ClassificationInput = {
  move: GameMove;
  evalBefore: EngineScore | null;
  evalAfter: EngineScore | null;
  bestMove: string | null;
  plyIndex: number;
};

export function classifyMove({
  move,
  evalBefore,
  evalAfter,
  bestMove,
  plyIndex,
}: ClassificationInput): {
  classification: MoveClassification;
  evalLossCp: number | null;
} {
  if (!evalBefore || !evalAfter) {
    return { classification: plyIndex < 8 ? "book" : "good", evalLossCp: null };
  }

  const beforeWhite = scoreToWhiteCp(evalBefore, move.color);
  const afterWhite = scoreToWhiteCp(evalAfter, opposite(move.color));
  const beforePlayer = whiteCpForPlayer(beforeWhite, move.color);
  const afterPlayer = whiteCpForPlayer(afterWhite, move.color);
  const evalLossCp = Math.max(0, Math.round(beforePlayer - afterPlayer));

  const matchesBest = Boolean(bestMove && bestMove === move.lan);
  const isBook = plyIndex < 8 && evalLossCp < 40;

  if (isForced(evalBefore)) {
    return { classification: "forced", evalLossCp };
  }

  if (isBook && (matchesBest || evalLossCp < 25)) {
    return { classification: "book", evalLossCp };
  }

  if (matchesBest && isSacrifice(move) && afterPlayer >= beforePlayer - 30) {
    return { classification: "brilliant", evalLossCp };
  }

  if (matchesBest && evalLossCp <= 8 && Math.abs(beforePlayer) < 150 && afterPlayer >= 180) {
    return { classification: "great", evalLossCp };
  }

  if (matchesBest || evalLossCp <= 12) {
    return { classification: "best", evalLossCp };
  }
  if (evalLossCp <= 35) return { classification: "excellent", evalLossCp };
  if (evalLossCp <= 80) return { classification: "good", evalLossCp };
  if (evalLossCp <= 150) return { classification: "inaccuracy", evalLossCp };
  if (evalLossCp <= 300) return { classification: "mistake", evalLossCp };
  if (evalLossCp <= 500) return { classification: "poor", evalLossCp };
  return { classification: "blunder", evalLossCp };
}

function opposite(color: PlayerColor): PlayerColor {
  return color === "w" ? "b" : "w";
}

function isForced(evalBefore: EngineScore): boolean {
  return evalBefore.kind === "mate" && Math.abs(evalBefore.value) <= 1;
}

function isSacrifice(move: GameMove): boolean {
  if (!move.captured) return false;
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const given = values[move.captured] ?? 0;
  return given >= 3;
}

export const CLASSIFICATION_META: Record<
  MoveClassification,
  { label: string; glyph: string; color: string }
> = {
  brilliant: { label: "Brilliant", glyph: "!!", color: "text-cyan-300" },
  great: { label: "Great move", glyph: "!", color: "text-emerald-300" },
  best: { label: "Best", glyph: "★", color: "text-emerald-400" },
  excellent: { label: "Excellent", glyph: "", color: "text-lime-400" },
  good: { label: "Good", glyph: "", color: "text-green-400" },
  book: { label: "Book", glyph: "📖", color: "text-sky-400" },
  inaccuracy: { label: "Inaccuracy", glyph: "?!", color: "text-yellow-300" },
  mistake: { label: "Mistake", glyph: "?", color: "text-orange-400" },
  poor: { label: "Poor", glyph: "−", color: "text-orange-500" },
  blunder: { label: "Blunder", glyph: "??", color: "text-rose-400" },
  forced: { label: "Forced", glyph: "", color: "text-zinc-400" },
};
