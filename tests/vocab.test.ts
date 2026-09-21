import { describe, expect, it } from "vitest";

import {
  addItem,
  buildItem,
  dueItems,
  gradeItem,
  hasItem,
  isAutoSaved,
  removeItem,
  type VocabItem,
} from "../src/lib/vocab.js";
import { GRADES } from "../src/lib/srs.js";
import type { LexEntry, Sentence, Story } from "../src/types/story.js";

const sentence: Sentence = {
  i: 3,
  fr: "Minuit a deux ans.",
  en: "Minuit is two years old.",
  tokens: [
    { i: 0, start: 0, end: 6, s: "Minuit", k: "word", entry: "Minuit|PROPN" },
    { i: 1, start: 7, end: 8, s: "a", k: "word", entry: "avoir|VERB", note: "present, il/elle" },
    { i: 2, start: 9, end: 13, s: "deux", k: "word", entry: "deux|NUM" },
    { i: 3, start: 14, end: 17, s: "ans", k: "word", entry: "an|NOUN" },
    { i: 4, start: 17, end: 18, s: ".", k: "punct" },
  ],
};

const story = {
  id: "le-chat-de-marie",
  title: "Le chat de Marie",
  sentences: [sentence],
} as unknown as Story;

const aller: LexEntry = { lemma: "aller", pos: "VERB", en: ["to go"] };

const make = (day = "2026-09-21") =>
  buildItem("avoir|VERB", { lemma: "avoir", pos: "VERB", en: ["to have"] }, { story, sentence, tokenIndex: 1 }, day)!;

describe("isAutoSaved", () => {
  it("auto-saves content words", () => {
    for (const pos of ["NOUN", "VERB", "ADJ", "ADV", "PROPN", "PHRASE"] as const) {
      expect(isAutoSaved(pos)).toBe(true);
    }
  });

  it("leaves function words for an explicit save", () => {
    for (const pos of ["DET", "ADP", "PRON", "CCONJ", "SCONJ", "AUX", "PART"] as const) {
      expect(isAutoSaved(pos)).toBe(false);
    }
  });
});

describe("buildItem", () => {
  it("snapshots the sentence and the form actually tapped", () => {
    const item = make();
    expect(item.entryId).toBe("avoir|VERB");
    expect(item.metSurface).toBe("a");
    expect(item.metSentenceFr).toBe("Minuit a deux ans.");
    expect(item.metSentenceEn).toBe("Minuit is two years old.");
    expect(item.metSentenceIndex).toBe(3);
    expect(item.metStoryTitle).toBe("Le chat de Marie");
    expect(item.metSentenceFr.slice(item.metStart, item.metEnd)).toBe("a");
    expect(item.srs.dueAt).toBe("2026-09-21");
  });

  it("returns null for a token index that does not exist", () => {
    expect(buildItem("x|VERB", aller, { story, sentence, tokenIndex: 99 })).toBeNull();
  });
});

describe("deck", () => {
  it("keys on the lexeme, so two inflections are one card", () => {
    const base = buildItem("aller|VERB", aller, { story, sentence, tokenIndex: 0 })!;
    const vais: VocabItem = { ...base, metSurface: "vais" };
    const allais: VocabItem = { ...base, metSurface: "allais" };
    const deck = addItem(addItem([], vais), allais);
    expect(deck).toHaveLength(1);
    // The first meeting wins: that is the sentence the card will show.
    expect(deck[0]!.metSurface).toBe("vais");
  });

  it("keeps the original context when a word is met again", () => {
    const first = make("2026-09-01");
    const later: VocabItem = { ...first, metSentenceFr: "Une autre phrase.", createdAt: "2026-09-21" };
    const deck = addItem([first], later);
    expect(deck[0]!.metSentenceFr).toBe("Minuit a deux ans.");
    expect(deck[0]!.createdAt).toBe("2026-09-01");
  });

  it("adds, finds and removes", () => {
    const deck = addItem([], make());
    expect(hasItem(deck, "avoir|VERB")).toBe(true);
    expect(hasItem(removeItem(deck, "avoir|VERB"), "avoir|VERB")).toBe(false);
  });
});

describe("dueItems", () => {
  const at = (id: string, dueAt: string, createdAt = "2026-09-01"): VocabItem => ({
    ...make(),
    entryId: id,
    createdAt,
    srs: { ...make().srs, dueAt },
  });

  it("returns only cards due on or before today, oldest first", () => {
    const deck = [
      at("c|VERB", "2026-09-25"),
      at("a|VERB", "2026-09-19"),
      at("b|VERB", "2026-09-21"),
    ];
    expect(dueItems(deck, "2026-09-21").map((v) => v.entryId)).toEqual(["a|VERB", "b|VERB"]);
  });

  it("is empty when nothing is due", () => {
    expect(dueItems([at("c|VERB", "2026-09-25")], "2026-09-21")).toEqual([]);
  });
});

describe("gradeItem", () => {
  it("advances only the graded card", () => {
    const deck = [make(), { ...make(), entryId: "autre|VERB" }];
    const graded = gradeItem(deck, "avoir|VERB", GRADES.good, "2026-09-21");
    expect(graded[0]!.srs.reps).toBe(1);
    expect(graded[0]!.srs.dueAt).toBe("2026-09-22");
    expect(graded[1]!.srs.reps).toBe(0);
  });

  it("pushes a failed card back to tomorrow and counts a lapse", () => {
    const graded = gradeItem([make()], "avoir|VERB", GRADES.again, "2026-09-21");
    expect(graded[0]!.srs.lapses).toBe(1);
    expect(graded[0]!.srs.dueAt).toBe("2026-09-22");
  });
});
