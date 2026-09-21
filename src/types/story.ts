/**
 * Canonical story data model. See docs/data-model.md for the rationale.
 *
 * Both the content compiler (tools/) and the reader (src/) depend on these
 * types, so the shape of a compiled story is checked on both sides of the
 * pipeline.
 */

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export const TOPICS = [
  "animals",
  "city",
  "culture",
  "daily-life",
  "family",
  "food",
  "health",
  "history",
  "nature",
  "news",
  "science",
  "sport",
  "technology",
  "travel",
  "work",
] as const;
export type Topic = (typeof TOPICS)[number];

/** Universal Dependencies tags, plus PHRASE for multi-word entries. */
export const POS_TAGS = [
  "NOUN",
  "PROPN",
  "VERB",
  "AUX",
  "ADJ",
  "ADV",
  "PRON",
  "DET",
  "ADP",
  "CCONJ",
  "SCONJ",
  "NUM",
  "INTJ",
  "PART",
  "PHRASE",
] as const;
export type Pos = (typeof POS_TAGS)[number];

/** `${lemma}|${pos}` — e.g. "habiter|VERB". The unit vocabulary saves. */
export type EntryId = string;

/** A lexeme: dictionary-form facts, independent of any occurrence. */
export interface LexEntry {
  lemma: string;
  pos: Pos;
  /** Ordered, most common sense first. */
  en: string[];
  gender?: "m" | "f";
  /** Short usage or culture note. */
  hint?: string;
}

export type TokenKind = "word" | "punct";

export interface Token {
  /** Index within the sentence. */
  i: number;
  /** Char offset into Sentence.fr, inclusive. */
  start: number;
  /** Char offset into Sentence.fr, exclusive. */
  end: number;
  /** Surface form; always equals fr.slice(start, end). */
  s: string;
  k: TokenKind;
  /** Required on `word`, absent on `punct`. */
  entry?: EntryId;
  /** Inflection of this particular form, e.g. "present, il/elle". */
  note?: string;
}

/** A multi-word expression covering tokens [from, to). */
export interface Span {
  from: number;
  to: number;
  entry: EntryId;
}

export interface Sentence {
  i: number;
  fr: string;
  en: string;
  tokens: Token[];
  spans?: Span[];
}

/** Sentence indices [from, to). */
export interface Paragraph {
  from: number;
  to: number;
}

export interface Story {
  schemaVersion: 1;
  id: string;
  level: Level;
  title: string;
  titleEn: string;
  topics: Topic[];
  wordCount: number;
  sentenceCount: number;
  readingTimeMin: number;
  sourceFile: string;
  /** Identifies which source revision produced this output. */
  sourceHash: string;
  compiledAt: string;
  paragraphs: Paragraph[];
  sentences: Sentence[];
  /** Only the entries this story actually uses. */
  entries: Record<EntryId, LexEntry>;
}

/** One row of content/dist/index.json — the library list, step 2. */
export interface StorySummary {
  id: string;
  level: Level;
  title: string;
  titleEn: string;
  topics: Topic[];
  wordCount: number;
  readingTimeMin: number;
}

/** Learner reading speeds, not native ones. */
export const WPM_BY_LEVEL: Record<Level, number> = {
  A1: 60,
  A2: 80,
  B1: 100,
  B2: 130,
  C1: 160,
  C2: 190,
};

export function readingTimeMin(wordCount: number, level: Level): number {
  return Math.max(1, Math.round(wordCount / WPM_BY_LEVEL[level]));
}

/**
 * What a tap on a token resolves to. A multi-word expression wins over the
 * single word, but the literal word is kept so the popup can show both.
 */
export interface TapResult {
  surface: string;
  primary: LexEntry;
  literal: LexEntry | null;
  note?: string;
}

export function resolveTap(
  story: Story,
  sentence: Sentence,
  tokenIndex: number,
): TapResult | null {
  const token = sentence.tokens[tokenIndex];
  if (!token || token.k !== "word" || !token.entry) return null;

  const span = sentence.spans?.find(
    (s) => tokenIndex >= s.from && tokenIndex < s.to,
  );
  const word = story.entries[token.entry];
  if (!word) return null;

  const spanEntry = span ? story.entries[span.entry] : undefined;

  return {
    surface: token.s,
    primary: spanEntry ?? word,
    literal: spanEntry ? word : null,
    ...(token.note === undefined ? {} : { note: token.note }),
  };
}
