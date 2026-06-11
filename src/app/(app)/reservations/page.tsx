import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { CancelReservationButton } from "@/components/cancel-reservation-button";
import { EmptyState } from "@/components/empty-state";
import { NewReservationForm } from "@/components/new-reservation-form";
import { PageHeader } from "@/components/page-header";
import { StaffReservationsTable } from "@/components/staff-reservations-table";
import { cn } from "@/lib/cn";
import { isStaff, requireProfile } from "@/lib/auth";
import { RESERVATION_STATUSES, STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import {
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
  searchParams: Promise<{ status?: string }>;
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

  const [{ data }, settings] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .eq("member_id", profile.id)
      .order("reservation_date", { ascending: false })
      .order("reservation_time", { ascending: false }),
    fetchReservationSettings(supabase),
  ]);
  const reservations = data ?? [];
  const slots = generateSlots(settings);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Request a table and track your reservations."
      />
      <NewReservationForm
        slots={slots}
        windowNote={serviceWindowNote(settings)}
      />

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
                  "flex flex-wrap items-start justify-between gap-3 p-4",
                  r.status === "cancelled" && "opacity-60",
                )}
              >
                <div>
                  <p className="font-medium text-foreground">
                    {formatDate(r.reservation_date)} at{" "}
                    {formatTime(r.reservation_time)}
                  </p>
                  <p className="text-sm text-muted">
                    Party of {r.party_size}
                    {r.special_requests ? ` · ${r.special_requests}` : ""}
                  </p>
                  {r.status === "declined" && r.staff_note && (
                    <p className="mt-1 text-sm text-danger">
                      Reason: {r.staff_note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  {(r.status === "pending" || r.status === "confirmed") && (
                    <CancelReservationButton id={r.id} />
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
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status =
    sp.status && (RESERVATION_STATUSES as string[]).includes(sp.status)
      ? (sp.status as ReservationStatus)
      : null;

  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const reservations = data ?? [];

  const memberIds = [...new Set(reservations.map((r) => r.member_id))];
  const { data: members } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const rows = reservations.map((r) => ({
    ...r,
    memberName: nameById.get(r.member_id) ?? "Member",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Confirm or cancel member reservations."
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/reservations" label="All" active={!status} />
        {RESERVATION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/reservations?status=${s}`}
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
        <StaffReservationsTable rows={rows} />
      )}
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
