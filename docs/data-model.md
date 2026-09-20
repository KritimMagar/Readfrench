# Story data model

Status: **proposed, awaiting sign-off.** No UI code is written yet.

This document defines how a story is authored, how it is compiled, and what the
reader consumes at runtime. Everything in steps 2-5 of the build order (library,
vocabulary, audio, quizzes) hangs off this model, so it is worth getting right
before any component exists.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Tap-to-translate is a stateful UI; types keep the token/gloss contract honest end to end. |
| Content | Markdown + YAML frontmatter, compiled to JSON | Adding a story is adding one file, per your requirement. |
| Compiler | Small TypeScript script run via `tsx`, output to `content/dist/` | Runs in CI; a bad content file fails the build, not the reader. |
| Backend | Fastify + SQLite (better-sqlite3, Drizzle) | Added in step 3, when vocabulary gives it something to store. |
| TTS | Web Speech API | Step 4. Token `start`/`end` offsets below make word highlighting free. |
| Tests | Vitest | Tokenizer and compiler are pure functions — cheap to pin down. |

**Step 1 ships no backend.** The reader loads compiled JSON straight from the
bundle. Nothing in the model below assumes a server, and nothing has to change
when one arrives.

## The central decision: glosses are precomputed, not looked up at runtime

Tapping a word must return three things: an English translation, the lemma, and
a part of speech. There are two ways to get them.

1. **Runtime lookup** — ship a dictionary, tokenize and lemmatize in the browser.
2. **Compile time** — resolve every word once, when the story is added, and ship
   the answers alongside the text.

This model uses (2), because French makes (1) unreliable in exactly the places a
beginner needs help:

- **Homographs.** `est` is *is* (être) or *east* (noun). `a` is *has* or *to*.
  Only context disambiguates, and a browser-side lemmatizer will not.
- **Idioms.** `il y a` is *there is*, not *he there has*. `a deux ans` is *is two
  years old*, not *has two years*. Per-word glosses are actively wrong here.
- **Elision.** `s'appelle`, `n'aime`, `c'est` must split; `aujourd'hui` must not.

Precomputing also makes popups instant and offline, and makes glosses
reviewable in a diff. The cost is that each story needs its new words glossed —
mitigated by a shared lexicon that grows as the corpus does, and by a compiler
that fails the build listing exactly which forms are missing.

## Layer 1: the authored file

`content/stories/<level>/<slug>.md`, one story per file. See
`content/stories/a1/le-chat-de-marie.md` for the real thing.

```markdown
---
id: le-chat-de-marie
title: Le chat de Marie
titleEn: Marie's Cat
level: A1
topics: [animals, daily-life]
source: original
gloss:                      # story-local overrides, beat the shared lexicon
  minuit:
    lemma: Minuit
    pos: PROPN
    en: Midnight
    hint: the cat's name
mwe:                        # multi-word expressions, matched by text
  - fr: il y a
    en: there is, there are
  - fr: a deux ans
    en: is two years old
    note: avoir + number + ans, where English uses "to be"
---

Marie habite à Lyon.
> Marie lives in Lyon.
Elle a un petit chat noir.
> She has a little black cat.

Le matin, Marie donne du lait et du poisson à son chat.
> In the morning, Marie gives her cat milk and fish.
```

Body rules, kept deliberately boring:

- One French sentence per line. The line **is** the unit the reader renders.
- Its English translation on the next line, as a blockquote (`> `).
- A blank line is a paragraph break. Paragraphs are visual grouping only.
- No other markdown. Stories are prose, not documents.

This format is diff-friendly (changing one sentence touches two lines), readable
as plain text, and needs no editor tooling to contribute to.

## Layer 2: the compiled story

The compiler emits one self-contained JSON file per story to
`content/dist/<id>.json`. Self-contained means the reader does one fetch and
needs no lookup logic beyond `story.entries[token.entry]`.

A real example, generated from the story above, lives at
`docs/examples/le-chat-de-marie.compiled.json` (trimmed to 5 of 28 sentences).

```ts
export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Topic =
  | "animals" | "city" | "culture" | "daily-life" | "family" | "food"
  | "health" | "history" | "nature" | "news" | "science" | "sport"
  | "technology" | "travel" | "work";

/** Universal Dependencies tags, plus PHRASE for multi-word entries. */
export type Pos =
  | "NOUN" | "PROPN" | "VERB" | "AUX" | "ADJ" | "ADV" | "PRON" | "DET"
  | "ADP" | "CCONJ" | "SCONJ" | "NUM" | "INTJ" | "PART" | "PHRASE";

/** `${lemma}|${pos}` — e.g. "habiter|VERB". The unit vocabulary saves. */
export type EntryId = string;

/** A lexeme: dictionary-form facts, independent of any occurrence. */
export interface LexEntry {
  lemma: string;
  pos: Pos;
  en: string[];             // ordered, most common sense first
  gender?: "m" | "f";       // nouns
  hint?: string;            // short usage or culture note
}

export type TokenKind = "word" | "punct";

export interface Token {
  i: number;                // index within the sentence
  start: number;            // char offset into Sentence.fr, inclusive
  end: number;              // char offset into Sentence.fr, exclusive
  s: string;                // surface form, === fr.slice(start, end)
  k: TokenKind;
  entry?: EntryId;          // required on `word`, absent on `punct`
  note?: string;            // inflection of this form: "present, il/elle"
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
  sourceHash: string;       // detects stale compiled output in CI
  compiledAt: string;       // ISO 8601
  paragraphs: Paragraph[];
  sentences: Sentence[];
  entries: Record<EntryId, LexEntry>;   // only the ones this story uses
  quiz?: QuizQuestion[];    // step 5; absent until then
}
```

### Why character offsets instead of stored whitespace

Each token carries `start`/`end` rather than a copy of its trailing space. Three
things fall out of that:

- **Faithful rendering.** French puts a space before `:` `;` `!` `?` and inside
  `« »`. The renderer slices the gaps between tokens, so the line reproduces
  exactly, with no punctuation-spacing rules in the UI.
- **TTS highlighting for free.** `SpeechSynthesisUtterance.onboundary` reports a
  `charIndex`. Finding the token is a range check — no re-tokenizing at runtime.
- **One source of truth.** `s` is derived from `fr`; a compiler test asserts
  `fr.slice(start, end) === s` for every token, so drift is impossible.

### Tokenizer rules

Deterministic, no NLP, ~40 lines. Verified against the real story:

| Input | Tokens | Rule |
| --- | --- | --- |
| `Marie habite à Lyon.` | `Marie` `habite` `à` `Lyon` `.` | Words are letter runs (accents included); punctuation is its own token. |
| `s'appelle` | `s'` `appelle` | Elision splits, apostrophe stays with the clitic — `s'` glosses as reflexive *se*. |
| `n'aime` | `n'` `aime` | Same, so the negation is tappable on its own. |
| `Aujourd'hui` | `Aujourd'hui` | Exception list: apostrophe is internal, not elision. |
| `week-end` | `week-end` | Hyphens do not split; the compound is one dictionary word. |
| `toujours : «` | `toujours` `:` `«` | Punctuation separate, spacing preserved via offsets. |

Punctuation tokens are inert — not tappable, never saved to vocabulary.

### Gloss resolution, and what a tap returns

Compile-time resolution order, first match wins:

1. Occurrence override — `gloss: { "3:5": ... }`, sentence:token, for a
   homograph one specific time.
2. Story-local `gloss` by lowercased surface form.
3. Shared lexicon `content/lexicon/forms.yaml` by lowercased surface form.

MWEs from `mwe` are matched by text against each sentence and emitted as `spans`.
The compiled token carries its already-resolved `entry` and `note`, so the
runtime does no resolution at all:

```ts
function resolveTap(story: Story, sentence: Sentence, tokenIndex: number) {
  const token = sentence.tokens[tokenIndex];
  if (token.k !== "word") return null;

  const span = sentence.spans?.find(s => tokenIndex >= s.from && tokenIndex < s.to);

  return {
    surface: token.s,                                    // "a"
    primary: story.entries[span?.entry ?? token.entry!], // "avoir ... ans" -> is two years old
    literal: span ? story.entries[token.entry!] : null,  // avoir -> to have
    note: token.note,                                    // "present, il/elle"
  };
}
```

The popup shows `primary` (translation, lemma, POS), `note` when present, and
`literal` as a secondary line inside an idiom — so tapping `a` in *Minuit a deux
ans* teaches the idiom without hiding that the verb is `avoir`. Saving to
vocabulary saves `primary`'s `EntryId`.

### Two layers of lexicon

- `content/lexicon/forms.yaml` — inflected form → `{ entry, note }`.
  `habite: { entry: habiter|VERB, note: "present, il/elle" }`
- `content/lexicon/entries.yaml` — `EntryId` → `LexEntry`.

Splitting them means `vais`, `allais` and `irai` all point at `aller|VERB`, which
is what makes the flashcard deck in step 3 deduplicate correctly: one card for
*aller*, not three for three conjugations.

## Validation — the build fails, loudly

The compiler is the only quality gate content has, so it is strict:

- Every `word` token resolves to an entry. Unglossed forms are listed with file,
  sentence and token, and the build fails. Half-glossed stories cannot ship.
- Every French line has exactly one English line.
- Every `EntryId` referenced by a token or span exists in `entries`.
- Spans do not overlap and cover only `word` tokens.
- `fr.slice(start, end) === s` for every token.
- `id` is unique across the corpus and matches the filename.
- `level` and every `topics` value are in the unions above.
- Warn, don't fail, when `wordCount` is outside 150-400.

`readingTimeMin = max(1, round(wordCount / wpm[level]))`, with
`wpm = { A1: 60, A2: 80, B1: 100, B2: 130, C1: 160, C2: 190 }` — learner reading
speeds, not native ones. *Le chat de Marie*: 178 words at A1 → 3 min.

## How later steps attach

Sketched to show the model does not need reworking, not to be built now.

**Library (step 2)** reads a generated `content/dist/index.json` — one entry per
story with `id`, `level`, `title`, `titleEn`, `topics`, `wordCount`,
`readingTimeMin`. Level filtering never touches story bodies.

**Vocabulary (step 3)** keys on `EntryId` and snapshots its context:

```ts
interface VocabItem {
  id: string;
  entryId: EntryId;          // dedup key with userId
  lemma: string; pos: Pos; en: string[];
  metSurface: string;        // what they actually tapped: "vais"
  metStoryId: string;
  metSentenceIndex: number;
  metSentenceFr: string;     // snapshot, not a pointer
  metSentenceEn: string;
  createdAt: string;
  srs: { ease: number; intervalDays: number; reps: number; lapses: number; dueAt: string };
}
```

The sentence is **copied, not referenced**. Content files get edited and offsets
shift; "the sentence I first met this word in" should not silently change under
a flashcard six weeks later.

**Audio (step 4)** needs nothing new: `Sentence.fr` is the utterance, token
offsets drive highlighting.

**Quizzes (step 5)** add `quiz?: QuizQuestion[]` to the same authored file, as a
frontmatter block — `{ q, options[4], answer, explanationEn }`.

## Open questions

1. **Gloss depth for function words.** Do you want `le`, `de`, `à` tappable with
   full glosses, or greyed out as noise once a learner is past A1? Currently
   everything is tappable.
2. **Authoring the lexicon.** For three A1 stories I can write `forms.yaml` by
   hand (~250 forms). Beyond that it wants a seed dictionary. Fine to defer.
3. **English translation register.** I translated fairly literally, to stay
   useful as a crutch. Idiomatic-but-looser is also defensible.
