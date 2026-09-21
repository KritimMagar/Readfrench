import { useEffect, useMemo, useState } from "react";

import { ContextSentence } from "./ContextSentence.js";
import { dueItems, type VocabItem } from "../lib/vocab.js";
import type { GradeName } from "../lib/srs.js";
import type { EntryId } from "../types/story.js";

interface Props {
  deck: VocabItem[];
  onGrade: (entryId: EntryId, grade: GradeName) => void;
  onDone: () => void;
}

const BUTTONS: { name: GradeName; label: string; hint: string }[] = [
  { name: "again", label: "Again", hint: "no idea" },
  { name: "hard", label: "Hard", hint: "slow recall" },
  { name: "good", label: "Good", hint: "recalled" },
  { name: "easy", label: "Easy", hint: "instant" },
];

export function Review({ deck, onGrade, onDone }: Props) {
  // The queue is fixed when review starts: grading changes due dates, and a
  // card whose interval lands back on today should not reappear in this pass.
  const [queue] = useState<EntryId[]>(() => dueItems(deck).map((v) => v.entryId));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const byId = useMemo(() => new Map(deck.map((v) => [v.entryId, v])), [deck]);
  const currentId = queue[position];
  const card = currentId ? byId.get(currentId) : undefined;

  const grade = (name: GradeName) => {
    if (!currentId) return;
    onGrade(currentId, name);
    setRevealed(false);
    setPosition((p) => p + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const index = Number(e.key);
        const button = BUTTONS[index - 1];
        if (button) grade(button.name);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // No dependency array on purpose: the handler closes over the current card
    // and reveal state, and must not go stale between cards.
  });

  if (queue.length === 0 || !card) {
    const reviewed = Math.min(position, queue.length);
    return (
      <div className="review">
        <header className="library-head">
          <h1>Review</h1>
        </header>
        <p className="empty">
          {queue.length === 0
            ? "Nothing is due right now."
            : `Done — ${reviewed} card${reviewed === 1 ? "" : "s"} reviewed.`}
        </p>
        <button type="button" className="finish" onClick={onDone}>
          Back to vocabulary
        </button>
      </div>
    );
  }

  return (
    <div className="review">
      <header className="library-head">
        <h1>Review</h1>
        <div className="stats">
          <span className="stat">
            <b>{position + 1}</b> of {queue.length}
          </span>
        </div>
      </header>

      <div className="card">
        <p className="card-front" lang="fr">
          {card.lemma}
        </p>

        {revealed ? (
          <div className="card-back">
            <p className="card-en">{card.en.join(", ")}</p>
            <div className="card-context">
              <span className="context-label">First met in {card.metStoryTitle}</span>
              <ContextSentence item={card} />
              <p className="context-en">{card.metSentenceEn}</p>
            </div>
          </div>
        ) : (
          <button type="button" className="finish" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}
      </div>

      {revealed && (
        <div className="grades">
          {BUTTONS.map((b, i) => (
            <button
              key={b.name}
              type="button"
              className={`grade grade-${b.name}`}
              onClick={() => grade(b.name)}
            >
              <span className="grade-label">{b.label}</span>
              <span className="grade-hint">
                {i + 1} · {b.hint}
              </span>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="back review-quit" onClick={onDone}>
        End review
      </button>
    </div>
  );
}
