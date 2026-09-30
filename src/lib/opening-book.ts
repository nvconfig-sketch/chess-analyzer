import { openingBook } from "@chess-openings/eco.json";
import type { Opening, OpeningCollection } from "@chess-openings/eco.json";
import { START_FEN } from "@/lib/game";
import type { GameMove, OpeningContext } from "@/lib/types";

type OpeningNode = {
  children: Map<string, OpeningNode>;
  opening: Opening | null;
};

const HEBREW_OPENING_TERMS: [string, string][] = [
  ["Sicilian Defense", "ההגנה הסיציליאנית"],
  ["Najdorf Variation", "וריאציית ניידורף"],
  ["English Attack", "ההתקפה האנגלית"],
  ["Dragon Variation", "וריאציית הדרקון"],
  ["Sveshnikov Variation", "וריאציית סוושניקוב"],
  ["Scheveningen Variation", "וריאציית סוונינגן"],
  ["Taimanov Variation", "וריאציית טיימנוב"],
  ["Kan Variation", "וריאציית קאן"],
  ["Classical Variation", "הווריאציה הקלאסית"],
  ["Closed Variation", "הווריאציה הסגורה"],
  ["Open Variation", "הווריאציה הפתוחה"],
  ["French Defense", "ההגנה הצרפתית"],
  ["Caro-Kann Defense", "ההגנה הקארו-קאן"],
  ["Pirc Defense", "ההגנה הפירצית"],
  ["Modern Defense", "ההגנה המודרנית"],
  ["Alekhine's Defense", "ההגנה של אלכין"],
  ["Scandinavian Defense", "ההגנה הסקנדינבית"],
  ["Ruy Lopez", "הפתיחה הספרדית (רוי לופז)"],
  ["Italian Game", "המשחק האיטלקי"],
  ["Scotch Game", "המשחק הסקוטי"],
  ["Petrov's Defense", "ההגנה של פטרוב"],
  ["King's Gambit", "גמביט המלך"],
  ["King's Pawn Game", "משחק הרגלי של המלך"],
  ["King's Pawn Opening", "פתיחת הרגלי של המלך"],
  ["Queen's Gambit Accepted", "גמביט המלכה התקבל"],
  ["Queen's Gambit Declined", "גמביט המלכה נדחה"],
  ["Queen's Gambit", "גמביט המלכה"],
  ["Queen's Pawn Game", "משחק הרגלי של המלכה"],
  ["King's Indian Defense", "ההגנה ההודית של המלך"],
  ["Queen's Indian Defense", "ההגנה ההודית של המלכה"],
  ["Nimzo-Indian Defense", "ההגנה הנימצו-הודית"],
  ["Grünfeld Defense", "ההגנה הגרינפלדית"],
  ["Slav Defense", "ההגנה הסלאבית"],
  ["Semi-Slav Defense", "ההגנה הסלאבית למחצה"],
  ["Catalan Opening", "הפתיחה הקטלאנית"],
  ["London System", "מערכת לונדון"],
  ["Dutch Defense", "ההגנה ההולנדית"],
  ["Benoni Defense", "ההגנה הבנונית"],
  ["English Opening", "הפתיחה האנגלית"],
  ["Réti Opening", "פתיחת רטי"],
  ["Bird Opening", "פתיחת בירד"],
  ["Nimzo-Larsen Attack", "התקפת נימצו-לארסן"],
  ["Trompowsky Attack", "התקפת טרומפובסקי"],
  ["Variation", "וריאציה"],
  ["System", "מערכת"],
  ["Attack", "התקפה"],
  ["Defense", "הגנה"],
  ["Gambit", "גמביט"],
  ["Accepted", "התקבל"],
  ["Declined", "נדחה"],
  ["Classical", "קלאסית"],
  ["Exchange", "חילופין"],
  ["Main Line", "הקו הראשי"],
  ["Open", "פתוחה"],
  ["Closed", "סגורה"],
];

let openingTriePromise: Promise<OpeningNode> | null = null;

export async function identifyOpening(
  moves: GameMove[],
  startFen: string,
): Promise<OpeningContext> {
  if (positionKey(startFen) !== positionKey(START_FEN)) {
    return {
      status: "unavailable",
      eco: null,
      nameEn: null,
      nameHe: null,
      deviationPly: null,
      deviationMove: null,
      isFirstDeviationMove: false,
    };
  }

  try {
    const trie = await loadOpeningTrie();
    let node = trie;
    let lastOpening: Opening | null = null;

    for (const move of moves) {
      const next = node.children.get(normalizeSan(move.san));
      if (!next) {
        return outOfBook(move, lastOpening, moves.at(-1)?.ply === move.ply);
      }
      node = next;
      if (node.opening) lastOpening = node.opening;
    }

    return {
      status: "in-book",
      eco: lastOpening?.eco ?? null,
      nameEn: lastOpening?.name ?? null,
      nameHe: lastOpening ? openingNameInHebrew(lastOpening.name) : null,
      deviationPly: null,
      deviationMove: null,
      isFirstDeviationMove: false,
    };
  } catch {
    return {
      status: "unavailable",
      eco: null,
      nameEn: null,
      nameHe: null,
      deviationPly: null,
      deviationMove: null,
      isFirstDeviationMove: false,
    };
  }
}

export function openingNameInHebrew(name: string): string {
  const exact = HEBREW_OPENING_TERMS.find(([english]) => english === name);
  if (exact) return exact[1];

  let translated = name;
  for (const [english, hebrew] of HEBREW_OPENING_TERMS) {
    translated = translated.replaceAll(english, hebrew);
  }

  return translated === name ? `שם הפתיחה: ${name}` : translated;
}

function outOfBook(
  move: GameMove | null,
  opening: Opening | null,
  isFirstDeviationMove: boolean,
): OpeningContext {
  return {
    status: "out-of-book",
    eco: opening?.eco ?? null,
    nameEn: opening?.name ?? null,
    nameHe: opening ? openingNameInHebrew(opening.name) : null,
    deviationPly: move?.ply ?? null,
    deviationMove: move?.san ?? null,
    isFirstDeviationMove,
  };
}

async function loadOpeningTrie(): Promise<OpeningNode> {
  if (!openingTriePromise) {
    openingTriePromise = openingBook().then(buildOpeningTrie);
  }

  try {
    return await openingTriePromise;
  } catch (error) {
    openingTriePromise = null;
    throw error;
  }
}

function buildOpeningTrie(openings: OpeningCollection): OpeningNode {
  const root: OpeningNode = { children: new Map(), opening: null };

  for (const opening of Object.values(openings)) {
    let node = root;
    for (const san of sanTokens(opening.moves)) {
      const key = normalizeSan(san);
      let next = node.children.get(key);
      if (!next) {
        next = { children: new Map(), opening: null };
        node.children.set(key, next);
      }
      node = next;
    }

    if (!node.opening || opening.isEcoRoot) node.opening = opening;
  }

  return root;
}

function sanTokens(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}|;[^\n]*/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^\d+\.(?:\.\.)?$/.test(token))
    .filter((token) => !["1-0", "0-1", "1/2-1/2", "*", "e.p."].includes(token));
}

function normalizeSan(san: string): string {
  return san.replace(/[!?+#]+$/g, "");
}

function positionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}