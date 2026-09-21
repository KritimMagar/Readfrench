import { describe, expect, it } from "vitest";

import {
  currentStreak,
  dayKey,
  emptyProgress,
  isRead,
  markRead,
  markUnread,
} from "../src/lib/progress.js";

describe("dayKey", () => {
  it("formats a local calendar day", () => {
    expect(dayKey(new Date(2026, 8, 21))).toBe("2026-09-21");
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local time, not UTC", () => {
    // Late-evening local time can already be tomorrow in UTC.
    const d = new Date(2026, 8, 21, 23, 30);
    expect(dayKey(d)).toBe("2026-09-21");
  });
});

describe("currentStreak", () => {
  const today = "2026-09-21";

  it("is zero with no reading", () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-09-19", "2026-09-20", "2026-09-21"], today)).toBe(3);
  });

  it("keeps the streak alive on a day not yet read", () => {
    // Read yesterday, nothing yet today: the streak is not broken.
    expect(currentStreak(["2026-09-19", "2026-09-20"], today)).toBe(2);
  });

  it("breaks once a day is actually missed", () => {
    expect(currentStreak(["2026-09-18", "2026-09-19"], today)).toBe(0);
  });

  it("counts only the run touching today", () => {
    expect(currentStreak(["2026-09-01", "2026-09-02", "2026-09-21"], today)).toBe(1);
  });

  it("ignores duplicates and unsorted input", () => {
    expect(currentStreak(["2026-09-21", "2026-09-20", "2026-09-21"], today)).toBe(2);
  });

  it("counts across a month boundary", () => {
    expect(currentStreak(["2026-08-31", "2026-09-01"], "2026-09-01")).toBe(2);
  });
});

describe("markRead", () => {
  it("records the story and the day", () => {
    const p = markRead(emptyProgress(), "s1", "2026-09-21");
    expect(p.read).toEqual(["s1"]);
    expect(p.readDates).toEqual(["2026-09-21"]);
    expect(isRead(p, "s1")).toBe(true);
  });

  it("is idempotent", () => {
    let p = markRead(emptyProgress(), "s1", "2026-09-21");
    p = markRead(p, "s1", "2026-09-21");
    expect(p.read).toEqual(["s1"]);
    expect(p.readDates).toEqual(["2026-09-21"]);
  });

  it("adds a second story on the same day without a second date", () => {
    let p = markRead(emptyProgress(), "s1", "2026-09-21");
    p = markRead(p, "s2", "2026-09-21");
    expect(p.read).toEqual(["s1", "s2"]);
    expect(p.readDates).toEqual(["2026-09-21"]);
  });

  it("keeps the day in the streak when a story is marked unread", () => {
    const p = markUnread(markRead(emptyProgress(), "s1", "2026-09-21"), "s1");
    expect(p.read).toEqual([]);
    expect(p.readDates).toEqual(["2026-09-21"]);
  });
});
