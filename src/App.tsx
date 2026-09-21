import { useEffect, useState } from "react";

import { Library } from "./components/Library.js";
import { Reader } from "./components/Reader.js";
import { useRoute } from "./lib/route.js";
import {
  isRead,
  markRead,
  markUnread,
  type Profile,
  type Progress,
} from "./lib/progress.js";
import { loadProfile, loadProgress, saveProfile, saveProgress } from "./storage.js";
import { STORIES, SUMMARIES } from "./stories.js";
import type { Level } from "./types/story.js";

export function App() {
  const [route, navigate] = useRoute();
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // The library opens at the reader's level, but is free to browse after that.
  const [filter, setFilter] = useState<Level | null>(() => loadProfile().level);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveProgress(progress), [progress]);

  const setLevel = (level: Level) => {
    setProfile({ level });
    setFilter(level);
  };

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
        <Reader
          story={story}
          read={isRead(progress, story.id)}
          onBack={() => navigate({ name: "library" })}
          onToggleRead={() =>
            setProgress((p) =>
              isRead(p, story.id) ? markUnread(p, story.id) : markRead(p, story.id),
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="app">
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
