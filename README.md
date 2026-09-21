# ReadFrench

A CEFR-graded French reader for English speakers. Tap any word for its
translation, dictionary form and part of speech.

**Status:** steps 1-3 of 5.

- **Reader** — one sentence per line, tap any word for its translation,
  dictionary form and part of speech; per-sentence English toggle.
- **Library** — four stories (three A1, one A2), level filtering that opens at
  your profile level, read/unread tracking and a day streak.
- **Vocabulary** — tapped words are saved automatically, deduplicated by
  lexeme, each shown in the sentence it was first met in.
- **Review** — French-to-English flashcards scheduled by SM-2, graded with
  Again / Hard / Good / Easy (or keys 1-4).

Audio and quizzes are not built yet.

## Running it

```bash
npm install
npm run dev      # compiles content, then serves at :5173
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run content` | Compiles `content/stories/**/*.md` to `content/dist/*.json` |
| `npm test` | Tokenizer and compiler tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Compiles content, typechecks, then builds the site |

## Layout

```
content/
  stories/<level>/*.md   authored stories: frontmatter + sentence/translation pairs
  lexicon/forms.yaml     inflected form -> lexeme, plus how it is inflected
  lexicon/entries.yaml   lexeme -> English senses, gender, usage hints
  dist/                  compiled JSON (generated, not committed)
tools/
  tokenize.ts            deterministic French tokenizer
  content.ts             frontmatter parsing, gloss resolution, validation
  compile.ts             CLI: content/ -> content/dist/
src/
  types/story.ts         the data model, shared by compiler and reader
  lib/progress.ts        profile, read tracking and streak (pure)
  lib/srs.ts             SM-2 scheduling (pure)
  lib/vocab.ts           the deck: saving, dedup by lexeme, due queue (pure)
  lib/route.ts           hash routing between views
  storage.ts             the only module that touches localStorage
  components/            Library, Reader, SentenceLine, WordPopup,
                         Vocabulary, Review, ContextSentence
docs/data-model.md       the design, and why glosses are precomputed
```

## Adding a story

1. Drop a markdown file in `content/stories/<level>/`. One French sentence per
   line, its English translation on the next line as `> `, blank line between
   paragraphs.
2. Run `npm run content`. Any word without a gloss fails the build and is
   listed in a form ready to paste into `content/lexicon/forms.yaml`.
3. Fill in the missing forms and re-run.

Quote any YAML value containing a comma — inside `{ }` a bare comma splits the
row. The compiler rejects the leftovers rather than shipping them.

See `docs/data-model.md` for the story data model and the reasoning behind it.
