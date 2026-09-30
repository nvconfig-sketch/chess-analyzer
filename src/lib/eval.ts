import type { EngineScore, PlayerColor } from "./types";

const MATE_CP = 100_000;

export function scoreToWhiteCp(score: EngineScore, sideToMove: PlayerColor): number {
  const raw =
    score.kind === "mate"
      ? score.value === 0
        ? 0
        : Math.sign(score.value) * (MATE_CP - Math.min(Math.abs(score.value), 99) * 100)
      : score.value;
  return sideToMove === "w" ? raw : -raw;
}

export function whiteCpForPlayer(whiteCp: number, player: PlayerColor): number {
  return player === "w" ? whiteCp : -whiteCp;
}

export function formatScore(score: EngineScore | null, forWhite = true): string {
  if (!score) return "—";
  if (score.kind === "mate") {
    const mate = forWhite ? score.value : -score.value;
    if (mate === 0) return "M0";
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  const cp = forWhite ? score.value : -score.value;
  const pawns = cp / 100;
  const formatted = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${formatted}`;
  if (pawns < -0.005) return `-${formatted}`;
  return "0.00";
}

export function formatWhiteCp(whiteCp: number | null): string {
  if (whiteCp === null || Number.isNaN(whiteCp)) return "—";
  if (Math.abs(whiteCp) >= MATE_CP - 10_000) {
    const ply = Math.round((MATE_CP - Math.abs(whiteCp)) / 100);
    return whiteCp > 0 ? `M${Math.max(ply, 1)}` : `-M${Math.max(ply, 1)}`;
  }
  const pawns = whiteCp / 100;
  const formatted = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${formatted}`;
  if (pawns < -0.005) return `-${formatted}`;
  return "0.00";
}

export function evalBarPercent(whiteCp: number | null): number {
  if (whiteCp === null) return 50;
  const clamped = Math.max(-1500, Math.min(1500, whiteCp));
  return 50 + 50 * Math.tanh(clamped / 420);
}

export function whiteCpFromFen(fen: string, score: EngineScore | null): number | null {
  if (!score) return null;
  const side: PlayerColor = fen.split(" ")[1] === "b" ? "b" : "w";
  return scoreToWhiteCp(score, side);
}

export function parseUciScore(kind: string, value: string): EngineScore | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (kind === "mate") return { kind: "mate", value: n };
  if (kind === "cp") return { kind: "cp", value: n };
  return null;
}
