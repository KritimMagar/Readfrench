import { currentStreak, isRead, type Profile, type Progress } from "../lib/progress.js";
import { LEVELS, type Level, type StorySummary } from "../types/story.js";

interface Props {
  stories: StorySummary[];
  profile: Profile;
  progress: Progress;
  /** null means "every level". */
  filter: Level | null;
  onFilter: (level: Level | null) => void;
  onSetLevel: (level: Level) => void;
  onOpen: (id: string) => void;
}

export function Library({
  stories,
  profile,
  progress,
  filter,
  onFilter,
  onSetLevel,
  onOpen,
}: Props) {
  const shown = filter ? stories.filter((s) => s.level === filter) : stories;
  const streak = currentStreak(progress.readDates);
  const readCount = stories.filter((s) => isRead(progress, s.id)).length;

  return (
    <div className="library">
      <header className="library-head">
        <h1>Library</h1>
        <div className="stats">
          <span className="stat">
            <b>{streak}</b> day{streak === 1 ? "" : "s"} streak
          </span>
          <span className="stat">
            <b>{readCount}</b> of {stories.length} read
          </span>
        </div>
      </header>

      <div className="profile-row">
        <label htmlFor="level-select">My level</label>
        <select
          id="level-select"
          value={profile.level}
          onChange={(e) => onSetLevel(e.target.value as Level)}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <span className="profile-hint">
          The library opens at your level. Browse any level below.
        </span>
      </div>

      <div className="filters" role="group" aria-label="Filter by level">
        <button
          type="button"
          className={`chip${filter === null ? " on" : ""}`}
          onClick={() => onFilter(null)}
        >
          All
        </button>
        {LEVELS.map((l) => {
          const count = stories.filter((s) => s.level === l).length;
          return (
            <button
              key={l}
              type="button"
              className={`chip${filter === l ? " on" : ""}${count === 0 ? " none" : ""}`}
              onClick={() => onFilter(l)}
            >
              {l}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="empty">
          No {filter} stories yet. Try another level, or <b>All</b>.
        </p>
      ) : (
        <ul className="story-list">
          {shown.map((s) => {
            const read = isRead(progress, s.id);
            return (
              <li key={s.id}>
                <button type="button" className="story-card" onClick={() => onOpen(s.id)}>
                  <span className="card-top">
                    <span className="level-badge">{s.level}</span>
                    <span className={`read-dot${read ? " read" : ""}`}>
                      {read ? "Read" : "Unread"}
                    </span>
                  </span>
                  <span className="card-title" lang="fr">
                    {s.title}
                  </span>
                  <span className="card-sub">{s.titleEn}</span>
                  <span className="card-meta">
                    {s.topics.map((t) => (
                      <span key={t} className="topic">
                        {t}
                      </span>
                    ))}
                    <span className="card-numbers">
                      {s.wordCount} words · {s.readingTimeMin} min
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
