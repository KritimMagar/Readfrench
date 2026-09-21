import type { Story, StorySummary } from "./types/story.js";

/**
 * Compiled stories are generated into content/dist by `npm run content` and
 * pulled in eagerly — step 1 has three A1 stories, so there is nothing to gain
 * from lazy loading yet.
 */
const modules = import.meta.glob<Story>("../content/dist/*.json", {
  eager: true,
  import: "default",
});

export const STORIES: Story[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith("index.json"))
  .map(([, story]) => story)
  .sort((a, b) => a.title.localeCompare(b.title, "fr"));

export const SUMMARIES: StorySummary[] = STORIES.map((s) => ({
  id: s.id,
  level: s.level,
  title: s.title,
  titleEn: s.titleEn,
  topics: s.topics,
  wordCount: s.wordCount,
  readingTimeMin: s.readingTimeMin,
}));
