import { useCallback, useEffect, useState } from "react";

import { resolveTap, type Story, type TapResult } from "../types/story.js";
import { SentenceLine } from "./SentenceLine.js";
import { WordPopup } from "./WordPopup.js";

interface Selection {
  sentence: number;
  token: number;
  tap: TapResult;
  anchor: { x: number; y: number };
}

export function Reader({ story }: { story: Story }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [allRevealed, setAllRevealed] = useState(false);

  // Reset per-story state when the reader switches stories.
  useEffect(() => {
    setSelection(null);
    setRevealed(new Set());
    setAllRevealed(false);
  }, [story.id]);

  const tapWord = useCallback(
    (sentenceIndex: number, tokenIndex: number, el: HTMLElement) => {
      const sentence = story.sentences[sentenceIndex];
      if (!sentence) return;
      const tap = resolveTap(story, sentence, tokenIndex);
      if (!tap) return;
      const box = el.getBoundingClientRect();
      setSelection({
        sentence: sentenceIndex,
        token: tokenIndex,
        tap,
        anchor: { x: box.left + box.width / 2, y: box.top },
      });
    },
    [story],
  );

  const toggleSentence = useCallback((i: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const toggleAll = () => {
    const next = !allRevealed;
    setAllRevealed(next);
    setRevealed(next ? new Set(story.sentences.map((s) => s.i)) : new Set());
  };

  return (
    <div className="reader" onClick={(e) => {
      // A tap on the page background dismisses the popup; taps on a word or
      // inside the popup stop short of here.
      if (e.target === e.currentTarget) setSelection(null);
    }}>
      <header className="story-head">
        <h1 lang="fr">{story.title}</h1>
        <p className="story-sub">
          <span className="level-badge">{story.level}</span>
          <span>{story.titleEn}</span>
          <span>·</span>
          <span>{story.wordCount} words</span>
          <span>·</span>
          <span>{story.readingTimeMin} min</span>
        </p>
        <button type="button" className="reveal-all" onClick={toggleAll}>
          {allRevealed ? "Hide all translations" : "Show all translations"}
        </button>
      </header>

      {story.paragraphs.map((p, pi) => (
        <section key={pi} className="paragraph">
          {story.sentences.slice(p.from, p.to).map((s) => (
            <SentenceLine
              key={s.i}
              sentence={s}
              showTranslation={revealed.has(s.i)}
              onToggleTranslation={() => toggleSentence(s.i)}
              selectedToken={selection?.sentence === s.i ? selection.token : null}
              onTapWord={(tokenIndex, el) => tapWord(s.i, tokenIndex, el)}
            />
          ))}
        </section>
      ))}

      {selection && (
        <WordPopup
          tap={selection.tap}
          anchor={selection.anchor}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
