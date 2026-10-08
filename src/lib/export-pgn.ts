import { Chess } from "chess.js";
import { whiteCpFromFen } from "@/lib/eval";
import type {
  AnalyzedMove,
  BilingualExplanation,
  LoadedGame,
  MoveClassification,
} from "@/lib/types";

const ANNOTATION: Partial<Record<MoveClassification, string>> = {
  brilliant: "!!",
  great: "!",
  inaccuracy: "?!",
  mistake: "?",
  poor: "?",
  blunder: "??",
};

export function createAnnotatedPgn(
  game: LoadedGame,
  analyzed: AnalyzedMove[],
  explanations: Record<number, BilingualExplanation> = {},
): string {
  const chess = new Chess(game.startFen);
  for (const [key, value] of Object.entries({
    ...game.headers,
    Event: game.headers.Event ?? "Chess Analyzer Game Analysis",
    Date: game.headers.Date ?? "????.??.??",
    Result: game.headers.Result ?? "*",
    White: game.headers.White ?? "White",
    Black: game.headers.Black ?? "Black",
    Annotator: "Chess Analyzer",
  })) {
    if (value.trim()) chess.setHeader(key, value);
  }
  if (game.startFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
    chess.setHeader("SetUp", "1");
    chess.setHeader("FEN", game.startFen);
  }

  for (const gameMove of game.moves) {
    const played = chess.move({
      from: gameMove.from,
      to: gameMove.to,
      ...(gameMove.promotion ? { promotion: gameMove.promotion as "q" | "r" | "b" | "n" } : {}),
    });
    const analysis = analyzed.find((move) => move.ply === gameMove.ply);
    const commentParts: string[] = [];

    if (analysis) {
      const whiteCp = whiteCpFromFen(analysis.afterFen, analysis.evalAfter);
      if (whiteCp !== null) {
        const evalTag = analysis.evalAfter?.kind === "mate"
          ? `#${whiteCp < 0 ? -Math.abs(analysis.evalAfter.value) : Math.abs(analysis.evalAfter.value)}`
          : (whiteCp / 100).toFixed(2);
        commentParts.push(`[%eval ${evalTag}]`);
      }

      const annotation = ANNOTATION[analysis.classification];
      if (annotation) commentParts.push(annotation);
      commentParts.push(`Classification: ${analysis.classification}.`);

      if (analysis.evalLossCp !== null) {
        commentParts.push(`Eval loss: ${(analysis.evalLossCp / 100).toFixed(2)} pawns.`);
      }
      if (analysis.bestMoveSan) {
        commentParts.push(`Engine alternative: ${analysis.bestMoveSan}.`);
      }
    }

    const explanation = explanations[gameMove.ply];
    if (explanation?.en.trim()) commentParts.push(`Coach (English): ${explanation.en.trim()}`);
    if (explanation?.he.trim()) commentParts.push(`Coach (Hebrew): ${explanation.he.trim()}`);

    if (commentParts.length) {
      chess.setComment(commentParts.join(" "));
    }

    if (!played) {
      throw new Error(`Could not replay move ${gameMove.ply} (${gameMove.san}) for PGN export.`);
    }
  }

  return chess.pgn({ maxWidth: 100 });
}
