#!/usr/bin/env tsx
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { Story, StorySummary } from "../src/types/story.js";
import { compileStory, loadLexicon, type CompileIssue } from "./content.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const STORY_DIR = join(ROOT, "content/stories");
const DIST = join(ROOT, "content/dist");
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function findStories(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...findStories(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

const lexicon = loadLexicon(
  join(ROOT, "content/lexicon/forms.yaml"),
  join(ROOT, "content/lexicon/entries.yaml"),
);

const files = findStories(STORY_DIR);
const stories: Story[] = [];
const errors: CompileIssue[] = [];
const warnings: CompileIssue[] = [];
const missing = new Set<string>();

for (const file of files) {
  const rel = relative(ROOT, file);
  const { story, issues } = compileStory(rel, readFileSync(file, "utf8"), lexicon);
  for (const issue of issues) {
    if (issue.missingForm) missing.add(issue.missingForm);
    (issue.message.startsWith("warning:") ? warnings : errors).push(issue);
  }
  if (story) stories.push(story);
}

const seen = new Map<string, string>();
for (const s of stories) {
  const prev = seen.get(s.id);
  if (prev) errors.push({ file: s.sourceFile, message: `duplicate story id "${s.id}" (also in ${prev})` });
  seen.set(s.id, s.sourceFile);
}

for (const w of warnings) console.warn(`  ${w.file}: ${w.message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} content error(s):\n`);
  for (const e of errors) console.error(`  ${e.file}: ${e.message}`);
  if (missing.size > 0) {
    console.error(
      `\n${missing.size} form(s) need glossing. Paste into content/lexicon/forms.yaml:\n`,
    );
    for (const f of [...missing].sort()) console.error(`${f}: { entry: "?|?" }`);
  }
  console.error("");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });
for (const s of stories) {
  writeFileSync(join(DIST, `${s.id}.json`), `${JSON.stringify(s)}\n`);
}

const index: StorySummary[] = stories
  .map((s) => ({
    id: s.id,
    level: s.level,
    title: s.title,
    titleEn: s.titleEn,
    topics: s.topics,
    wordCount: s.wordCount,
    readingTimeMin: s.readingTimeMin,
  }))
  .sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
      a.title.localeCompare(b.title, "fr"),
  );
writeFileSync(join(DIST, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

const words = stories.reduce((n, s) => n + s.wordCount, 0);
console.log(
  `compiled ${stories.length} stories, ${words} words, ` +
    `${new Set(stories.flatMap((s) => Object.keys(s.entries))).size} distinct entries`,
);
