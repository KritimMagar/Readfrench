import { useEffect, useState } from "react";

export type Route = { name: "library" } | { name: "story"; id: string };

export function parseHash(hash: string): Route {
  const m = /^#\/story\/([^/?#]+)/.exec(hash);
  return m ? { name: "story", id: decodeURIComponent(m[1]!) } : { name: "library" };
}

export const hashFor = (route: Route): string =>
  route.name === "story" ? `#/story/${encodeURIComponent(route.id)}` : "#/";

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
