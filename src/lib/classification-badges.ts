import type { MoveClassification } from "@/lib/types";

export const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { symbol: string; label: string; labelHe: string; style: string }
> = {
  brilliant: { symbol: "✦", label: "BRILLIANT", labelHe: "מבריק", style: "bg-cyan-300 text-cyan-950" },
  great: { symbol: "↗", label: "GREAT FIND", labelHe: "מהלך מצוין", style: "bg-emerald-300 text-emerald-950" },
  best: { symbol: "★", label: "BEST", labelHe: "הטוב ביותר", style: "bg-green-500 text-white" },
  excellent: { symbol: "✓", label: "EXCELLENT", labelHe: "מצוין", style: "bg-lime-300 text-lime-950" },
  good: { symbol: "+", label: "GOOD", labelHe: "טוב", style: "bg-green-200 text-green-950" },
  inaccuracy: { symbol: "!", label: "INACCURACY", labelHe: "אי-דיוק", style: "bg-yellow-300 text-yellow-950" },
  mistake: { symbol: "?", label: "MISTAKE", labelHe: "טעות", style: "bg-orange-300 text-orange-950" },
  poor: { symbol: "−", label: "POOR", labelHe: "חלש", style: "bg-orange-500 text-white" },
  blunder: { symbol: "×", label: "BLUNDER", labelHe: "טעות חמורה", style: "bg-rose-600 text-white" },
  book: { symbol: "B", label: "BOOK", labelHe: "תיאוריה", style: "bg-sky-300 text-sky-950" },
  forced: { symbol: "=", label: "FORCED", labelHe: "כפוי", style: "bg-zinc-300 text-zinc-900" },
};
