import { NextResponse } from "next/server";
import { buildICS, eventSlug, icsStamp } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

// Returns a single-event .ics download. The proxy (src/proxy.ts) already
// blocks signed-out requests; we re-check here as defense in depth, and RLS
// confines the query to events this member is allowed to read.
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

  const { data: event } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .single();
  if (!event) return new NextResponse("Not found", { status: 404 });

  const body = buildICS(event, icsStamp(new Date()));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${eventSlug(event.title)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
