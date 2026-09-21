import { useState } from "react";

import { Reader } from "./components/Reader.js";
import { STORIES } from "./stories.js";

export function App() {
  const [storyId, setStoryId] = useState(STORIES[0]?.id ?? "");
  const story = STORIES.find((s) => s.id === storyId) ?? STORIES[0];

  if (!story) {
    return <p className="empty">No compiled stories. Run <code>npm run content</code>.</p>;
  }

  return (
    <div className="app">
      <nav className="story-picker" aria-label="Stories">
        {STORIES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`picker-item${s.id === story.id ? " current" : ""}`}
            onClick={() => setStoryId(s.id)}
          >
            <span className="picker-title" lang="fr">{s.title}</span>
            <span className="picker-meta">
              {s.level} · {s.readingTimeMin} min
            </span>
          </button>
        ))}
      </nav>
      <main>
        <Reader story={story} />
      </main>
    </div>
  );
}
