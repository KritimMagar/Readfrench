import { describe, expect, it } from "vitest";

import {
  DEFAULT_EASE,
  GRADES,
  MIN_EASE,
  addDays,
  isDue,
  newCard,
  review,
  type SrsState,
} from "../src/lib/srs.js";

const T = "2026-09-21";

describe("newCard", () => {
  it("starts at the default ease and is due immediately", () => {
    const c = newCard(T);
    expect(c).toEqual({
      ease: DEFAULT_EASE,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      dueAt: T,
    });
    expect(isDue(c, T)).toBe(true);
  });
});

describe("addDays", () => {
  it("steps across a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("steps across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("review", () => {
  it("uses the SM-2 interval ladder of 1 then 6 days", () => {
    let c = review(newCard(T), GRADES.good, T);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(1);
    expect(c.dueAt).toBe("2026-09-22");

    c = review(c, GRADES.good, "2026-09-22");
    expect(c.reps).toBe(2);
    expect(c.intervalDays).toBe(6);
    expect(c.dueAt).toBe("2026-09-28");
  });

  it("multiplies by the easiness factor from the third repetition", () => {
    let c = review(newCard(T), GRADES.good, T);
    c = review(c, GRADES.good, T);
    const easeAfterTwo = c.ease;
    c = review(c, GRADES.good, T);
    expect(c.reps).toBe(3);
    expect(c.intervalDays).toBe(Math.round(6 * easeAfterTwo));
  });

  it("raises ease on easy and lowers it on hard", () => {
    expect(review(newCard(T), GRADES.easy, T).ease).toBeGreaterThan(DEFAULT_EASE);
    expect(review(newCard(T), GRADES.hard, T).ease).toBeLessThan(DEFAULT_EASE);
    // q = 4 is the neutral grade in SM-2 and leaves ease unchanged.
    expect(review(newCard(T), GRADES.good, T).ease).toBeCloseTo(DEFAULT_EASE, 5);
  });

  it("never lets ease fall below the floor", () => {
    let c = newCard(T);
    for (let i = 0; i < 20; i++) c = review(c, GRADES.again, T);
    expect(c.ease).toBe(MIN_EASE);
  });

  it("treats a failure as a lapse and restarts the ladder", () => {
    let c = review(newCard(T), GRADES.good, T);
    c = review(c, GRADES.good, T);
    expect(c.intervalDays).toBe(6);

    c = review(c, GRADES.again, T);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.intervalDays).toBe(1);
    expect(c.dueAt).toBe("2026-09-22");
  });

  it("keeps the ease penalty across a lapse, so a hard word returns sooner", () => {
    const failed = review(newCard(T), GRADES.again, T);
    expect(failed.ease).toBeLessThan(DEFAULT_EASE);
    const recovered = review(failed, GRADES.good, T);
    expect(recovered.ease).toBeLessThan(DEFAULT_EASE);
  });

  it("keeps intervals at least a day", () => {
    const low: SrsState = { ease: MIN_EASE, intervalDays: 0, reps: 5, lapses: 0, dueAt: T };
    expect(review(low, GRADES.good, T).intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe("isDue", () => {
  it("is due on and after the due day", () => {
    const c: SrsState = { ...newCard(T), dueAt: "2026-09-21" };
    expect(isDue(c, "2026-09-20")).toBe(false);
    expect(isDue(c, "2026-09-21")).toBe(true);
    expect(isDue(c, "2026-09-25")).toBe(true);
  });
});
