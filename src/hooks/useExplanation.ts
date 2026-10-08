"use client";

import { useEffect, useState } from "react";
import { useAiSettings } from "@/hooks/useAiSettings";
import { requestClientExplanation } from "@/lib/client-explanation";
import type { AiProvider, AiSettings } from "@/lib/ai-settings";
import type {
  AnalyzedMove,
  BilingualExplanation,
  ExplainRequest,
  ExplanationLanguage,
  OpeningBookContext,
  OpeningContext,
} from "@/lib/types";
import { formatWhiteCp, whiteCpFromFen } from "@/lib/eval";

export function useExplanation(move: AnalyzedMove | null, opening: OpeningContext | null) {
  const aiSettings = useAiSettings();
  const [resultState, setResultState] = useState<{
    move: AnalyzedMove;
    opening: OpeningContext | null;
    settings: AiSettings;
    explanation: BilingualExplanation;
    error: string | null;
    source: "ai" | "local" | AiProvider | null;
  } | null>(null);
  const [language, setLanguage] = useState<ExplanationLanguage>("en");

  useEffect(() => {
    if (!move || opening?.status === "loading") return;

    const controller = new AbortController();
    const settledOpening = getSettledOpening(opening);
    const provider = aiSettings.provider;
    const apiKey = aiSettings.apiKeys[provider].trim();
    const payload: ExplainRequest = {
      fen: move.beforeFen,
      moveSan: move.san,
      moveLan: move.lan,
      bestMove: move.bestMove,
      bestMoveSan: move.bestMoveSan,
      classification: move.classification,
      evalBefore: formatWhiteCp(whiteCpFromFen(move.beforeFen, move.evalBefore)),
      evalAfter: formatWhiteCp(whiteCpFromFen(move.afterFen, move.evalAfter)),
      evalDelta:
        move.evalLossCp === null ? "unknown" : `${(move.evalLossCp / 100).toFixed(2)} pawns`,
      side: move.color === "w" ? "White" : "Black",
      opening: settledOpening,
    };

    const explanationRequest = apiKey
      ? requestClientExplanation(provider, apiKey, payload, controller.signal).then(
          (explanation) => ({ explanation, source: provider }),
        )
      : fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).then(async (response) => {
          const data = (await response.json()) as {
            explanation?: BilingualExplanation;
            source?: "ai" | "local";
            error?: string;
          };
          if (!response.ok) throw new Error(data.error ?? "Explanation failed");
          if (!data.explanation?.en || !data.explanation.he) {
            throw new Error("Incomplete bilingual explanation");
          }
          return { explanation: data.explanation, source: data.source ?? "local" };
        });

    explanationRequest
      .then(({ explanation, source }) => {
        setResultState({
          move,
          opening: settledOpening,
          settings: aiSettings,
          explanation,
          error: null,
          source,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResultState({
          move,
          opening: settledOpening,
          settings: aiSettings,
          explanation: { en: "", he: "" },
          error: err instanceof Error ? err.message : "Explanation failed",
          source: null,
        });
      });

    return () => controller.abort();
  }, [move, opening, aiSettings]);

  const result =
    resultState?.move === move &&
    resultState.opening === opening &&
    resultState.settings === aiSettings
      ? resultState
      : null;
  return {
    text: result?.explanation[language] ?? null,
    bilingual: result?.explanation ?? null,
    loading: move !== null && (opening?.status === "loading" || result === null),
    error: result?.error ?? null,
    source: result?.source ?? null,
    language,
    setLanguage,
  };
}

function getSettledOpening(opening: OpeningContext | null): OpeningBookContext | null {
  if (!opening || !isSettledOpening(opening)) return null;
  return opening;
}

function isSettledOpening(opening: OpeningContext): opening is OpeningBookContext {
  return opening.status !== "loading";
}
