import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

import {
  LEVELS,
  POS_TAGS,
  TOPICS,
  readingTimeMin,
  type EntryId,
  type LexEntry,
  type Level,
  type Paragraph,
  type Pos,
  type Sentence,
  type Span,
  type Story,
  type Topic,
} from "../src/types/story.js";
import { formKey, tokenize, wordTokens } from "./tokenize.js";

export interface CompileIssue {
  file: string;
  message: string;
  /** Missing forms are collected separately so we can print a paste-ready block. */
  missingForm?: string;
}

/** forms.yaml: inflected surface form -> which lexeme, and how it is inflected. */
interface FormRow {
  entry: EntryId;
  note?: string;
}

export interface Lexicon {
  forms: Record<string, FormRow>;
  entries: Record<EntryId, LexEntry>;
}

interface MweDecl {
  fr: string;
  en: string | string[];
  lemma?: string;
  note?: string;
  hint?: string;
}

interface GlossDecl {
  /** Required on an occurrence override: the surface form it must land on. */
  form?: string;
  lemma?: string;
  pos?: string;
  en?: string | string[];
  gender?: "m" | "f";
  hint?: string;
  note?: string;
  entry?: EntryId;
}

interface Frontmatter {
  id?: string;
  title?: string;
  titleEn?: string;
  level?: string;
  topics?: string[];
  source?: string;
  gloss?: Record<string, GlossDecl>;
  mwe?: MweDecl[];
}

const senses = (en: string | string[] | undefined): string[] =>
  en === undefined
    ? []
    : Array.isArray(en)
      ? en.map((s) => s.trim()).filter(Boolean)
      : en.split(",").map((s) => s.trim()).filter(Boolean);

export function entryId(lemma: string, pos: Pos): EntryId {
  return `${lemma}|${pos}`;
}

const FORM_KEYS = new Set(["entry", "note"]);
const ENTRY_KEYS = new Set(["lemma", "pos", "en", "gender", "hint"]);

/**
 * Validates the lexicon files themselves, not just the stories.
 *
 * An unquoted comma inside a YAML flow mapping (`{ en: to like, to love }`)
 * silently splits the row and turns the tail into a null key, so unknown keys
 * are treated as a hard error rather than ignored.
 */
export function loadLexicon(formsPath: string, entriesPath: string): Lexicon {
  const problems: string[] = [];
  const rawForms = (yaml.load(readFileSync(formsPath, "utf8")) ?? {}) as Record<string, unknown>;
  const rawEntries = (yaml.load(readFileSync(entriesPath, "utf8")) ?? {}) as Record<string, unknown>;

  const entries: Record<EntryId, LexEntry> = {};
  for (const [id, value] of Object.entries(rawEntries)) {
    if (typeof value !== "object" || value === null) {
      problems.push(`entries.yaml: "${id}" is not a mapping`);
      continue;
    }
    const e = value as Record<string, unknown>;
    for (const k of Object.keys(e)) {
      if (!ENTRY_KEYS.has(k)) {
        problems.push(
          `entries.yaml: "${id}" has unexpected key "${k}" ` +
            `(an unquoted comma splits a { } row — quote the value or use a [list])`,
        );
      }
    }
    const lemma = typeof e["lemma"] === "string" ? (e["lemma"] as string) : "";
    const pos = e["pos"] as Pos;
    if (!lemma) problems.push(`entries.yaml: "${id}" is missing lemma`);
    if (!POS_TAGS.includes(pos)) problems.push(`entries.yaml: "${id}" has invalid pos "${e["pos"]}"`);
    if (lemma && POS_TAGS.includes(pos) && entryId(lemma, pos) !== id) {
      problems.push(`entries.yaml: key "${id}" does not match its lemma and pos`);
    }
    const rawEn = e["en"];
    const enIsText =
      rawEn === undefined ||
      typeof rawEn === "string" ||
      (Array.isArray(rawEn) && rawEn.every((x) => typeof x === "string"));
    if (!enIsText) {
      // Bare true/false parse as booleans here, and YAML 1.1 tools widen that
      // to on/off/yes/no, so an unquoted `en` can arrive as a non-string.
      problems.push(
        `entries.yaml: "${id}" has a non-text en (${JSON.stringify(rawEn)}) — quote it`,
      );
    }
    const en = enIsText ? senses(rawEn as string | string[] | undefined) : [];
    if (en.length === 0) problems.push(`entries.yaml: "${id}" has no English sense`);
    entries[id] = {
      lemma,
      pos,
      en,
      ...(e["gender"] ? { gender: e["gender"] as "m" | "f" } : {}),
      ...(e["hint"] ? { hint: String(e["hint"]) } : {}),
    };
  }

  const forms: Record<string, FormRow> = {};
  for (const [form, value] of Object.entries(rawForms)) {
    if (typeof value !== "object" || value === null) {
      problems.push(`forms.yaml: "${form}" is not a mapping`);
      continue;
    }
    const row = value as Record<string, unknown>;
    for (const k of Object.keys(row)) {
      if (!FORM_KEYS.has(k)) {
        problems.push(
          `forms.yaml: "${form}" has unexpected key "${k}" ` +
            `(an unquoted comma splits a { } row — quote the value)`,
        );
      }
    }
    const entry = row["entry"];
    if (typeof entry !== "string" || !entry) {
      problems.push(`forms.yaml: "${form}" is missing entry`);
      continue;
    }
    if (!entries[entry]) {
      problems.push(`forms.yaml: "${form}" points at undefined entry "${entry}"`);
    }
    forms[form] = { entry, ...(row["note"] ? { note: String(row["note"]) } : {}) };
  }

  if (problems.length > 0) {
    throw new Error(`lexicon is invalid:\n  ${problems.join("\n  ")}`);
  }
  return { forms, entries };
}

/** Splits `---\nyaml\n---\nbody` without pulling in a markdown dependency. */
export function splitFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const text = raw.replace(/^﻿/, "");
  if (!text.startsWith("---")) throw new Error("file does not start with frontmatter");
  const end = text.indexOf("\n---", 3);
  if (end === -1) throw new Error("unterminated frontmatter");
  const fm = (yaml.load(text.slice(3, end)) ?? {}) as Frontmatter;
  const nl = text.indexOf("\n", end + 1);
  return { fm, body: nl === -1 ? "" : text.slice(nl + 1) };
}

export interface ParsedBody {
  sentences: { fr: string; en: string }[];
  paragraphs: Paragraph[];
  errors: string[];
}

/**
 * Body format: one French sentence per line, its English translation on the
 * next line as a blockquote, blank line between paragraphs.
 */
export function parseBody(body: string): ParsedBody {
  const sentences: { fr: string; en: string }[] = [];
  const paragraphs: Paragraph[] = [];
  const errors: string[] = [];

  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const from = sentences.length;
    for (let i = 0; i < lines.length; i++) {
      const fr = lines[i]!;
      if (fr.startsWith(">")) {
        errors.push(`translation line with no French sentence above it: ${fr}`);
        continue;
      }
      const next = lines[i + 1];
      if (next === undefined || !next.startsWith(">")) {
        errors.push(`French sentence has no English translation: ${fr}`);
        continue;
      }
      const en = next.replace(/^>\s*/, "").trim();
      if (!en) errors.push(`empty English translation for: ${fr}`);
      sentences.push({ fr, en });
      i++;
    }
    if (sentences.length > from) paragraphs.push({ from, to: sentences.length });
  }

  return { sentences, paragraphs, errors };
}

export interface CompileResult {
  story: Story | null;
  issues: CompileIssue[];
}

export function compileStory(
  path: string,
  raw: string,
  lexicon: Lexicon,
  now = new Date(),
): CompileResult {
  const issues: CompileIssue[] = [];
  const fail = (message: string, missingForm?: string) =>
    issues.push({ file: path, message, ...(missingForm ? { missingForm } : {}) });

  let parsed: { fm: Frontmatter; body: string };
  try {
    parsed = splitFrontmatter(raw);
  } catch (err) {
    fail((err as Error).message);
    return { story: null, issues };
  }
  const { fm, body } = parsed;

  const id = fm.id?.trim();
  if (!id) fail("frontmatter is missing `id`");
  const expectedId = path.split("/").pop()!.replace(/\.md$/, "");
  if (id && id !== expectedId) fail(`id "${id}" does not match filename "${expectedId}"`);

  if (!fm.title?.trim()) fail("frontmatter is missing `title`");
  if (!fm.titleEn?.trim()) fail("frontmatter is missing `titleEn`");

  const level = fm.level as Level;
  if (!LEVELS.includes(level)) fail(`level "${fm.level}" is not one of ${LEVELS.join(", ")}`);

  const topics = (fm.topics ?? []) as Topic[];
  if (topics.length === 0) fail("frontmatter needs at least one topic");
  for (const t of topics) {
    if (!TOPICS.includes(t)) fail(`topic "${t}" is not in the allowed list`);
  }

  const { sentences: rawSentences, paragraphs, errors } = parseBody(body);
  for (const e of errors) fail(e);
  if (rawSentences.length === 0) fail("story has no sentences");

  // Story-local entries, merged over the shared lexicon for this story only.
  const entries: Record<EntryId, LexEntry> = {};
  const localForms: Record<string, FormRow> = {};
  const occurrenceOverrides = new Map<string, GlossDecl>();

  /**
   * `hint` is a fact about the lexeme, so it lands on the entry. `note` is a
   * fact about one inflected form, so it lands on the token instead.
   */
  const declareEntry = (
    lemma: string,
    pos: Pos,
    decl: { en?: string | string[]; gender?: "m" | "f"; hint?: string },
  ): EntryId => {
    const eid = entryId(lemma, pos);
    entries[eid] = {
      lemma,
      pos,
      en: senses(decl.en),
      ...(decl.gender ? { gender: decl.gender } : {}),
      ...(decl.hint ? { hint: decl.hint } : {}),
    };
    return eid;
  };

  const GLOSS_KEYS = new Set(["form", "lemma", "pos", "en", "gender", "hint", "note", "entry"]);
  const MWE_KEYS = new Set(["fr", "en", "lemma", "note", "hint"]);
  const checkKeys = (label: string, decl: object, allowed: Set<string>) => {
    for (const k of Object.keys(decl)) {
      if (!allowed.has(k)) {
        fail(
          `${label} has unexpected key "${k}" ` +
            `(an unquoted comma splits a { } row — quote the value)`,
        );
      }
    }
  };

  for (const [key, decl] of Object.entries(fm.gloss ?? {})) {
    checkKeys(`gloss "${key}"`, decl, GLOSS_KEYS);
    if (/^\d+:\d+$/.test(key)) {
      occurrenceOverrides.set(key, decl);
      continue;
    }
    const pos = decl.pos as Pos;
    if (!decl.lemma || !POS_TAGS.includes(pos)) {
      fail(`gloss "${key}" needs a lemma and a valid pos`);
      continue;
    }
    const eid = declareEntry(decl.lemma, pos, decl);
    localForms[formKey(key)] = { entry: eid, ...(decl.note ? { note: decl.note } : {}) };
  }

  // Multi-word expressions become PHRASE entries matched by text per sentence.
  const mwes: { fr: string; entry: EntryId }[] = [];
  for (const m of fm.mwe ?? []) {
    checkKeys(`mwe "${m.fr ?? "?"}"`, m, MWE_KEYS);
    if (!m.fr?.trim()) {
      fail("mwe entry is missing `fr`");
      continue;
    }
    const lemma = m.lemma?.trim() || m.fr.trim();
    // An MWE has no inflected forms of its own, so its `note` explains the
    // construction and belongs on the entry as a hint.
    const hint = m.hint ?? m.note;
    const eid = declareEntry(lemma, "PHRASE", { en: m.en, ...(hint ? { hint } : {}) });
    mwes.push({ fr: m.fr.trim(), entry: eid });
  }

  const resolveForm = (surface: string): FormRow | undefined =>
    localForms[formKey(surface)] ?? lexicon.forms[formKey(surface)];

  const sentences: Sentence[] = rawSentences.map((s, si) => {
    const tokens = tokenize(s.fr);

    for (const t of tokens) {
      if (t.s !== s.fr.slice(t.start, t.end)) {
        fail(`sentence ${si}: token offsets do not match the sentence text`);
      }
      if (t.k !== "word") continue;

      const override = occurrenceOverrides.get(`${si}:${t.i}`);
      if (override && formKey(override.form ?? "") !== formKey(t.s)) {
        fail(
          `gloss "${si}:${t.i}" expects the word "${override.form ?? "(missing form:)"}" ` +
            `but token ${t.i} of sentence ${si} is "${t.s}" — ` +
            `sentence or token indices have shifted`,
        );
        continue;
      }
      if (override?.entry) {
        t.entry = override.entry;
        if (override.note) t.note = override.note;
        continue;
      }
      if (override?.lemma && POS_TAGS.includes(override.pos as Pos)) {
        t.entry = declareEntry(override.lemma, override.pos as Pos, override);
        if (override.note) t.note = override.note;
        continue;
      }

      const row = resolveForm(t.s);
      if (!row) {
        fail(`sentence ${si}: no gloss for "${t.s}"`, formKey(t.s));
        continue;
      }
      t.entry = row.entry;
      if (row.note) t.note = row.note;
    }

    const spans: Span[] = [];
    for (const m of mwes) {
      const hay = formKey(s.fr);
      const needle = formKey(m.fr);
      let at = hay.indexOf(needle);
      while (at !== -1) {
        const covered = tokens.filter(
          (t) => t.k === "word" && t.start >= at && t.end <= at + needle.length,
        );
        // Only match on whole-token boundaries, so "a" never matches inside "la".
        const startsClean = covered.length > 0 && covered[0]!.start === at;
        const endsClean =
          covered.length > 0 && covered[covered.length - 1]!.end === at + needle.length;
        if (startsClean && endsClean) {
          spans.push({
            from: covered[0]!.i,
            to: covered[covered.length - 1]!.i + 1,
            entry: m.entry,
          });
        }
        at = hay.indexOf(needle, at + 1);
      }
    }
    spans.sort((a, b) => a.from - b.from);
    for (let i = 1; i < spans.length; i++) {
      if (spans[i]!.from < spans[i - 1]!.to) {
        fail(`sentence ${si}: multi-word expressions overlap`);
      }
    }

    return {
      i: si,
      fr: s.fr,
      en: s.en,
      tokens,
      ...(spans.length ? { spans } : {}),
    };
  });

  // Pull every referenced shared entry into the story's own entry map.
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (!t.entry || entries[t.entry]) continue;
      const shared = lexicon.entries[t.entry];
      if (!shared) {
        fail(`entry "${t.entry}" is referenced but not defined in entries.yaml`);
        continue;
      }
      entries[t.entry] = shared;
    }
    for (const sp of s.spans ?? []) {
      if (!entries[sp.entry]) fail(`span entry "${sp.entry}" is not defined`);
    }
  }
  for (const [eid, e] of Object.entries(entries)) {
    if (e.en.length === 0) fail(`entry "${eid}" has no English sense`);
  }

  const wordCount = sentences.reduce((n, s) => n + wordTokens(s.tokens).length, 0);
  if (issues.length > 0) return { story: null, issues };

  if (wordCount < 150 || wordCount > 400) {
    issues.push({
      file: path,
      message: `warning: ${wordCount} words is outside the 150-400 range`,
    });
  }

  const story: Story = {
    schemaVersion: 1,
    id: id!,
    level,
    title: fm.title!.trim(),
    titleEn: fm.titleEn!.trim(),
    topics,
    wordCount,
    sentenceCount: sentences.length,
    readingTimeMin: readingTimeMin(wordCount, level),
    sourceFile: path,
    sourceHash: `sha256:${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`,
    compiledAt: now.toISOString(),
    paragraphs,
    sentences,
    entries,
  };

  return { story, issues };
}
