import { useEffect, useMemo, useState } from "react";

import { Library } from "./components/Library.js";
import { Reader } from "./components/Reader.js";
import { Review } from "./components/Review.js";
import { Vocabulary } from "./components/Vocabulary.js";
import { useRoute, type Route } from "./lib/route.js";
import {
  isRead,
  markRead,
  markUnread,
  type Profile,
  type Progress,
} from "./lib/progress.js";
import { GRADES, type GradeName } from "./lib/srs.js";
import { addItem, dueItems, gradeItem, removeItem, type VocabItem } from "./lib/vocab.js";
import {
  loadProfile,
  loadProgress,
  loadVocab,
  saveProfile,
  saveProgress,
  saveVocab,
} from "./storage.js";
import { STORIES, SUMMARIES } from "./stories.js";
import type { EntryId, Level } from "./types/story.js";

export function App() {
  const [route, navigate] = useRoute();
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [deck, setDeck] = useState<VocabItem[]>(loadVocab);
  // The library opens at the reader's level, but is free to browse after that.
  const [filter, setFilter] = useState<Level | null>(() => loadProfile().level);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveVocab(deck), [deck]);

  const savedIds = useMemo(
    () => new Set<EntryId>(deck.map((v) => v.entryId)),
    [deck],
  );
  const dueCount = useMemo(() => dueItems(deck).length, [deck]);

  const setLevel = (level: Level) => {
    setProfile({ level });
    setFilter(level);
  };

  const nav = (current: Route["name"]) => (
    <nav className="top-nav" aria-label="Sections">
      <button
        type="button"
        className={`nav-item${current === "library" || current === "story" ? " on" : ""}`}
        onClick={() => navigate({ name: "library" })}
      >
        Library
      </button>
      <button
        type="button"
        className={`nav-item${current === "vocabulary" || current === "review" ? " on" : ""}`}
        onClick={() => navigate({ name: "vocabulary" })}
      >
        Vocabulary
        {deck.length > 0 && <span className="nav-count">{deck.length}</span>}
      </button>
      {dueCount > 0 && (
        <button type="button" className="nav-due" onClick={() => navigate({ name: "review" })}>
          {dueCount} due
        </button>
      )}
    </nav>
  );

  if (STORIES.length === 0) {
    return (
      <p className="empty">
        No compiled stories. Run <code>npm run content</code>.
      </p>
    );
  }

  if (route.name === "story") {
    const story = STORIES.find((s) => s.id === route.id);
    if (!story) {
      return (
        <div className="app">
          {nav(route.name)}
          <p className="empty">
            No story called <code>{route.id}</code>.{" "}
            <button type="button" className="link" onClick={() => navigate({ name: "library" })}>
              Back to the library
            </button>
          </p>
        </div>
      );
    }
    return (
      <div className="app">
        {nav(route.name)}
        <Reader
          story={story}
          read={isRead(progress, story.id)}
          savedIds={savedIds}
          onBack={() => navigate({ name: "library" })}
          onToggleRead={() =>
            setProgress((p) =>
              isRead(p, story.id) ? markUnread(p, story.id) : markRead(p, story.id),
            )
          }
          onSaveWord={(item) => setDeck((d) => addItem(d, item))}
          onRemoveWord={(entryId) => setDeck((d) => removeItem(d, entryId))}
        />
      </div>
    );
  }

  if (route.name === "vocabulary") {
    return (
      <div className="app">
        {nav(route.name)}
        <Vocabulary
          deck={deck}
          onRemove={(entryId) => setDeck((d) => removeItem(d, entryId))}
          onReview={() => navigate({ name: "review" })}
        />
      </div>
    );
  }

  if (route.name === "review") {
    return (
      <div className="app">
        {nav(route.name)}
        <Review
          deck={deck}
          onGrade={(entryId: EntryId, grade: GradeName) =>
            setDeck((d) => gradeItem(d, entryId, GRADES[grade]))
          }
          onDone={() => navigate({ name: "vocabulary" })}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {nav(route.name)}
      <Library
        stories={SUMMARIES}
        profile={profile}
        progress={progress}
        filter={filter}
        onFilter={setFilter}
        onSetLevel={setLevel}
        onOpen={(id) => navigate({ name: "story", id })}
      />
    </div>
  );
}
