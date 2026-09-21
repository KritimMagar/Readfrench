import { describe, expect, it } from "vitest";
import { formKey, tokenize, wordTokens } from "../tools/tokenize.js";

const surfaces = (fr: string) => tokenize(fr).map((t) => t.s);

describe("tokenize", () => {
  it("splits words and punctuation", () => {
    expect(surfaces("Marie habite à Lyon.")).toEqual([
      "Marie", "habite", "à", "Lyon", ".",
    ]);
  });

  it("splits elision, keeping the apostrophe with the clitic", () => {
    expect(surfaces("Le chat s'appelle Minuit.")).toEqual([
      "Le", "chat", "s'", "appelle", "Minuit", ".",
    ]);
    expect(surfaces("Minuit n'aime pas les chiens.")).toEqual([
      "Minuit", "n'", "aime", "pas", "les", "chiens", ".",
    ]);
    expect(surfaces("Qu'est-ce que c'est ?")).toEqual([
      "Qu'", "est-ce", "que", "c'", "est", "?",
    ]);
  });

  it("keeps words whose apostrophe is internal", () => {
    expect(surfaces("Aujourd'hui, c'est samedi.")).toEqual([
      "Aujourd'hui", ",", "c'", "est", "samedi", ".",
    ]);
    expect(surfaces("quelqu'un")).toEqual(["quelqu'un"]);
  });

  it("treats a typographic apostrophe like a straight one", () => {
    expect(surfaces("Aujourd’hui c’est samedi")).toEqual([
      "Aujourd’hui", "c’", "est", "samedi",
    ]);
  });

  it("keeps hyphenated compounds whole", () => {
    expect(surfaces("Le week-end, peut-être.")).toEqual([
      "Le", "week-end", ",", "peut-être", ".",
    ]);
  });

  it("keeps French punctuation spacing as separate tokens", () => {
    expect(surfaces("Marie dit : « Bonjour ! »")).toEqual([
      "Marie", "dit", ":", "«", "Bonjour", "!", "»",
    ]);
  });

  it("scans numerals without merging them into punctuation", () => {
    expect(surfaces("Il est 6 h 30.")).toEqual(["Il", "est", "6", "h", "30", "."]);
  });

  it("emits offsets that reproduce the sentence exactly", () => {
    const fr = "Aujourd'hui, Marie dit : « Minuit, tu es mon ami. »";
    for (const t of tokenize(fr)) {
      expect(fr.slice(t.start, t.end)).toBe(t.s);
    }
    const rebuilt = tokenize(fr).reduce(
      (acc, t) => acc + fr.slice(acc.length, t.start) + t.s,
      "",
    );
    expect(fr.startsWith(rebuilt)).toBe(true);
  });

  it("indexes tokens sequentially from zero", () => {
    const tokens = tokenize("Il y a une grande fenêtre dans le salon.");
    expect(tokens.map((t) => t.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(wordTokens(tokens)).toHaveLength(9);
  });

  it("normalises lookup keys", () => {
    expect(formKey("S’")).toBe("s'");
    expect(formKey("Aujourd'hui")).toBe("aujourd'hui");
  });

  it("handles empty and whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});
