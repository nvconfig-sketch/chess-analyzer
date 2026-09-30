import { NextResponse } from "next/server";
import { localExplanation } from "@/lib/local-explanation";
import type { BilingualExplanation, ExplainRequest } from "@/lib/types";

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

  const openingContext = body.opening?.status === "in-book"
    ? `IN BOOK. Official English name: ${body.opening.nameEn ?? "unknown"}. Official Hebrew name: ${body.opening.nameHe ?? "unknown"}. ECO: ${body.opening.eco ?? "unknown"}.`
    : body.opening?.status === "out-of-book"
      ? body.opening.isFirstDeviationMove
        ? `FIRST DEVIATION MOVE. This exact move is the first one outside theory: move ${body.opening.deviationPly ?? "unknown"} ${body.opening.deviationMove ?? "unknown"}.${body.opening.nameEn ? ` Last recognized opening: ${body.opening.nameEn} / ${body.opening.nameHe ?? ""} (ECO ${body.opening.eco ?? "unknown"}).` : " No named opening position was recognized before the deviation."}`
        : `OPEN GAME AFTER THEORY. The first deviation was an earlier move (${body.opening.deviationPly ?? "unknown"} ${body.opening.deviationMove ?? "unknown"}). Do not repeat or mention the first-deviation/out-of-book alert in this explanation; analyze this move normally.`
      : "Opening data is unavailable; do not claim that the move is in or out of book and do not invent an opening name.";

  const prompt = `You are a bilingual chess coach for a club player (around 1200-1800). Focus primarily on strategic intent and plans, not a static description of what a move controls. Analyze the position and explain what the player is trying to achieve, the longer-term plan this move supports, and what it prepares for the next few turns. Consider goals such as creating space, targeting a weakness, preparing a pawn break, improving piece activity, coordinating pieces, or addressing a threat. Explain why the move's classification fits, but do not let engine numbers replace strategic analysis. Ground claims in the supplied position and best move; do not invent a tactic or continuation that the position does not support. If the exact plan is uncertain, describe the most plausible positional aim cautiously.

Position FEN: ${body.fen}
Side that moved: ${body.side}
Move played: ${body.moveSan} (${body.moveLan})
Engine classification: ${body.classification}
Engine eval before (White's view of the position they faced): ${body.evalBefore}
Eval after: ${body.evalAfter}
Eval loss vs best: ${body.evalDelta}
Best engine move: ${body.bestMoveSan ?? body.bestMove ?? "unknown"}
Opening book status and labels: ${openingContext}

Return only a valid JSON object with exactly these string properties: {"en":"English explanation","he":"Hebrew explanation"}. Each string must use these four labeled lines, in this order:
Assessment: why this move is good, inaccurate, or forced, including the key consequence. If in book, include the official English opening name in "en" and its supplied official Hebrew label in "he". Only when the current move is explicitly marked FIRST DEVIATION MOVE, say exactly that it is the first move out of theory after the supplied opening and identify the move in both languages. For every later OPEN GAME AFTER THEORY move, do not repeat or mention the first-deviation/out-of-book alert; assess the current move normally. Never claim out of book when opening data is unavailable.
Goal: what the player is trying to achieve strategically.
Plan: how this move supports the longer-term plan or targets a weakness.
Next: what the player is preparing to do in the next few turns, or what positional follow-up to look for.

Use the exact English labels above in "en" and the Hebrew labels הערכה:, מטרה:, תוכנית:, המשך: in "he". Make the Hebrew a faithful, natural translation of all four ideas, not a shorter summary. Keep each line concise and use plain text without markdown.`;

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
      !["Assessment:", "Goal:", "Plan:", "Next:"].every((label) =>
        explanation.en?.includes(label),
      ) ||
      !["הערכה:", "מטרה:", "תוכנית:", "המשך:"].every((label) =>
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
