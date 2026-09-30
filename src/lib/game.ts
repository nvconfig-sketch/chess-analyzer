import { Chess, type Move, type Square, validateFen } from "chess.js";
import type { GameHeaders, GameMove, LoadedGame } from "./types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parsePgn(pgn: string): LoadedGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const verbose = chess.history({ verbose: true });
  return {
    headers: chess.getHeaders(),
    startFen: verbose[0]?.before ?? chess.fen(),
    moves: verbose.map(toGameMove),
  };
}

export function parseFen(fen: string): LoadedGame {
  const trimmed = fen.trim();
  const result = validateFen(trimmed);
  if (!result.ok) {
    throw new Error(result.error ?? "Invalid FEN");
  }
  const chess = new Chess(trimmed);
  return {
    headers: { FEN: trimmed },
    startFen: chess.fen(),
    moves: [],
  };
}

export function fenAtPly(game: LoadedGame, ply: number): string {
  if (ply <= 0) return game.startFen;
  const move = game.moves[ply - 1];
  return move?.afterFen ?? game.startFen;
}

export function tryMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): Move | null {
  const chess = new Chess(fen);
  try {
    return chess.move({
      from: from as Square,
      to: to as Square,
      promotion: (promotion as "q" | "r" | "b" | "n") ?? "q",
    });
  } catch {
    return null;
  }
}

export function toGameMove(move: Move, index: number): GameMove {
  return {
    ply: index + 1,
    san: move.san,
    lan: move.lan,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    color: move.color,
    beforeFen: move.before,
    afterFen: move.after,
    captured: move.captured,
  };
}

export function appendMove(game: LoadedGame, upToPly: number, move: Move): LoadedGame {
  const kept = game.moves.slice(0, upToPly);
  return {
    ...game,
    moves: [...kept, toGameMove(move, kept.length)],
  };
}

export function needsPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from as Square);
  if (!piece || piece.type !== "p") return false;
  const rank = to[1];
  return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
}

export function lanToSan(fen: string, lan: string | null): string | null {
  if (!lan) return null;
  const chess = new Chess(fen);
  const from = lan.slice(0, 2);
  const to = lan.slice(2, 4);
  const promotion = lan.length > 4 ? lan[4] : undefined;
  try {
    const move = chess.move({
      from: from as Square,
      to: to as Square,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });
    return move.san;
  } catch {
    return lan;
  }
}

export function gameTitle(headers: GameHeaders): string {
  const white = headers.White ?? "White";
  const black = headers.Black ?? "Black";
  return `${white} vs ${black}`;
}

export { START_FEN };
