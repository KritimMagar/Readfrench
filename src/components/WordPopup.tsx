import { useEffect, useRef } from "react";
import type { TapResult } from "../types/story.js";

interface Props {
  tap: TapResult;
  /** Viewport coordinates of the tapped word. */
  anchor: { x: number; y: number };
  onClose: () => void;
}

const POS_LABEL: Record<string, string> = {
  NOUN: "noun",
  PROPN: "proper noun",
  VERB: "verb",
  AUX: "auxiliary",
  ADJ: "adjective",
  ADV: "adverb",
  PRON: "pronoun",
  DET: "determiner",
  ADP: "preposition",
  CCONJ: "conjunction",
  SCONJ: "conjunction",
  NUM: "number",
  INTJ: "interjection",
  PART: "particle",
  PHRASE: "expression",
};

export function WordPopup({ tap, anchor, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { primary, literal, surface, note } = tap;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the popup on screen near the word, clamped to the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, anchor.x - box.width / 2),
      window.innerWidth - box.width - margin,
    );
    const above = anchor.y - box.height - 12;
    const top = above > margin ? above : anchor.y + 28;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [anchor, tap]);

  const gender = primary.gender === "m" ? "le" : primary.gender === "f" ? "la" : null;

  return (
    <div ref={ref} className="popup" role="dialog" aria-label={`Translation of ${surface}`}>
      <div className="popup-head">
        <span className="popup-surface">{surface}</span>
        <button className="popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <p className="popup-en">{primary.en.join(", ")}</p>

      <dl className="popup-meta">
        <div>
          <dt>Dictionary form</dt>
          <dd>
            {gender && <span className="popup-gender">{gender} </span>}
            {primary.lemma}
          </dd>
        </div>
        <div>
          <dt>Part of speech</dt>
          <dd>{POS_LABEL[primary.pos] ?? primary.pos.toLowerCase()}</dd>
        </div>
        {note && (
          <div>
            <dt>This form</dt>
            <dd>{note}</dd>
          </div>
        )}
      </dl>

      {primary.hint && <p className="popup-hint">{primary.hint}</p>}

      {literal && (
        <p className="popup-literal">
          Part of an expression. On its own, <b>{surface}</b>{" "}
          {literal.lemma.toLowerCase() === surface.toLowerCase() ? (
            <>means {literal.en.join(", ")}.</>
          ) : (
            <>
              is <i>{literal.lemma}</i> — {literal.en.join(", ")}.
            </>
          )}
        </p>
      )}
    </div>
  );
}
