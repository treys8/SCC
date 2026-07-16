import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyMenu, type WeeklyDay } from "@/components/dining/weekly-menu";
import { DocumentLink } from "@/components/document-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionsView } from "@/components/sections-view";
import { DiningCard } from "@/components/today/dining-card";
import { requireProfile } from "@/lib/auth";
import {
  clubTodayISO,
  clubWeekday,
  formatLongDate,
  formatTimeRange,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PageSection } from "@/lib/database.types";

export const metadata: Metadata = { title: "Dining" };

/**
 * Member-facing Dining destination: staff-written info sections (hours, dress
 * code, reservations…), the recurring weekly lunch buffet, Sunday brunch, and the
 * menu PDFs from the document library. Read-only — staff edit at /manage/dining.
 */
export default async function DiningPage() {
  await requireProfile();
  const supabase = await createClient();

  const [
    sectionsRes,
    buffetRes,
    brunchRes,
    weekRes,
    menuDocsRes,
    overridesRes,
  ] = await Promise.all([
      supabase
        .from("page_sections")
        .select("*")
        .eq("page", "dining")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabase.from("dining_buffet").select("*").maybeSingle(),
      supabase.from("dining_brunch").select("*").maybeSingle(),
      supabase
        .from("buffet_week")
        // FK hint: buffet_week_sides adds a second buffet_week↔dishes relation,
        // so the bare `dishes` embed is ambiguous (mirrors the Today query).
        .select(
          "weekday, is_closed, note, main:dishes!buffet_week_main_dish_id_fkey(name), sides:buffet_week_sides(position, dish:dishes(name))",
        )
        .order("weekday", { ascending: true }),
      supabase
        .from("documents")
        .select("*")
        .eq("category", "menu")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      // The next few exceptions to the usual week — a member checking the
      // dining page should find out about a closure before they drive over.
      supabase
        .from("dining_service_overrides")
        .select("*")
        .gte("date", clubTodayISO())
        .order("date")
        .limit(5),
    ]);

  const sections = (sectionsRes.data ?? []) as PageSection[];
  const buffet = buffetRes.data;
  const brunch = brunchRes.data;
  const menuDocs = menuDocsRes.data ?? [];

  const days: WeeklyDay[] = (weekRes.data ?? []).map((d) => ({
    weekday: d.weekday,
    isClosed: d.is_closed,
    note: d.note,
    main: d.main?.name ?? null,
    sides: (d.sides ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => s.dish?.name)
      .filter((n): n is string => Boolean(n)),
  }));

  const todayWeekday = clubWeekday(clubTodayISO());

  const buffetMeta = buffet
    ? [
        buffet.start_time && formatTimeRange(buffet.start_time, buffet.end_time),
        buffet.location,
        buffet.price,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;
  const brunchMeta = brunch
    ? [
        brunch.start_time && formatTimeRange(brunch.start_time, brunch.end_time),
        brunch.location,
        brunch.price,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  const upcoming = overridesRes.data ?? [];

  const hasAnything =
    sections.length > 0 ||
    days.length > 0 ||
    brunch?.active ||
    menuDocs.length > 0 ||
    upcoming.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dining"
        description="Hours, menus, and what's on this week at the club."
        action={
          <Link href="/reservations" className="btn btn-primary btn-sm">
            Reserve a table
          </Link>
        }
      />

      <SectionsView sections={sections} />

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Coming up</h2>
          <div className="space-y-3">
            {upcoming.map((o) => (
              <DiningCard
                key={o.date}
                eyebrow={formatLongDate(o.date)}
                title={
                  o.name ??
                  (o.kind === "closed" ? "Dining room closed" : "A special service")
                }
                meta={
                  o.kind === "special" && o.service_start
                    ? formatTimeRange(o.service_start, o.service_end)
                    : null
                }
                description={o.description}
                reservation={
                  o.kind === "special" && o.reservations_required
                    ? "required"
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}

      {days.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Lunch buffet</h2>
          {buffetMeta && <p className="text-sm text-muted">{buffetMeta}</p>}
          <WeeklyMenu days={days} todayWeekday={todayWeekday} />
        </section>
      )}

      {brunch?.active && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Sunday brunch</h2>
          <DiningCard
            eyebrow="Every Sunday"
            title={brunch.title}
            meta={brunchMeta}
            description={brunch.description}
            reservation={brunch.walk_in ? "walk_in" : "required"}
          />
        </section>
      )}

      {menuDocs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Menus</h2>
          <ul className="space-y-2">
            {menuDocs.map((doc) => (
              <DocumentLink key={doc.id} doc={doc} />
            ))}
          </ul>
        </section>
      )}

      {!hasAnything && (
        <EmptyState
          title="Dining details coming soon"
          description="Hours, menus, and the week's buffet will appear here once staff add them."
        />
      )}
    </div>
  );
}
