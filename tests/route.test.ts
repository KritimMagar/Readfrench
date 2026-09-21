import { describe, expect, it } from "vitest";
import { hashFor, parseHash } from "../src/lib/route.js";

describe("parseHash", () => {
  it("defaults to the library", () => {
    expect(parseHash("")).toEqual({ name: "library" });
    expect(parseHash("#/")).toEqual({ name: "library" });
    expect(parseHash("#/nonsense")).toEqual({ name: "library" });
  });

  it("reads a story id", () => {
    expect(parseHash("#/story/le-chat-de-marie")).toEqual({
      name: "story",
      id: "le-chat-de-marie",
    });
  });

  it("decodes an escaped id", () => {
    expect(parseHash("#/story/le%20chat")).toEqual({ name: "story", id: "le chat" });
  });

  it("round-trips through hashFor", () => {
    const route = { name: "story", id: "le-voyage-de-sofia" } as const;
    expect(parseHash(hashFor(route))).toEqual(route);
    expect(hashFor({ name: "library" })).toBe("#/");
  });
});
