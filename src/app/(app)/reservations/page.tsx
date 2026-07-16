import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { CancelReservationButton } from "@/components/cancel-reservation-button";
import { ChartDateNav } from "@/components/chart-date-nav";
import { EmptyState } from "@/components/empty-state";
import {
  NewReservationForm,
  type DayDetail,
} from "@/components/new-reservation-form";
import { PageHeader } from "@/components/page-header";
import { ReservationProposalActions } from "@/components/reservation-proposal-actions";
import { StaffReservationsTable } from "@/components/staff-reservations-table";
import { cn } from "@/lib/cn";
import { isStaff, requireProfile } from "@/lib/auth";
import { RESERVATION_STATUSES, STATUS_LABEL } from "@/lib/constants";
import {
  dayDiningStatus,
  effectiveBookingSettings,
  fetchServiceOverrides,
  fetchWeeklyClosedWeekdays,
} from "@/lib/dining";
import { clubTodayISO, formatDate, formatLongDate, formatTime } from "@/lib/format";
import {
  buildUpcomingDays,
  fetchReservationRequiredDates,
  fetchReservationSettings,
  generateSlots,
  serviceWindowNote,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Reservations" };

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const profile = await requireProfile();
  if (isStaff(profile.role)) {
    return <StaffView searchParams={searchParams} />;
  }
  return <MemberView />;
}

async function MemberView() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // The 7-day window is fixed up front so we can ask which of those dates a post
  // has flagged "reservations required" (the exceptions to the Fri/Sat rule),
  // and which are closed or given over to a special service.
  const baseDays = buildUpcomingDays(7);
  const firstISO = baseDays[0].iso;
  const lastISO = baseDays[baseDays.length - 1].iso;
  const [{ data }, settings, requiredDates, overrides, weeklyClosed] =
    await Promise.all([
      supabase
        .from("reservations")
        .select("*")
        .eq("member_id", profile.id)
        .order("reservation_date", { ascending: false })
        .order("reservation_time", { ascending: false }),
      fetchReservationSettings(supabase),
      fetchReservationRequiredDates(supabase, firstISO, lastISO),
      fetchServiceOverrides(supabase, firstISO, lastISO),
      fetchWeeklyClosedWeekdays(supabase),
    ]);
  const reservations = data ?? [];

  // Decorate each pill with its dining status, and give each date its own slot
  // list — a special day can run different hours from the club's standing ones,
  // so a single global slot grid would offer times the trigger rejects.
  const days = baseDays.map((d) => {
    const override = overrides.get(d.iso) ?? null;
    const status = dayDiningStatus(d.iso, weeklyClosed, override);
    return {
      ...d,
      closed: status === "closed",
      specialName: status === "special" ? override?.name ?? null : null,
      // Standing Fri/Sat rule, a staff-flagged exception, or a special day that
      // needs booking. A closed day can't require a reservation.
      required:
        status === "closed"
          ? false
          : status === "special"
            ? !!override?.reservations_required
            : d.required || requiredDates.has(d.iso),
    };
  });
  // Everything the form needs to render one day, keyed by date.
  const dayDetails: Record<string, DayDetail> = Object.fromEntries(
    days.map((d) => {
      const override = overrides.get(d.iso) ?? null;
      const effective = effectiveBookingSettings(settings, override);
      return [
        d.iso,
        {
          slots: d.closed ? [] : generateSlots(effective),
          windowNote: d.closed ? null : serviceWindowNote(effective),
          description:
            override?.kind === "special" ? override.description : null,
        },
      ];
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Request a table and track your reservations."
      />
      <NewReservationForm days={days} details={dayDetails} />

      <section>
        <h2 className="mb-3 text-h2 text-foreground">
          Your reservations
        </h2>
        {reservations.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title="No reservations yet"
            description="Use the form above to request your first reservation."
          />
        ) : (
          <div className="card divide-y divide-border">
            {reservations.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-start gap-4 p-4",
                  r.status === "cancelled" && "opacity-60",
                )}
              >
                <DateBlock iso={r.reservation_date} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {formatTime(r.reservation_time)} · Party of {r.party_size}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.special_requests && (
                    <p className="mt-1 text-sm text-muted">
                      {r.special_requests}
                    </p>
                  )}
                  {r.status === "declined" &&
                  r.proposed_date &&
                  r.proposed_time ? (
                    <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                      {r.staff_note && (
                        <p className="text-sm text-muted">{r.staff_note}</p>
                      )}
                      <p className="text-sm font-medium text-foreground">
                        We can offer {formatDate(r.proposed_date)} at{" "}
                        {formatTime(r.proposed_time)}.
                      </p>
                      <ReservationProposalActions id={r.id} />
                    </div>
                  ) : (
                    r.status === "declined" &&
                    r.staff_note && (
                      <p className="mt-1 text-sm text-danger">
                        Reason: {r.staff_note}
                      </p>
                    )
                  )}
                  {(r.status === "pending" || r.status === "confirmed") && (
                    <div className="mt-2">
                      <CancelReservationButton id={r.id} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function StaffView({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const status =
    sp.status && (RESERVATION_STATUSES as string[]).includes(sp.status)
      ? (sp.status as ReservationStatus)
      : null;
  const today = clubTodayISO();
  const chartDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const supabase = await createClient();

  // The working queue (optionally status-filtered) and the nightly chart (just
  // the confirmed parties for the chosen date) are independent reads.
  let queueQuery = supabase
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  if (status) queueQuery = queueQuery.eq("status", status);

  const [{ data: queueData }, { data: chartData }, settings] = await Promise.all(
    [
      queueQuery,
      supabase
        .from("reservations")
        .select("*")
        .eq("reservation_date", chartDate)
        .eq("status", "confirmed")
        .order("reservation_time", { ascending: true }),
      fetchReservationSettings(supabase),
    ],
  );
  const reservations = queueData ?? [];
  const chartReservations = chartData ?? [];

  // One name lookup covering both sets.
  const memberIds = [
    ...new Set([...reservations, ...chartReservations].map((r) => r.member_id)),
  ];
  const { data: members } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const withName = (r: (typeof reservations)[number]) => ({
    ...r,
    memberName: nameById.get(r.member_id) ?? "Member",
  });

  const rows = reservations.map(withName);
  const chartRows = chartReservations.map(withName);
  const covers = chartReservations.reduce((sum, r) => sum + r.party_size, 0);

  const slots = generateSlots(settings);
  const days = buildUpcomingDays(7);

  // Filter chips keep the chart's date (when it isn't today) so the two controls
  // don't reset each other.
  const queueHref = (s?: string) => {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (chartDate !== today) params.set("date", chartDate);
    const qs = params.toString();
    return qs ? `/reservations?${qs}` : "/reservations";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Tonight's seating chart, plus the requests to confirm or decline."
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h2 text-foreground">Nightly chart</h2>
          <ChartDateNav date={chartDate} status={status} />
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-border bg-surface-2 px-4 py-3">
            <p className="font-serif text-lg font-semibold text-foreground">
              {formatLongDate(chartDate)}
            </p>
            <p className="text-sm text-muted">
              {covers} {covers === 1 ? "cover" : "covers"} · {chartRows.length}{" "}
              {chartRows.length === 1 ? "table" : "tables"}
            </p>
          </div>
          {chartRows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No confirmed reservations for this date yet — they appear here as
              you confirm requests.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {chartRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-4 px-4 py-3"
                >
                  <span className="w-20 shrink-0 font-medium text-foreground">
                    {formatTime(r.reservation_time)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">
                      {r.memberName}
                    </span>
                    {r.special_requests && (
                      <span className="mt-0.5 block text-sm text-muted">
                        {r.special_requests}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    party of {r.party_size}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2 text-foreground">Requests</h2>
        <div className="flex flex-wrap gap-2">
          <FilterChip href={queueHref()} label="All" active={!status} />
          {RESERVATION_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={queueHref(s)}
              label={STATUS_LABEL[s]}
              active={status === s}
            />
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title="No reservations"
            description="Nothing to show here."
          />
        ) : (
          <StaffReservationsTable rows={rows} days={days} slots={slots} />
        )}
      </section>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-muted hover:border-primary hover:text-primary",
      )}
    >
      {label}
    </Link>
  );
}

/** The left date chip on a reservation row: gold month over a serif day. */
function DateBlock({ iso }: { iso: string }) {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
  });
  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent/10 py-2">
      <span className="text-2xs font-semibold uppercase tracking-wide text-accent-600">
        {month}
      </span>
      <span className="font-serif text-xl font-semibold leading-none text-foreground">
        {d}
      </span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
