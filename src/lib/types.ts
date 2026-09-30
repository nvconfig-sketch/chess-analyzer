export type PlayerColor = "w" | "b";

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "poor"
  | "blunder"
  | "forced";

export type EngineScore =
  | { kind: "cp"; value: number }
  | { kind: "mate"; value: number };

export type EvaluatedPosition = {
  fen: string;
  score: EngineScore | null;
  bestMove: string | null;
  pv: string[];
  depth: number;
};

export type GameMove = {
  ply: number;
  san: string;
  lan: string;
  from: string;
  to: string;
  promotion?: string;
  color: PlayerColor;
  beforeFen: string;
  afterFen: string;
  captured?: string;
};

export type AnalyzedMove = GameMove & {
  classification: MoveClassification;
  evalBefore: EngineScore | null;
  evalAfter: EngineScore | null;
  bestMove: string | null;
  bestMoveSan: string | null;
  evalLossCp: number | null;
  pv: string[];
};

export type GameHeaders = Record<string, string>;

export type LoadedGame = {
  headers: GameHeaders;
  moves: GameMove[];
  startFen: string;
};

export type BilingualExplanation = {
  en: string;
  he: string;
};

export type ExplanationLanguage = keyof BilingualExplanation;

export type OpeningContext = {
  status: "loading" | "unavailable" | "in-book" | "out-of-book";
  eco: string | null;
  nameEn: string | null;
  nameHe: string | null;
  deviationPly: number | null;
  deviationMove: string | null;
  isFirstDeviationMove: boolean;
};

export type OpeningBookContext = Omit<OpeningContext, "status"> & {
  status: "unavailable" | "in-book" | "out-of-book";
};

export type ExplainRequest = {
  fen: string;
  moveSan: string;
  moveLan: string;
  bestMove: string | null;
  bestMoveSan: string | null;
  classification: MoveClassification;
  evalBefore: string;
  evalAfter: string;
  evalDelta: string;
  side: "White" | "Black";
  opening?: OpeningBookContext | null;
};
