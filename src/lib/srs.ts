import { dayKey } from "./progress.js";

/**
 * SM-2, as published by Piotr Wozniak.
 *
 * Per repetition the grade q (0-5) updates the easiness factor:
 *   EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))   floored at 1.3
 * and the interval:
 *   n = 1 -> 1 day, n = 2 -> 6 days, otherwise round(previous * EF')
 * A grade below 3 is a lapse: repetitions restart, but the EF penalty is kept,
 * so a word that keeps failing comes back faster each time.
 */

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

/** What the review buttons mean, in SM-2 grades. */
export const GRADES = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
} as const;

export type GradeName = keyof typeof GRADES;
export type Grade = (typeof GRADES)[GradeName];

export interface SrsState {
  /** Easiness factor. */
  ease: number;
  /** Days until the next review. */
  intervalDays: number;
  /** Successful repetitions in a row. */
  reps: number;
  /** How many times this card has been failed. */
  lapses: number;
  /** Local calendar day (YYYY-MM-DD) the card is next due. */
  dueAt: string;
}

export function newCard(today = dayKey()): SrsState {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    // A brand new word is due immediately.
    dueAt: today,
  };
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

function nextEase(ease: number, grade: Grade): number {
  const q = grade;
  const updated = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MIN_EASE, Number(updated.toFixed(4)));
}

export function review(state: SrsState, grade: Grade, today = dayKey()): SrsState {
  const ease = nextEase(state.ease, grade);

  if (grade < 3) {
    return {
      ease,
      intervalDays: 1,
      reps: 0,
      lapses: state.lapses + 1,
      dueAt: addDays(today, 1),
    };
  }

  const reps = state.reps + 1;
  const intervalDays =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, Math.round(state.intervalDays * ease));

  return {
    ease,
    intervalDays,
    reps,
    lapses: state.lapses,
    dueAt: addDays(today, intervalDays),
  };
}

export const isDue = (state: SrsState, today = dayKey()): boolean => state.dueAt <= today;
