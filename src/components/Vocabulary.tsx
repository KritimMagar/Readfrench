import { ContextSentence } from "./ContextSentence.js";
import { dueItems, type VocabItem } from "../lib/vocab.js";
import type { EntryId } from "../types/story.js";

interface Props {
  deck: VocabItem[];
  onRemove: (entryId: EntryId) => void;
  onReview: () => void;
}

export function Vocabulary({ deck, onRemove, onReview }: Props) {
  const due = dueItems(deck);
  const sorted = [...deck].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="vocabulary">
      <header className="library-head">
        <h1>Vocabulary</h1>
        <div className="stats">
          <span className="stat">
            <b>{deck.length}</b> word{deck.length === 1 ? "" : "s"}
          </span>
          <span className="stat">
            <b>{due.length}</b> due
          </span>
        </div>
      </header>

      {deck.length === 0 ? (
        <p className="empty">
          No words yet. Tap any word while reading and it is saved here.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="finish review-cta"
            onClick={onReview}
            disabled={due.length === 0}
          >
            {due.length > 0 ? `Review ${due.length} due` : "Nothing due today"}
          </button>

          <ul className="vocab-list">
            {sorted.map((item) => (
              <li key={item.entryId} className="vocab-item">
                <div className="vocab-head">
                  <span className="vocab-lemma" lang="fr">
                    {item.lemma}
                  </span>
                  <span className="vocab-pos">{item.pos.toLowerCase()}</span>
                  <button
                    type="button"
                    className="vocab-remove"
                    onClick={() => onRemove(item.entryId)}
                    aria-label={`Remove ${item.lemma}`}
                  >
                    ×
                  </button>
                </div>
                <p className="vocab-en">{item.en.join(", ")}</p>
                <ContextSentence item={item} />
                <p className="vocab-meta">
                  met as <b lang="fr">{item.metSurface}</b> in{" "}
                  <span lang="fr">{item.metStoryTitle}</span> · due {item.srs.dueAt}
                  {item.srs.reps > 0 && ` · ${item.srs.reps} rep${item.srs.reps === 1 ? "" : "s"}`}
                  {item.srs.lapses > 0 && ` · ${item.srs.lapses} lapse${item.srs.lapses === 1 ? "" : "s"}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
