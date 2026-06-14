"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the first client render (so the server HTML and the
 * hydrating render agree), then true once mounted. Use it to gate UI that
 * depends on the current clock — e.g. a "stale" badge — without the
 * setState-in-effect dance the React hooks lint rule disallows.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
