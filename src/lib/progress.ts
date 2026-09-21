import type { Level } from "../types/story.js";

/**
 * Reading progress and profile. Pure functions here; persistence lives in
 * src/storage.ts so the same shapes can move behind the API in step 3.
 */

export interface Profile {
  level: Level;
}

export interface Progress {
  /** Story ids the reader has finished. */
  read: string[];
  /** Local calendar days (YYYY-MM-DD) on which a story was finished. */
  readDates: string[];
}

export const emptyProgress = (): Progress => ({ read: [], readDates: [] });

/** Local calendar day, not UTC — a streak should follow the reader's clock. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  // Constructing from parts and stepping by date keeps DST transitions honest.
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

/**
 * Consecutive days ending today, or ending yesterday if today has no reading
 * yet — so a streak is not reported as broken until a day is actually missed.
 */
export function currentStreak(readDates: readonly string[], today = dayKey()): number {
  const days = new Set(readDates);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export function markRead(progress: Progress, storyId: string, today = dayKey()): Progress {
  return {
    read: progress.read.includes(storyId) ? progress.read : [...progress.read, storyId],
    readDates: progress.readDates.includes(today)
      ? progress.readDates
      : [...progress.readDates, today].sort(),
  };
}

export function markUnread(progress: Progress, storyId: string): Progress {
  // Only the story reverts; the day it was read still counts towards the
  // streak, because the reading did happen.
  return { ...progress, read: progress.read.filter((id) => id !== storyId) };
}

export const isRead = (progress: Progress, storyId: string): boolean =>
  progress.read.includes(storyId);
