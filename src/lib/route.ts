import { useEffect, useState } from "react";

export type Route =
  | { name: "library" }
  | { name: "story"; id: string }
  | { name: "vocabulary" }
  | { name: "review" };

export function parseHash(hash: string): Route {
  const story = /^#\/story\/([^/?#]+)/.exec(hash);
  if (story) return { name: "story", id: decodeURIComponent(story[1]!) };
  if (/^#\/vocabulary\/?$/.test(hash)) return { name: "vocabulary" };
  if (/^#\/review\/?$/.test(hash)) return { name: "review" };
  return { name: "library" };
}

export function hashFor(route: Route): string {
  switch (route.name) {
    case "story":
      return `#/story/${encodeURIComponent(route.id)}`;
    case "vocabulary":
      return "#/vocabulary";
    case "review":
      return "#/review";
    default:
      return "#/";
  }
}

/**
 * Hash routing rather than a router dependency: two views, and it keeps the
 * browser's back button working between library and reader.
 */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = hashFor(next);
  };

  return [route, navigate];
}
