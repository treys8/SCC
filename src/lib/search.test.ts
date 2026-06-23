import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "./database.types";
import { sanitizeSearch } from "./feed";
import { SEARCH_GROUP_LIMIT, searchDocuments, searchEvents } from "./search";

/**
 * Minimal chainable PostgREST stub: records the filter args each function
 * builds, and resolves to `data` when `.returns()` is awaited. Lets us assert
 * the exact `.or()` ILIKE string + column filters without a live database.
 */
function stub(data: unknown[]) {
  const calls = {
    table: undefined as string | undefined,
    select: [] as string[],
    or: [] as string[],
    eq: [] as [string, unknown][],
    order: [] as [string, unknown][],
    limit: [] as number[],
  };
  const q = {
    select: (s: string) => {
      calls.select.push(s);
      return q;
    },
    or: (s: string) => {
      calls.or.push(s);
      return q;
    },
    eq: (c: string, v: unknown) => {
      calls.eq.push([c, v]);
      return q;
    },
    order: (c: string, o: unknown) => {
      calls.order.push([c, o]);
      return q;
    },
    limit: (n: number) => {
      calls.limit.push(n);
      return q;
    },
    returns: () => Promise.resolve({ data }),
  };
  const supabase = {
    from: (t: string) => {
      calls.table = t;
      return q;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, calls };
}

describe("searchDocuments", () => {
  it("matches title or file name on published docs only", async () => {
    const { supabase, calls } = stub([{ id: "d1" }]);
    const rows = await searchDocuments(supabase, "menu");
    expect(calls.table).toBe("documents");
    expect(calls.eq).toContainEqual(["is_published", true]);
    expect(calls.or).toEqual(["title.ilike.%menu%,file_name.ilike.%menu%"]);
    expect(calls.limit).toEqual([SEARCH_GROUP_LIMIT]);
    expect(rows).toEqual([{ id: "d1" }]);
  });

  it("strips PostgREST-structural characters from the term", async () => {
    const { supabase, calls } = stub([]);
    await searchDocuments(supabase, "a,b(c)");
    expect(calls.or).toEqual(["title.ilike.%a b c%,file_name.ilike.%a b c%"]);
  });

  it("returns [] without querying for a blank/structural-only term", async () => {
    const { supabase, calls } = stub([{ id: "d1" }]);
    expect(await searchDocuments(supabase, "   ")).toEqual([]);
    expect(await searchDocuments(supabase, "(),")).toEqual([]);
    expect(calls.table).toBeUndefined();
  });
});

describe("searchEvents", () => {
  it("matches title, description, or location, newest first", async () => {
    const { supabase, calls } = stub([{ id: "e1" }]);
    const rows = await searchEvents(supabase, "scramble");
    expect(calls.table).toBe("calendar_events");
    expect(calls.or).toEqual([
      "title.ilike.%scramble%,description.ilike.%scramble%,location.ilike.%scramble%",
    ]);
    expect(calls.order).toEqual([["event_date", { ascending: false }]]);
    expect(calls.limit).toEqual([SEARCH_GROUP_LIMIT]);
    expect(rows).toEqual([{ id: "e1" }]);
  });

  it("returns [] without querying for a blank term", async () => {
    const { supabase, calls } = stub([]);
    expect(await searchEvents(supabase, "")).toEqual([]);
    expect(calls.table).toBeUndefined();
  });
});

describe("sanitizeSearch", () => {
  it("replaces commas, parens, and backslashes with spaces", () => {
    expect(sanitizeSearch("a,b(c)")).toBe("a b c");
    expect(sanitizeSearch("a\\b")).toBe("a b");
  });

  it("keeps ILIKE wildcards intact", () => {
    expect(sanitizeSearch("%burger_night%")).toBe("%burger_night%");
  });
});
