import type { Metadata } from "next";
import { BrunchEditor } from "@/components/brunch-editor";
import { BuffetEditor } from "@/components/buffet-editor";
import { DishCatalog } from "@/components/dining/dish-catalog";
import { WeekEditor, type WeekDay } from "@/components/dining/week-editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionsEditor } from "@/components/sections-editor";
import { createClient } from "@/lib/supabase/server";
import type { PageSection } from "@/lib/database.types";

export const metadata: Metadata = { title: "Dining" };

/**
 * Dining console: the buffet defaults card (hours/price/walk-in), the reusable
 * dish catalog, and the recurring weekly plan whose current day drives the
 * Today home page's buffet card. Gated by the /manage layout.
 */
export default async function ManageDiningPage() {
  const supabase = await createClient();
  const [buffetRes, brunchRes, dishesRes, weekRes, sectionsRes] =
    await Promise.all([
      supabase.from("dining_buffet").select("*").maybeSingle(),
      supabase.from("dining_brunch").select("*").maybeSingle(),
      supabase.from("dishes").select("*").order("name"),
      supabase
        .from("buffet_week")
        .select(
          "weekday, is_closed, note, main_dish_id, sides:buffet_week_sides(dish_id, position)",
        )
        .order("weekday"),
      supabase
        .from("page_sections")
        .select("*")
        .eq("page", "dining")
        .order("sort_order", { ascending: true }),
    ]);

  const buffet = buffetRes.data;
  const brunch = brunchRes.data;
  const dishes = dishesRes.data ?? [];
  const sections = (sectionsRes.data ?? []) as PageSection[];
  const week: WeekDay[] = (weekRes.data ?? []).map((d) => ({
    weekday: d.weekday,
    is_closed: d.is_closed,
    note: d.note,
    main_dish_id: d.main_dish_id,
    side_ids: d.sides
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => s.dish_id),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dining"
        description="The dining members see on the Today home page and the Dining page — the lunch buffet (hours, dish catalog, weekly plan), Sunday brunch, and the Dining page's info sections."
      />
      <section className="space-y-3">
        <div>
          <h2 className="text-h2 text-foreground">Dining page sections</h2>
          <p className="mt-0.5 text-sm text-muted">
            Hours, dress code, and notes shown on the member Dining page.
          </p>
        </div>
        <SectionsEditor page="dining" sections={sections} />
      </section>
      {buffet ? (
        <BuffetEditor initial={buffet} />
      ) : (
        <EmptyState
          title="No buffet configured"
          description="The dining buffet row hasn't been set up yet."
        />
      )}
      {week.length > 0 && <WeekEditor week={week} dishes={dishes} />}
      {brunch ? (
        <BrunchEditor initial={brunch} />
      ) : (
        <EmptyState
          title="No brunch configured"
          description="The Sunday brunch row hasn't been set up yet."
        />
      )}
      <DishCatalog dishes={dishes} />
    </div>
  );
}
