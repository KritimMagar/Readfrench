import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { compileStory, loadLexicon, parseBody, splitFrontmatter, type Lexicon } from "../tools/content.js";

const lexicon: Lexicon = {
  forms: {
    le: { entry: "le|DET", note: "masculine singular" },
    chat: { entry: "chat|NOUN" },
    dort: { entry: "dormir|VERB", note: "present, il/elle" },
    il: { entry: "il|PRON" },
    y: { entry: "y|PRON" },
    a: { entry: "avoir|VERB", note: "present, il/elle" },
    un: { entry: "un|DET" },
    "s'": { entry: "se|PRON" },
    appelle: { entry: "appeler|VERB" },
  },
  entries: {
    "le|DET": { lemma: "le", pos: "DET", en: ["the"] },
    "chat|NOUN": { lemma: "chat", pos: "NOUN", en: ["cat"], gender: "m" },
    "dormir|VERB": { lemma: "dormir", pos: "VERB", en: ["to sleep"] },
    "il|PRON": { lemma: "il", pos: "PRON", en: ["he", "it"] },
    "y|PRON": { lemma: "y", pos: "PRON", en: ["there"] },
    "avoir|VERB": { lemma: "avoir", pos: "VERB", en: ["to have"] },
    "un|DET": { lemma: "un", pos: "DET", en: ["a"] },
    "se|PRON": { lemma: "se", pos: "PRON", en: ["oneself"] },
    "appeler|VERB": { lemma: "appeler", pos: "VERB", en: ["to call"] },
    "si|SCONJ": { lemma: "si", pos: "SCONJ", en: ["if"] },
  },
};

const story = (body: string, extraFm = "") =>
  `---\nid: t\ntitle: T\ntitleEn: T\nlevel: A1\ntopics: [animals]\n${extraFm}---\n\n${body}\n`;

const compile = (body: string, extraFm = "") =>
  compileStory("content/stories/a1/t.md", story(body, extraFm), lexicon);

describe("splitFrontmatter", () => {
  it("separates frontmatter from body", () => {
    const { fm, body } = splitFrontmatter("---\nid: x\n---\nLe chat.\n");
    expect(fm.id).toBe("x");
    expect(body.trim()).toBe("Le chat.");
  });

  it("rejects a file with no frontmatter", () => {
    expect(() => splitFrontmatter("Le chat.")).toThrow(/frontmatter/);
  });
});

describe("parseBody", () => {
  it("pairs each French line with the blockquote below it", () => {
    const r = parseBody("Le chat dort.\n> The cat sleeps.\nIl y a un chat.\n> There is a cat.");
    expect(r.errors).toEqual([]);
    expect(r.sentences).toEqual([
      { fr: "Le chat dort.", en: "The cat sleeps." },
      { fr: "Il y a un chat.", en: "There is a cat." },
    ]);
    expect(r.paragraphs).toEqual([{ from: 0, to: 2 }]);
  });

  it("treats a blank line as a paragraph break", () => {
    const r = parseBody("Le chat dort.\n> The cat sleeps.\n\nIl y a un chat.\n> There is a cat.");
    expect(r.paragraphs).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2 }]);
  });

  it("reports a sentence with no translation", () => {
    const r = parseBody("Le chat dort.");
    expect(r.errors[0]).toMatch(/no English translation/);
  });
});

describe("compileStory", () => {
  it("compiles a valid story and resolves glosses", () => {
    const { story: s, issues } = compile("Le chat dort.\n> The cat sleeps.");
    expect(issues.filter((i) => !i.message.startsWith("warning:"))).toEqual([]);
    expect(s).not.toBeNull();
    const tokens = s!.sentences[0]!.tokens;
    expect(tokens[0]).toMatchObject({ s: "Le", entry: "le|DET", note: "masculine singular" });
    expect(tokens[2]).toMatchObject({ s: "dort", entry: "dormir|VERB" });
    expect(tokens[3]).toMatchObject({ s: ".", k: "punct" });
    expect(tokens[3]).not.toHaveProperty("entry");
    expect(s!.entries["chat|NOUN"]).toEqual({ lemma: "chat", pos: "NOUN", en: ["cat"], gender: "m" });
  });

  it("fails the build when a word has no gloss", () => {
    const { story: s, issues } = compile("Le zzz dort.\n> The zzz sleeps.");
    expect(s).toBeNull();
    expect(issues.some((i) => i.missingForm === "zzz")).toBe(true);
  });

  it("matches multi-word expressions on whole-token boundaries", () => {
    const { story: s } = compile(
      "Il y a un chat.\n> There is a cat.",
      "mwe:\n  - fr: il y a\n    en: there is\n",
    );
    expect(s!.sentences[0]!.spans).toEqual([{ from: 0, to: 3, entry: "il y a|PHRASE" }]);
  });

  it("does not match an expression that straddles a word boundary", () => {
    // "a" must not match inside "chat" or "appelle".
    const { story: s } = compile(
      "Le chat dort.\n> The cat sleeps.",
      "mwe:\n  - fr: a\n    en: has\n",
    );
    expect(s!.sentences[0]!.spans).toBeUndefined();
  });

  it("lets an occurrence override beat the shared lexicon", () => {
    const { story: s } = compile(
      "Le chat dort.\n> The cat sleeps.",
      'gloss:\n  "0:1": { entry: "si|SCONJ", note: homograph }\n',
    );
    expect(s!.sentences[0]!.tokens[1]).toMatchObject({ s: "chat", entry: "si|SCONJ", note: "homograph" });
    expect(s!.entries["si|SCONJ"]).toBeDefined();
  });

  it("rejects a frontmatter declaration split by an unquoted comma", () => {
    const { story: s, issues } = compile(
      "Le chat dort.\n> The cat sleeps.",
      'gloss:\n  "0:1": { entry: "si|SCONJ", note: direct object, plural }\n',
    );
    expect(s).toBeNull();
    expect(issues.some((i) => /unexpected key "plural"/.test(i.message))).toBe(true);
  });

  it("rejects an id that does not match the filename", () => {
    const raw = story("Le chat dort.\n> The cat sleeps.").replace("id: t", "id: other");
    const { story: s, issues } = compileStory("content/stories/a1/t.md", raw, lexicon);
    expect(s).toBeNull();
    expect(issues.some((i) => /does not match filename/.test(i.message))).toBe(true);
  });

  it("rejects an unknown level or topic", () => {
    const raw = story("Le chat dort.\n> The cat sleeps.").replace("level: A1", "level: Z9");
    const { issues } = compileStory("content/stories/a1/t.md", raw, lexicon);
    expect(issues.some((i) => /level "Z9"/.test(i.message))).toBe(true);
  });

  it("emits token offsets that reproduce each sentence", () => {
    const { story: s } = compile("Le chat s'appelle un chat.\n> The cat is called a cat.");
    for (const sentence of s!.sentences) {
      for (const t of sentence.tokens) {
        expect(sentence.fr.slice(t.start, t.end)).toBe(t.s);
      }
    }
  });

  it("warns, but still compiles, when a story is outside the word range", () => {
    const { story: s, issues } = compile("Le chat dort.\n> The cat sleeps.");
    expect(s).not.toBeNull();
    expect(issues.some((i) => i.message.startsWith("warning:"))).toBe(true);
  });
});

describe("loadLexicon", () => {
  const write = (forms: string, entries: string) => {
    const dir = mkdtempSync(join(tmpdir(), "lex-"));
    writeFileSync(join(dir, "forms.yaml"), forms);
    writeFileSync(join(dir, "entries.yaml"), entries);
    return [join(dir, "forms.yaml"), join(dir, "entries.yaml")] as const;
  };

  it("loads a valid lexicon", () => {
    const [f, e] = write(
      'chat: { entry: "chat|NOUN" }\n',
      '"chat|NOUN": { lemma: chat, pos: NOUN, en: cat }\n',
    );
    expect(loadLexicon(f, e).forms["chat"]).toEqual({ entry: "chat|NOUN" });
  });

  it("rejects a row split by an unquoted comma", () => {
    // `en: to like, to love` in a flow mapping silently drops the second sense
    // and leaves a null key behind. That must fail the build, not pass quietly.
    const [f, e] = write(
      'chat: { entry: "chat|NOUN" }\n',
      '"aimer|VERB": { lemma: aimer, pos: VERB, en: to like, to love }\n',
    );
    expect(() => loadLexicon(f, e)).toThrow(/unexpected key "to love"/);
  });

  it("rejects a form pointing at an undefined entry", () => {
    const [f, e] = write('chat: { entry: "chat|NOUN" }\n', "{}\n");
    expect(() => loadLexicon(f, e)).toThrow(/undefined entry/);
  });

  it("rejects an entry key that disagrees with its lemma and pos", () => {
    const [f, e] = write("{}\n", '"chat|NOUN": { lemma: chien, pos: NOUN, en: dog }\n');
    expect(() => loadLexicon(f, e)).toThrow(/does not match its lemma and pos/);
  });

  it("rejects a value YAML reads as a boolean rather than text", () => {
    const [f, e] = write("{}\n", '"vrai|ADJ": { lemma: vrai, pos: ADJ, en: true }\n');
    expect(() => loadLexicon(f, e)).toThrow(/non-text en/);
  });
});
