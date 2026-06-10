import { NextResponse } from "next/server";
import { buildReservationICS, icsStamp } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

// Returns a single-reservation .ics download for the Today card's "Add to
// calendar" action. The proxy (src/proxy.ts) already blocks signed-out
// requests; we re-check here as defense in depth, and RLS confines the query
// to the member's own reservations.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();
  if (!reservation) return new NextResponse("Not found", { status: 404 });

  const body = buildReservationICS(reservation, icsStamp(new Date()));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="scc-dinner-reservation.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
