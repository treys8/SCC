import { timingSafeEqual } from "node:crypto";
import { clubTodayISO, formatTime } from "@/lib/format";
import { notifyUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads the current clock to decide which club day "today" is — never cache.
export const dynamic = "force-dynamic";

/** Constant-time bearer check (avoids a timing side-channel on the secret). */
function authorized(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * "Tonight" / "This afternoon" for the seating. Today every reservation is
 * dinner (the service window is 5–9pm), but a special-event day can open a
 * midday seating — so word it off the actual time rather than assuming.
 */
function whenWord(time: string): string {
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "This morning";
  if (hour < 17) return "This afternoon";
  return "Tonight";
}

/**
 * Day-of reminder: nudge every member with a confirmed reservation for today
 * ("Tonight at 6:30 — party of 4"). A reservation is announced when staff
 * confirm it — often days ahead — and then never mentioned again; this is the
 * nudge that cuts no-shows.
 *
 * Scheduled early afternoon club time (see vercel.json), which leaves room for
 * Hobby's up-to-an-hour cron drift and still lands well before service.
 *
 * Only 'confirmed' reservations are reminded: a pending one hasn't been promised
 * a table, and a member who gets confirmed *after* this runs has just had a
 * confirmation push anyway.
 *
 * Claims each row before sending (reminded_at IS NULL → now()), so a retry or
 * two overlapping runs can't remind the same member twice. Authenticated by a
 * bearer secret; runs under the service role, bypassing RLS.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed if the secret is unset, then compare in constant time.
  if (!secret || !authorized(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const today = clubTodayISO();

  // Claim and read in one step: whoever flips reminded_at owns the send.
  const { data: due, error } = await admin
    .from("reservations")
    .update({ reminded_at: new Date().toISOString() })
    .eq("reservation_date", today)
    .eq("status", "confirmed")
    .is("reminded_at", null)
    .select("id, member_id, reservation_time, party_size");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  for (const r of due ?? []) {
    const when = whenWord(r.reservation_time);
    await notifyUsers([r.member_id], {
      type: "reservation",
      title: when === "Tonight" ? "Your table tonight" : "Your table today",
      body: `${when} at ${formatTime(r.reservation_time)} — party of ${
        r.party_size
      }. See you then.`,
      link: "/reservations",
      tag: `reservation-remind-${r.id}`,
      reservationId: r.id,
    });
  }

  return Response.json({ date: today, reminded: due?.length ?? 0 });
}
