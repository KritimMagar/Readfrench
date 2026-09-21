import { emptyProgress, type Profile, type Progress } from "./lib/progress.js";
import { LEVELS, type Level } from "./types/story.js";

/**
 * Browser-local persistence. Step 3 swaps the bodies of these four functions
 * for API calls; nothing else in the app touches storage directly.
 */

const PROFILE_KEY = "readfrench.profile.v1";
const PROGRESS_KEY = "readfrench.progress.v1";

const DEFAULT_PROFILE: Profile = { level: "A1" };

/** Storage throws in private mode and some embedded webviews. */
function readJson<T>(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A reader with storage disabled still gets a working session, just not a
    // durable one.
  }
}

export function loadProfile(): Profile {
  const raw = readJson<Profile>(PROFILE_KEY);
  const level = (raw as Profile | null)?.level;
  return LEVELS.includes(level as Level) ? { level: level as Level } : DEFAULT_PROFILE;
}

export function saveProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, profile);
}

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function loadProgress(): Progress {
  const raw = readJson<Progress>(PROGRESS_KEY) as Partial<Progress> | null;
  if (!raw) return emptyProgress();
  return {
    read: stringArray(raw.read),
    readDates: stringArray(raw.readDates).sort(),
  };
}

export function saveProgress(progress: Progress): void {
  writeJson(PROGRESS_KEY, progress);
}
