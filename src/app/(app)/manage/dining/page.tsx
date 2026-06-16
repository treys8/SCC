import type { Metadata } from "next";
import { BuffetEditor } from "@/components/buffet-editor";
import { DishCatalog } from "@/components/dining/dish-catalog";
import { WeekEditor, type WeekDay } from "@/components/dining/week-editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dining" };

/**
 * Dining console: the buffet defaults card (hours/price/walk-in), the reusable
 * dish catalog, and the recurring weekly plan whose current day drives the
 * Today home page's buffet card. Gated by the /manage layout.
 */
export default async function ManageDiningPage() {
  const supabase = await createClient();
  const [buffetRes, dishesRes, weekRes] = await Promise.all([
    supabase.from("dining_buffet").select("*").maybeSingle(),
    supabase.from("dishes").select("*").order("name"),
    supabase
      .from("buffet_week")
      .select(
        "weekday, is_closed, note, main_dish_id, sides:buffet_week_sides(dish_id, position)",
      )
      .order("weekday"),
  ]);

  const buffet = buffetRes.data;
  const dishes = dishesRes.data ?? [];
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
        description="The lunch buffet members see on the Today home page — its hours, the dish catalog, and the weekly plan."
      />
      {buffet ? (
        <BuffetEditor initial={buffet} />
      ) : (
        <EmptyState
          title="No buffet configured"
          description="The dining buffet row hasn't been set up yet."
        />
      )}
      {week.length > 0 && <WeekEditor week={week} dishes={dishes} />}
      <DishCatalog dishes={dishes} />
    </div>
  );
}
