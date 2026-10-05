import { openingBook } from "@chess-openings/eco.json";
import type { Opening, OpeningCollection } from "@chess-openings/eco.json";
import { START_FEN } from "@/lib/game";
import type { GameHeaders, GameMove, OpeningContext } from "@/lib/types";

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
  ["Philidor Defense", "ההגנה הפילידורית"],
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
let localOpeningTrie: OpeningNode | null = null;

const COMMON_OPENINGS: Array<{ eco: string; name: string; moves: string[] }> = [
  { eco: "B00", name: "King's Pawn Opening", moves: ["e4"] },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"] },
  { eco: "C40", name: "King's Knight Opening", moves: ["e4", "e5", "Nf3"] },
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C54", name: "Italian Game: Classical Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C68", name: "Ruy Lopez: Exchange Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"] },
  { eco: "C45", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C47", name: "Four Knights Game", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"] },
  { eco: "B90", name: "Sicilian Defense: Najdorf Variation", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
  { eco: "B33", name: "Sicilian Defense: Sveshnikov Variation", moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"] },
  { eco: "C11", name: "French Defense: Classical Variation", moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"] },
  { eco: "B12", name: "Caro-Kann Defense: Advance Variation", moves: ["e4", "c6", "d4", "d5", "e5"] },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"] },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"] },
  { eco: "B06", name: "Modern Defense", moves: ["e4", "g6"] },
  { eco: "C00", name: "King's Indian Attack", moves: ["e4", "e6", "d3", "d5", "Nd2"] },
  { eco: "D00", name: "Queen's Pawn Game", moves: ["d4", "d5"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
  { eco: "D10", name: "Slav Defense", moves: ["d4", "d5", "c4", "c6"] },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"] },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"] },
  { eco: "D70", name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "E12", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { eco: "A10", name: "English Opening", moves: ["c4"] },
  { eco: "A13", name: "English Opening: Agincourt Defense", moves: ["c4", "e6"] },
  { eco: "A04", name: "Réti Opening", moves: ["Nf3"] },
  { eco: "A80", name: "Dutch Defense", moves: ["d4", "f5"] },
  { eco: "A40", name: "English Defense", moves: ["d4", "b6"] },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d4", "Nf6", "Bg5"] },
  { eco: "D02", name: "London System", moves: ["d4", "d5", "Bf4"] },
  { eco: "D00", name: "Colle System", moves: ["d4", "d5", "Nf3", "Nf6", "e3"] },
];

const ECO_HEADER_NAMES: Record<string, string> = {
  A00: "Amar Opening",
  A10: "English Opening",
  A40: "Queen's Pawn Game",
  A45: "Indian Defense",
  B00: "King's Pawn Opening",
  B01: "Scandinavian Defense",
  B10: "Caro-Kann Defense",
  B20: "Sicilian Defense",
  C00: "French Defense",
  C20: "King's Pawn Game",
  C40: "King's Knight Opening",
  C41: "Philidor Defense",
  C45: "Scotch Game",
  C50: "Italian Game",
  C60: "Ruy Lopez",
  D00: "Queen's Pawn Game",
  D06: "Queen's Gambit",
  D10: "Slav Defense",
  D70: "Grünfeld Defense",
  E20: "Nimzo-Indian Defense",
};

export async function identifyOpening(
  moves: GameMove[],
  startFen: string,
  headers: GameHeaders = {},
): Promise<OpeningContext> {
  if (moves.length === 0) {
    return openingFromHeaders(headers) ?? unavailableOpening();
  }

  if (positionKey(startFen) !== positionKey(START_FEN)) {
    return openingFromHeaders(headers) ?? {
      status: "unavailable",
      eco: null,
      nameEn: null,
      nameHe: null,
      deviationPly: null,
      deviationMove: null,
      isFirstDeviationMove: false,
    };
  }

  const localResult = lookupOpening(moves, getLocalOpeningTrie(), headers);
  let trie: OpeningNode;
  try {
    const remoteTrie = await Promise.race([
      loadOpeningTrie(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    trie = remoteTrie ?? getLocalOpeningTrie();
  } catch {
    trie = getLocalOpeningTrie();
  }

  return trie === localOpeningTrie
    ? localResult
    : lookupOpening(moves, trie, headers);
}

function lookupOpening(
  moves: GameMove[],
  trie: OpeningNode,
  headers: GameHeaders,
): OpeningContext {
  try {
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

    if (lastOpening) {
      return {
        status: "in-book",
        eco: lastOpening.eco,
        nameEn: lastOpening.name,
        nameHe: openingNameInHebrew(lastOpening.name),
        deviationPly: null,
        deviationMove: null,
        isFirstDeviationMove: false,
      };
    }
    return openingFromHeaders(headers) ?? unavailableOpening();
  } catch {
    return openingFromHeaders(headers) ?? unavailableOpening();
  }
}

function getLocalOpeningTrie(): OpeningNode {
  if (localOpeningTrie) return localOpeningTrie;
  localOpeningTrie = buildOpeningTrieFromEntries(COMMON_OPENINGS.map((entry) => ({
    src: "eco_tsv" as const,
    eco: entry.eco,
    name: entry.name,
    moves: entry.moves.join(" "),
    isEcoRoot: true,
  })));
  return localOpeningTrie;
}

function openingFromHeaders(headers: GameHeaders): OpeningContext | null {
  const eco = headers.ECO?.trim() || null;
  const nameEn = headers.Opening?.trim() ?? (eco ? ECO_HEADER_NAMES[eco] : undefined);
  if (!nameEn) return null;
  return {
    status: "in-book",
    eco,
    nameEn,
    nameHe: openingNameInHebrew(nameEn),
    deviationPly: null,
    deviationMove: null,
    isFirstDeviationMove: false,
  };
}

function unavailableOpening(): OpeningContext {
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
  return buildOpeningTrieFromEntries(Object.values(openings));
}

function buildOpeningTrieFromEntries(openings: Opening[]): OpeningNode {
  const root: OpeningNode = { children: new Map(), opening: null };

  for (const opening of openings) {
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