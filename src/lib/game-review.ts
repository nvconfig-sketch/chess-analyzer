import type { AiProvider } from "@/lib/ai-settings";
import { requestClientJson } from "@/lib/client-explanation";
import type {
  AnalyzedMove,
  BilingualExplanation,
  GameHeaders,
  MoveClassification,
} from "@/lib/types";

export type GameReviewStats = {
  totalMoves: number;
  classifications: Record<MoveClassification, number>;
  averageCentipawnLoss: number | null;
  accuracyPercent: null;
};

export function aggregateGameReviewStats(moves: AnalyzedMove[]): GameReviewStats {
  const classifications: Record<MoveClassification, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    poor: 0,
    blunder: 0,
    forced: 0,
  };
  const losses = moves.flatMap((move) =>
    move.evalLossCp === null ? [] : [move.evalLossCp],
  );

  for (const move of moves) classifications[move.classification] += 1;

  return {
    totalMoves: moves.length,
    classifications,
    averageCentipawnLoss: losses.length
      ? Math.round(losses.reduce((total, loss) => total + loss, 0) / losses.length)
      : null,
    accuracyPercent: null,
  };
}

export async function generateGameReview(
  provider: AiProvider,
  apiKey: string,
  headers: GameHeaders,
  moves: AnalyzedMove[],
  signal: AbortSignal,
): Promise<BilingualExplanation> {
  const stats = aggregateGameReviewStats(moves);
  const systemPrompt = `You are an expert chess analyst and a friendly, upbeat coach. Write a fun, constructive post-game review in exactly 3-4 sentences in English and exactly 3-4 sentences in Hebrew. Celebrate a real strength, explain the most important recurring or decisive lesson, and give one practical focus for the next game. Be concise, supportive, and specific to the supplied statistics and move examples. Do not shame the player, make unsupported claims, or invent an accuracy score. Return only a JSON object with exactly two string properties: {"en":"English review","he":"Faithful natural Hebrew review"}.`;
  const prompt = buildReviewPrompt(headers, moves, stats);
  const parsed = await requestClientJson(
    provider,
    apiKey,
    systemPrompt,
    prompt,
    signal,
    350,
  );

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("en" in parsed) ||
    !("he" in parsed) ||
    typeof parsed.en !== "string" ||
    typeof parsed.he !== "string" ||
    !parsed.en.trim() ||
    !parsed.he.trim()
  ) {
    throw new Error("The AI did not return a bilingual game review");
  }

  return { en: parsed.en.trim(), he: parsed.he.trim() };
}

function buildReviewPrompt(
  headers: GameHeaders,
  moves: AnalyzedMove[],
  stats: GameReviewStats,
): string {
  const majorMoments = moves
    .filter((move) => ["blunder", "mistake", "inaccuracy", "brilliant", "great"].includes(move.classification))
    .sort((left, right) => (right.evalLossCp ?? 0) - (left.evalLossCp ?? 0))
    .slice(0, 5)
    .map((move) => {
      const moveNumber = Math.ceil(move.ply / 2);
      const notation = `${moveNumber}${move.ply % 2 ? "." : "..."} ${move.san}`;
      return `${notation} (${move.color === "w" ? "White" : "Black"}: ${move.classification}, eval loss ${move.evalLossCp ?? "unknown"} cp; engine alternative: ${move.bestMoveSan ?? move.bestMove ?? "unknown"})`;
    });

  return `Game: ${headers.White ?? "White"} vs ${headers.Black ?? "Black"}
Result: ${headers.Result ?? "not recorded"}
Opening: ${headers.ECO ?? "not recorded"}
Analyzed plies: ${stats.totalMoves}
Move classifications: ${Object.entries(stats.classifications)
    .filter(([, count]) => count > 0)
    .map(([classification, count]) => `${classification}: ${count}`)
    .join(", ") || "none"}
Average centipawn loss across scored moves: ${stats.averageCentipawnLoss ?? "unavailable"}
Accuracy percentage: unavailable; this app does not calculate an accuracy score.
Notable moments: ${majorMoments.join("; ") || "no standout classifications"}

Write the requested 3-4 sentence review in each language. Mention numbers only when they help the player understand a concrete lesson.`;
}