import type { Sentence } from "../types/story.js";

interface Props {
  sentence: Sentence;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  selectedToken: number | null;
  onTapWord: (tokenIndex: number, el: HTMLElement) => void;
}

export function SentenceLine({
  sentence,
  showTranslation,
  onToggleTranslation,
  selectedToken,
  onTapWord,
}: Props) {
  const spanCovers = (i: number) =>
    sentence.spans?.some((s) => i >= s.from && i < s.to) ?? false;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const t of sentence.tokens) {
    // The gap between tokens is sliced straight from the sentence, so French
    // spacing (before : ; ! ? and inside « ») survives untouched.
    if (t.start > cursor) {
      parts.push(<span key={`gap-${t.i}`}>{sentence.fr.slice(cursor, t.start)}</span>);
    }
    cursor = t.end;

    if (t.k !== "word") {
      parts.push(<span key={t.i}>{t.s}</span>);
      continue;
    }

    const classes = ["word"];
    if (spanCovers(t.i)) classes.push("in-phrase");
    if (selectedToken === t.i) classes.push("selected");

    parts.push(
      <button
        key={t.i}
        type="button"
        className={classes.join(" ")}
        onClick={(e) => onTapWord(t.i, e.currentTarget)}
      >
        {t.s}
      </button>,
    );
  }
  if (cursor < sentence.fr.length) {
    parts.push(<span key="gap-end">{sentence.fr.slice(cursor)}</span>);
  }

  return (
    <div className="sentence">
      <div className="sentence-row">
        <p className="fr" lang="fr">
          {parts}
        </p>
        <button
          type="button"
          className={`translate-toggle${showTranslation ? " on" : ""}`}
          onClick={onToggleTranslation}
          aria-expanded={showTranslation}
          aria-label={showTranslation ? "Hide English" : "Show English"}
          title={showTranslation ? "Hide English" : "Show English"}
        >
          EN
        </button>
      </div>
      {showTranslation && (
        <p className="en" lang="en">
          {sentence.en}
        </p>
      )}
    </div>
  );
}
