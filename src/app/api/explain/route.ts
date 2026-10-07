import { NextResponse } from "next/server";
import { localExplanation } from "@/lib/local-explanation";
import type { BilingualExplanation, ExplainRequest } from "@/lib/types";

function inferGamePhase(fen: string): ExplainRequest["gamePhase"] {
  const [boardPart] = fen.split(" ");
  const activePieces = boardPart.replace(/[1-8/]/g, "");
  const totalPieces = activePieces.length;

  if (totalPieces <= 10) return "endgame";
  if (totalPieces >= 20) return "opening";
  return "middlegame";
}

export async function POST(request: Request) {
  const body = (await request.json()) as ExplainRequest;
  if (!body?.fen || !body.moveSan) {
    return NextResponse.json({ error: "Missing position details" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      explanation: localExplanation(body),
      source: "local" as const,
    });
  }

  const gamePhase = body.gamePhase ?? inferGamePhase(body.fen);
  const openingContext = body.opening?.status === "in-book"
    ? `IN BOOK. Official English name: ${body.opening.nameEn ?? "unknown"}. Official Hebrew name: ${body.opening.nameHe ?? "unknown"}. ECO: ${body.opening.eco ?? "unknown"}.`
    : body.opening?.status === "out-of-book"
      ? body.opening.isFirstDeviationMove
        ? `FIRST DEVIATION MOVE. This exact move is the first one outside theory: move ${body.opening.deviationPly ?? "unknown"} ${body.opening.deviationMove ?? "unknown"}.${body.opening.nameEn ? ` Last recognized opening: ${body.opening.nameEn} / ${body.opening.nameHe ?? ""} (ECO ${body.opening.eco ?? "unknown"}).` : " No named opening position was recognized before the deviation."}`
        : `OPEN GAME AFTER THEORY. The first deviation was an earlier move (${body.opening.deviationPly ?? "unknown"} ${body.opening.deviationMove ?? "unknown"}). Do not repeat or mention the first-deviation/out-of-book alert in this explanation; analyze this move normally.`
      : "Opening data is unavailable; do not claim that the move is in or out of book and do not invent an opening name.";

  const prompt = `You are an expert chess coach for an ambitious club player. Give concise but practical coaching advice grounded in this exact position. Focus on the move's strategic purpose, the immediate tactical risks and opportunities, and the most useful next practical recommendation. Do not invent long tactical lines that are not supported by the position. If the opening information is available, mention it naturally when it matters; otherwise do not claim a named opening. Keep your advice clear and constructive.

Position FEN: ${body.fen}
Side that moved: ${body.side}
Move played: ${body.moveSan} (${body.moveLan})
Engine classification: ${body.classification}
Live eval before: ${body.evalBefore}
Live eval after: ${body.evalAfter}
Eval loss vs best: ${body.evalDelta}
Stockfish top recommended move: ${body.bestMoveSan ?? body.bestMove ?? "unknown"}
Opening book status and labels: ${openingContext}
ECO opening name: ${body.opening?.eco ?? "unknown"}
Game phase: ${gamePhase}

Return only a valid JSON object with exactly these string properties: {"en":"English explanation","he":"Hebrew explanation"}. Each string must use exactly these three labeled sections, in this order:
Strategic Purpose: explain the move's deeper objective, what idea the player is trying to create, and why it helps in this position.
Tactical/Risk Notes: summarize the leading concrete tactical idea, the most important risk, and any opponent resources the move addresses or invites.
Practical Recommendation: tell the player what they should do next or how they should think about the move in practical terms.

For the Hebrew version, use these labels in this order: מטרה אסטרטגית:, הערות טקטיות/סיכונים:, המלצה מעשית:. Make the Hebrew a faithful translation of the same ideas, not a shorter summary. Keep each section concise and plain text without markdown.`;

  try {
    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.55, maxOutputTokens: 900 },
        }),
      },
    );

    if (!gemini.ok) {
      const detail = await gemini.text();
      throw new Error(detail.slice(0, 300));
    }

    const data = (await gemini.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const responseText = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!responseText) {
      throw new Error("Empty Gemini response");
    }

    const json = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const explanation = JSON.parse(json) as Partial<BilingualExplanation>;
    const openingTextValid =
      body.opening?.status === "in-book"
        ? Boolean(
          body.opening.nameEn &&
            body.opening.nameHe &&
            explanation.en?.includes(body.opening.nameEn) &&
            explanation.he?.includes(body.opening.nameHe),
          )
        : body.opening?.status === "out-of-book" && body.opening.isFirstDeviationMove
          ? Boolean(
            explanation.en?.toLowerCase().includes("out of book") &&
              explanation.he?.includes("מחוץ לתיאוריה") &&
              (!body.opening.deviationMove ||
                (explanation.en?.includes(body.opening.deviationMove) &&
                  explanation.he?.includes(body.opening.deviationMove))),
          )
          : body.opening?.status === "out-of-book"
          ? !(
              explanation.en?.toLowerCase().includes("out of book") ||
              explanation.en?.toLowerCase().includes("first move out of theory") ||
              explanation.he?.includes("מחוץ לתיאוריה") ||
              explanation.he?.includes("המסע הראשון מחוץ לתיאוריה")
            )
          : true;

    if (
      typeof explanation.en !== "string" ||
      typeof explanation.he !== "string" ||
      !explanation.en.trim() ||
      !explanation.he.trim() ||
      !["Strategic Purpose:", "Tactical/Risk Notes:", "Practical Recommendation:"].every((label) =>
        explanation.en?.includes(label),
      ) ||
      !["מטרה אסטרטגית:", "הערות טקטיות/סיכונים:", "המלצה מעשית:"].every((label) =>
        explanation.he?.includes(label),
      ) ||
      !openingTextValid
    ) {
      throw new Error("Incomplete strategic bilingual explanation");
    }

    return NextResponse.json({ explanation, source: "ai" as const });
  } catch {
    return NextResponse.json({
      explanation: localExplanation(body),
      source: "local" as const,
      fallback: true,
    });
  }
}
