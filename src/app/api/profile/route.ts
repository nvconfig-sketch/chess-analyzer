import { NextResponse } from "next/server";
import {
  isPlayerProfileMetrics,
  isPlayerPersonalityProfile,
  type PlayerProfileMetrics,
} from "@/lib/player-profile";

export async function POST(request: Request) {
  let body: { metrics?: PlayerProfileMetrics };
  try {
    body = (await request.json()) as { metrics?: PlayerProfileMetrics };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!isPlayerProfileMetrics(body.metrics)) {
    return NextResponse.json({ error: "Game profile metrics are required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Set GEMINI_API_KEY in .env.local to generate a player profile." },
      { status: 503 },
    );
  }

  const prompt = `Create a motivating, evidence-based player personality profile from these analyzed game metrics:
${JSON.stringify(body.metrics)}

The player is ${body.metrics.playerName}, playing ${body.metrics.color === "w" ? "White" : "Black"}.
Infer style cautiously from one game. The grandmaster comparison should be a tentative resemblance, not a claim of equal skill. Never invent tactics or strengths unsupported by the metrics.

Return only a JSON object with exactly these properties:
{"archetype":"short playing-style title","grandmasterMatch":"one famous grandmaster comparison","strengths":["2-3 observed strengths"],"areasToImprove":["exactly 2 strategic recommendations"],"summary":"a motivating 2-3 sentence personal-coach overview"}`;

  let gemini: Response;
  try {
    gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch {
    return NextResponse.json({ error: "Could not reach the Gemini profile service." }, { status: 502 });
  }

  if (!gemini.ok) {
    return NextResponse.json(
      { error: `Gemini profile request failed (${gemini.status}).` },
      { status: 502 },
    );
  }

  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    data = (await gemini.json()) as typeof data;
  } catch {
    return NextResponse.json({ error: "Gemini returned an unreadable player profile." }, { status: 502 });
  }
  const responseText = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!responseText) {
    return NextResponse.json({ error: "Gemini returned an empty player profile." }, { status: 502 });
  }

  let parsed: unknown;
  try {
    const json = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(json) as unknown;
  } catch {
    return NextResponse.json({ error: "Gemini returned an invalid profile format." }, { status: 502 });
  }

  if (!isPlayerPersonalityProfile(parsed)) {
    return NextResponse.json({ error: "Gemini returned an incomplete player profile." }, { status: 502 });
  }

  return NextResponse.json({ profile: parsed });
}
