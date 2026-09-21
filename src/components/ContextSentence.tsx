import type { VocabItem } from "../lib/vocab.js";

/**
 * The sentence a word was first met in, with that word marked. Offsets were
 * captured at save time alongside the sentence copy, so they always agree.
 */
export function ContextSentence({ item }: { item: VocabItem }) {
  const { metSentenceFr, metStart, metEnd } = item;
  const valid = metStart >= 0 && metEnd <= metSentenceFr.length && metStart < metEnd;

  return (
    <p className="context-fr" lang="fr">
      {valid ? (
        <>
          {metSentenceFr.slice(0, metStart)}
          <mark>{metSentenceFr.slice(metStart, metEnd)}</mark>
          {metSentenceFr.slice(metEnd)}
        </>
      ) : (
        metSentenceFr
      )}
    </p>
  );
}
