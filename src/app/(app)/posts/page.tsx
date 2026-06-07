import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PostCard } from "@/components/post-card";
import { cn } from "@/lib/cn";
import { isStaff, requireProfile } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

export const metadata: Metadata = { title: "Announcements" };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const sp = await searchParams;
  const dept =
    sp.dept && VALID.has(sp.dept) ? (sp.dept as DepartmentType) : null;

  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (dept) query = query.eq("department", dept);

  const { data: posts } = await query;
  const list = posts ?? [];

  const authorIds = [...new Set(list.map((p) => p.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  const canPost = isStaff(profile.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Updates from around the club."
        action={
          canPost ? (
            <Link href="/posts/new" className="btn btn-primary">
              New announcement
            </Link>
          ) : undefined
        }
      />

      <FilterChips active={dept} />

      {list.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description={
            canPost
              ? "Post the first update for members."
              : "Check back soon for news from the club."
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              authorName={nameById.get(p.author_id) ?? "Club staff"}
              canManage={p.author_id === profile.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChips({ active }: { active: DepartmentType | null }) {
  const base =
    "rounded-full border px-3 py-1 text-sm font-medium transition-colors";
  const on = "border-primary bg-primary text-white";
  const off =
    "border-border bg-surface text-muted hover:border-primary hover:text-primary";

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/posts" className={cn(base, !active ? on : off)}>
        All
      </Link>
      {DEPARTMENTS.map((d) => (
        <Link
          key={d.value}
          href={`/posts?dept=${d.value}`}
          className={cn(base, active === d.value ? on : off)}
        >
          {d.label}
        </Link>
      ))}
    </div>
  );
}
