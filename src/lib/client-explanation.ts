import type { AiProvider } from "@/lib/ai-settings";
import type { BilingualExplanation, ExplainRequest } from "@/lib/types";

const SYSTEM_PROMPT = `You are a friendly, concise chess coach. Explain the selected move to a club player in one or two simple sentences per language. State the move's strategic intent or most important tactical idea, and explain the engine evaluation briefly when useful. Avoid jargon, unsupported continuations, and long analysis. If this is the first move outside opening theory, mention it once; if the game had already left theory, do not repeat that alert. Return only a JSON object with exactly two string properties: {"en":"English explanation","he":"Natural Hebrew explanation"}. The Hebrew must faithfully express the same idea as the English.`;

export async function requestClientExplanation(
  provider: AiProvider,
  apiKey: string,
  payload: ExplainRequest,
  signal: AbortSignal,
): Promise<BilingualExplanation> {
  const prompt = buildMovePrompt(payload);
  const response =
    provider === "gemini"
      ? await requestGemini(apiKey, prompt, signal)
      : await requestOpenAi(apiKey, prompt, signal);

  if (!response.ok) {
    throw new Error(`${provider === "gemini" ? "Gemini" : "OpenAI"} request failed (${response.status})`);
  }

  const data = (await response.json()) as ProviderResponse;
  const content =
    provider === "gemini"
      ? data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n")
      : data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("The AI provider returned an empty explanation");

  return parseBilingualExplanation(content);
}

async function requestGemini(apiKey: string, prompt: string, signal: AbortSignal) {
  return fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      }),
      signal,
    },
  );
}

async function requestOpenAi(apiKey: string, prompt: string, signal: AbortSignal) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    signal,
  });
}

function buildMovePrompt(payload: ExplainRequest): string {
  const opening = payload.opening?.status === "in-book"
    ? `Opening: ${payload.opening.nameEn ?? "unknown"} / ${payload.opening.nameHe ?? "לא ידוע"} (ECO ${payload.opening.eco ?? "unknown"}).`
    : payload.opening?.status === "out-of-book"
      ? payload.opening.isFirstDeviationMove
        ? `This is the first move out of theory: ${payload.opening.deviationMove ?? payload.moveSan}. Last named opening: ${payload.opening.nameEn ?? "unknown"} / ${payload.opening.nameHe ?? "לא ידוע"}.`
        : "The game left opening theory earlier; do not repeat the out-of-book alert."
      : "Opening book information is unavailable.";

  return `Position FEN: ${payload.fen}
Side to move: ${payload.side}
Move played: ${payload.moveSan} (${payload.moveLan})
Engine classification: ${payload.classification}
Engine best move: ${payload.bestMoveSan ?? payload.bestMove ?? "unknown"}
Evaluation before: ${payload.evalBefore}
Evaluation after: ${payload.evalAfter}
Evaluation loss versus best: ${payload.evalDelta}
${opening}`;
}

function parseBilingualExplanation(content: string): BilingualExplanation {
  const json = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(json) as Partial<BilingualExplanation>;

  if (
    typeof parsed.en !== "string" ||
    typeof parsed.he !== "string" ||
    !parsed.en.trim() ||
    !parsed.he.trim()
  ) {
    throw new Error("The AI response did not include English and Hebrew explanations");
  }

  return { en: parsed.en.trim(), he: parsed.he.trim() };
}

type ProviderResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  choices?: Array<{ message?: { content?: string | null } }>;
};