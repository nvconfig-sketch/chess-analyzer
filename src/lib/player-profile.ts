import { Chess, type Square } from "chess.js";
import { whiteCpFromFen } from "@/lib/eval";
import type { AnalyzedMove, GameHeaders, PlayerColor } from "@/lib/types";

export type PlayerProfileMetrics = {
  playerName: string;
  color: PlayerColor;
  totalPlies: number;
  playerMoves: number;
  pawnMovePercent: number;
  pieceMovePercent: number;
  blunderCount: number;
  mistakeCount: number;
  inaccuracyCount: number;
  blunderRatePercent: number;
  averageEvalFluctuationPawns: number | null;
  castled: boolean;
  castlingMoveNumber: number | null;
  kingMovesBeforeCastling: number;
  classificationCounts: Record<string, number>;
};

export type PlayerPersonalityProfile = {
  archetype: string;
  grandmasterMatch: string;
  strengths: string[];
  areasToImprove: string[];
  summary: string;
};

export function aggregatePlayerProfileMetrics(
  analyzed: AnalyzedMove[],
  headers: GameHeaders,
  color: PlayerColor = "w",
): PlayerProfileMetrics {
  const playerMoves = analyzed.filter((move) => move.color === color);
  const pieceCounts = { pawn: 0, piece: 0 };
  const classificationCounts: Record<string, number> = {};
  const evals: number[] = [];
  let castlingPly: number | null = null;
  let kingMovesBeforeCastling = 0;

  for (const move of playerMoves) {
    const piece = isSquare(move.from) ? new Chess(move.beforeFen).get(move.from) : null;
    if (piece?.type === "p") pieceCounts.pawn += 1;
    else if (piece) pieceCounts.piece += 1;

    classificationCounts[move.classification] =
      (classificationCounts[move.classification] ?? 0) + 1;

    if (piece?.type === "k" && move.san !== "O-O" && move.san !== "O-O-O") {
      kingMovesBeforeCastling += 1;
    }
    if (castlingPly === null && (move.san === "O-O" || move.san === "O-O-O")) {
      castlingPly = move.ply;
    }

    function isSquare(square: string): square is Square {
      return /^[a-h][1-8]$/.test(square);
    }

    if (move.evalAfter?.kind === "cp") {
      const whiteCp = whiteCpFromFen(move.afterFen, move.evalAfter);
      if (whiteCp !== null) evals.push(color === "w" ? whiteCp : -whiteCp);
    }
  }

  const totalPlayerMoves = playerMoves.length;
  const percentage = (count: number) =>
    totalPlayerMoves === 0 ? 0 : Math.round((count / totalPlayerMoves) * 100);
  const blunderCount = classificationCounts.blunder ?? 0;
  const fluctuations = evals.slice(1).map((score, index) => Math.abs(score - evals[index]));

  return {
    playerName: headers[color === "w" ? "White" : "Black"] ?? (color === "w" ? "White" : "Black"),
    color,
    totalPlies: analyzed.length,
    playerMoves: totalPlayerMoves,
    pawnMovePercent: percentage(pieceCounts.pawn),
    pieceMovePercent: percentage(pieceCounts.piece),
    blunderCount,
    mistakeCount: classificationCounts.mistake ?? 0,
    inaccuracyCount: classificationCounts.inaccuracy ?? 0,
    blunderRatePercent: percentage(blunderCount),
    averageEvalFluctuationPawns: fluctuations.length
      ? Number((fluctuations.reduce((sum, value) => sum + value, 0) / fluctuations.length / 100).toFixed(2))
      : null,
    castled: castlingPly !== null,
    castlingMoveNumber: castlingPly === null ? null : Math.ceil(castlingPly / 2),
    kingMovesBeforeCastling,
    classificationCounts,
  };
}

export async function generatePlayerProfile(
  metrics: PlayerProfileMetrics,
  signal: AbortSignal,
): Promise<PlayerPersonalityProfile> {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics }),
    signal,
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? `Profile request failed (${response.status})`);
  }

  const result = (await response.json()) as { profile?: PlayerPersonalityProfile };
  if (!result.profile) throw new Error("The profile service returned no profile");
  return result.profile;
}

export function isPlayerPersonalityProfile(value: unknown): value is PlayerPersonalityProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.archetype === "string" &&
    Boolean(profile.archetype.trim()) &&
    typeof profile.grandmasterMatch === "string" &&
    Boolean(profile.grandmasterMatch.trim()) &&
    Array.isArray(profile.strengths) &&
    profile.strengths.length >= 2 &&
    profile.strengths.length <= 3 &&
    profile.strengths.every((item) => typeof item === "string" && item.trim()) &&
    Array.isArray(profile.areasToImprove) &&
    profile.areasToImprove.length === 2 &&
    profile.areasToImprove.every((item) => typeof item === "string" && item.trim()) &&
    typeof profile.summary === "string" &&
    Boolean(profile.summary.trim())
  );
}

export function isPlayerProfileMetrics(value: unknown): value is PlayerProfileMetrics {
  if (typeof value !== "object" || value === null) return false;
  const metrics = value as Record<string, unknown>;
  return (
    typeof metrics.playerName === "string" &&
    metrics.playerName.length <= 120 &&
    (metrics.color === "w" || metrics.color === "b") &&
    ["totalPlies", "playerMoves", "pawnMovePercent", "pieceMovePercent", "blunderCount", "mistakeCount", "inaccuracyCount", "blunderRatePercent"]
      .every((key) => typeof metrics[key] === "number" && Number.isFinite(metrics[key])) &&
    (metrics.averageEvalFluctuationPawns === null ||
      (typeof metrics.averageEvalFluctuationPawns === "number" &&
        Number.isFinite(metrics.averageEvalFluctuationPawns))) &&
    typeof metrics.castled === "boolean" &&
    (metrics.castlingMoveNumber === null || typeof metrics.castlingMoveNumber === "number") &&
    typeof metrics.kingMovesBeforeCastling === "number" &&
    Number.isFinite(metrics.kingMovesBeforeCastling) &&
    typeof metrics.classificationCounts === "object" &&
    metrics.classificationCounts !== null
  );
}
