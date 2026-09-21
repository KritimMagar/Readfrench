import { dayKey } from "./progress.js";
import { isDue, newCard, review, type Grade, type SrsState } from "./srs.js";
import type { EntryId, LexEntry, Pos, Sentence, Story } from "../types/story.js";

/**
 * A saved word. Keyed by EntryId (`lemma|pos`), so "vais", "allais" and "irai"
 * all land on one `aller` card rather than three.
 */
export interface VocabItem {
  entryId: EntryId;
  lemma: string;
  pos: Pos;
  en: string[];
  /** The inflected form actually tapped, e.g. "vais". */
  metSurface: string;
  metStoryId: string;
  metStoryTitle: string;
  metSentenceIndex: number;
  /**
   * The sentence is copied, not referenced. Stories get edited and offsets
   * shift; the sentence a word was met in should not change under a card
   * weeks later.
   */
  metSentenceFr: string;
  metSentenceEn: string;
  /** Char offsets of the tapped word within metSentenceFr, for highlighting. */
  metStart: number;
  metEnd: number;
  createdAt: string;
  srs: SrsState;
}

/**
 * Parts of speech worth a flashcard. Function words are still tappable — a
 * beginner needs to look up "le" — but auto-saving them buries the deck in
 * articles and prepositions, so they are saved only on request.
 */
const AUTO_SAVE_POS = new Set<Pos>([
  "NOUN",
  "PROPN",
  "VERB",
  "ADJ",
  "ADV",
  "NUM",
  "INTJ",
  "PHRASE",
]);

export const isAutoSaved = (pos: Pos): boolean => AUTO_SAVE_POS.has(pos);

export interface MetContext {
  story: Story;
  sentence: Sentence;
  /** Token index that was tapped. */
  tokenIndex: number;
}

export function buildItem(
  entryId: EntryId,
  entry: LexEntry,
  { story, sentence, tokenIndex }: MetContext,
  today = dayKey(),
): VocabItem | null {
  const token = sentence.tokens[tokenIndex];
  if (!token) return null;
  return {
    entryId,
    lemma: entry.lemma,
    pos: entry.pos,
    en: entry.en,
    metSurface: token.s,
    metStoryId: story.id,
    metStoryTitle: story.title,
    metSentenceIndex: sentence.i,
    metSentenceFr: sentence.fr,
    metSentenceEn: sentence.en,
    metStart: token.start,
    metEnd: token.end,
    createdAt: today,
    srs: newCard(today),
  };
}

/** Saving an already-saved word keeps the original context and schedule. */
export function addItem(deck: VocabItem[], item: VocabItem): VocabItem[] {
  return deck.some((v) => v.entryId === item.entryId) ? deck : [...deck, item];
}

export const removeItem = (deck: VocabItem[], entryId: EntryId): VocabItem[] =>
  deck.filter((v) => v.entryId !== entryId);

export const hasItem = (deck: VocabItem[], entryId: EntryId): boolean =>
  deck.some((v) => v.entryId === entryId);

export function gradeItem(
  deck: VocabItem[],
  entryId: EntryId,
  grade: Grade,
  today = dayKey(),
): VocabItem[] {
  return deck.map((v) =>
    v.entryId === entryId ? { ...v, srs: review(v.srs, grade, today) } : v,
  );
}

/** Oldest due first, so a backlog is worked through in the order it built up. */
export function dueItems(deck: VocabItem[], today = dayKey()): VocabItem[] {
  return deck
    .filter((v) => isDue(v.srs, today))
    .sort((a, b) => a.srs.dueAt.localeCompare(b.srs.dueAt) || a.createdAt.localeCompare(b.createdAt));
}
