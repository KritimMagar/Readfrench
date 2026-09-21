import type { Token, TokenKind } from "../src/types/story.js";

/**
 * Deterministic French tokenizer. No NLP: every rule here is mechanical, so
 * the same sentence always yields the same tokens and the compiler's gloss
 * keys stay stable across runs.
 */

/** Words where the apostrophe is internal, not an elision boundary. */
const KEEP_WHOLE = new Set([
  "aujourd'hui",
  "quelqu'un",
  "quelqu'une",
  "presqu'ile",
  "presqu'île",
  "prud'homme",
  "prud'hommes",
]);

const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const SPACE = /\s/u;

/** Typographic apostrophes normalise to the straight one for lookups. */
export function normalizeApostrophes(s: string): string {
  return s.replace(/[’ʼ]/g, "'");
}

/** The lookup key for a surface form: lowercased, apostrophes normalised. */
export function formKey(surface: string): string {
  return normalizeApostrophes(surface).toLowerCase();
}

const isLetter = (ch: string | undefined) => ch !== undefined && LETTER.test(ch);
const isDigit = (ch: string | undefined) => ch !== undefined && DIGIT.test(ch);
const isSpace = (ch: string | undefined) => ch !== undefined && SPACE.test(ch);
const isApostrophe = (ch: string | undefined) =>
  ch !== undefined && (ch === "'" || ch === "’" || ch === "ʼ");

export function tokenize(fr: string): Token[] {
  const out: Token[] = [];
  const push = (start: number, end: number, k: TokenKind) => {
    out.push({ i: out.length, start, end, s: fr.slice(start, end), k });
  };

  let i = 0;
  while (i < fr.length) {
    const ch = fr[i];

    if (isSpace(ch)) {
      i++;
      continue;
    }

    if (isLetter(ch)) {
      let j = i + 1;
      while (j < fr.length) {
        if (isLetter(fr[j])) {
          j++;
          continue;
        }
        // An internal hyphen keeps the compound whole: "week-end", "peut-être".
        if (fr[j] === "-" && isLetter(fr[j + 1])) {
          j += 2;
          continue;
        }
        break;
      }

      if (isApostrophe(fr[j])) {
        let k = j + 1;
        while (k < fr.length && isLetter(fr[k])) k++;
        if (KEEP_WHOLE.has(formKey(fr.slice(i, k)))) {
          push(i, k, "word");
          i = k;
          continue;
        }
        // Elision: the apostrophe stays with the clitic — "s'", "n'", "qu'".
        push(i, j + 1, "word");
        i = j + 1;
        continue;
      }

      push(i, j, "word");
      i = j;
      continue;
    }

    // Numerals are inert like punctuation (no dictionary entry), but are
    // scanned on their own so they never merge with adjacent punctuation.
    if (isDigit(ch)) {
      let j = i;
      while (j < fr.length && isDigit(fr[j])) j++;
      push(i, j, "punct");
      i = j;
      continue;
    }

    let j = i;
    while (j < fr.length && !isLetter(fr[j]) && !isDigit(fr[j]) && !isSpace(fr[j])) j++;
    push(i, j, "punct");
    i = j;
  }

  return out;
}

/** Word tokens only — what can be tapped, glossed and counted. */
export function wordTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.k === "word");
}
