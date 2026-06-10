import type { Metadata } from "next";
import Link from "next/link";
import { FacilityStatusWidget } from "@/components/facility-status-widget";
import { Feed } from "@/components/feed";
import { FeedFilter } from "@/components/feed-filter";
import { PageHeader } from "@/components/page-header";
import { isStaff, requireProfile } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import { fetchFeedPage, fetchPinnedPosts } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

export const metadata: Metadata = { title: "Feed" };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

function parseDepts(raw?: string): DepartmentType[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID.has(s)) as DepartmentType[];
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const sp = await searchParams;
  const depts = parseDepts(sp.dept);

  const profile = await requireProfile();
  const supabase = await createClient();

  const [pinned, page, facilities] = await Promise.all([
    fetchPinnedPosts(supabase, depts),
    fetchFeedPage(supabase, { depts, before: null }),
    fetchFacilityStatus(supabase),
  ]);

  const canPost = isStaff(profile.role);
  // Re-key the client feed on filter change so its state resets cleanly.
  const feedKey = depts.length ? depts.join(",") : "all";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed"
        description="Updates from around the club."
        action={
          canPost ? (
            <Link
              href="/posts/new"
              className="btn btn-primary hidden md:inline-flex"
            >
              New post
            </Link>
          ) : undefined
        }
      />

      {facilities.length > 0 && (
        <FacilityStatusWidget initial={facilities} />
      )}

      <FeedFilter active={depts} />

      <Feed
        key={feedKey}
        initialPinned={pinned}
        initialPosts={page.posts}
        initialCursor={page.nextCursor}
        depts={depts}
        canPost={canPost}
        currentUserId={profile.id}
      />
    </div>
  );
}
