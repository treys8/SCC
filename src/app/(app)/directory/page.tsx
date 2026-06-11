import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DepartmentBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { ClubInfo, StaffMember } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Directory" };

/**
 * Club directory: the administrative staff (who to contact) plus the club's
 * address, phone, and mailing details. Both read from staff-editable tables
 * (staff_directory, club_info) so the page updates without a deploy.
 * Staff-only for now — hidden from members until the member-facing version
 * is ready (no nav link, and this gate blocks direct URL access).
 */
export default async function DirectoryPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [{ data: staff }, { data: club }] = await Promise.all([
    supabase
      .from("staff_directory")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("club_info").select("*").maybeSingle(),
  ]);

  const team = staff ?? [];
  // Feature the first listed member (the GM) the way the printed org sheet does,
  // then grid the rest.
  const [lead, ...rest] = team;

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <PageHeader
          title="Staff Directory"
          description="Meet the Starkville Country Club team and reach the right person."
        />

        {team.length === 0 ? (
          <EmptyState
            title="No staff listed yet"
            description="The club directory hasn't been set up."
          />
        ) : (
          <div className="space-y-4">
            <StaffCard member={lead} featured />
            {rest.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((member) => (
                  <StaffCard key={member.id} member={member} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {club && <ContactCard club={club} />}
    </div>
  );
}

function StaffCard({
  member,
  featured = false,
}: {
  member: StaffMember;
  featured?: boolean;
}) {
  return (
    <div className={cn("card flex gap-4 p-5", featured && "sm:p-6")}>
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white",
          featured ? "h-14 w-14 text-lg" : "h-12 w-12",
        )}
      >
        {initials(member.full_name)}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            className={cn(
              "font-serif font-semibold leading-tight text-foreground",
              featured ? "text-xl" : "text-lg",
            )}
          >
            {member.full_name}
          </h2>
          {member.department && (
            <DepartmentBadge department={member.department} />
          )}
        </div>
        <p className="text-sm text-muted">{member.title}</p>
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="inline-block break-all text-sm text-primary hover:underline"
          >
            {member.email}
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${telHref(member.phone)}`}
            className="block text-sm text-primary hover:underline"
          >
            {member.phone}
          </a>
        )}
      </div>
    </div>
  );
}

function ContactCard({ club }: { club: ClubInfo }) {
  const cityZip = [
    [club.city, club.state].filter(Boolean).join(", "),
    club.postal_code,
  ]
    .filter(Boolean)
    .join(" ");
  const mapQuery = [club.street_address, cityZip].filter(Boolean).join(", ");
  const hasAddress = Boolean(club.street_address || cityZip);

  const addressLines = (
    <>
      {club.street_address && <span className="block">{club.street_address}</span>}
      {cityZip && <span className="block">{cityZip}</span>}
    </>
  );

  return (
    <section className="space-y-4">
      <h2 className="text-h2 text-foreground">Contact</h2>
      <div className="card divide-y divide-border">
        {hasAddress && (
          <ContactRow icon={<PinIcon />} label="Visit">
            {mapQuery ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {addressLines}
              </a>
            ) : (
              addressLines
            )}
          </ContactRow>
        )}
        {club.phone && (
          <ContactRow icon={<PhoneIcon />} label="Call">
            <a href={`tel:${telHref(club.phone)}`} className="hover:underline">
              {club.phone}
            </a>
          </ContactRow>
        )}
        {club.email && (
          <ContactRow icon={<MailIcon />} label="Email">
            <a href={`mailto:${club.email}`} className="break-all hover:underline">
              {club.email}
            </a>
          </ContactRow>
        )}
        {club.mailing_address && (
          <ContactRow icon={<MailIcon />} label="Mail">
            {club.mailing_address}
          </ContactRow>
        )}
        {club.website && (
          <ContactRow icon={<GlobeIcon />} label="Online">
            <a
              href={club.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all hover:underline"
            >
              {club.website.replace(/^https?:\/\//, "")}
            </a>
          </ContactRow>
        )}
      </div>
    </section>
  );
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 p-5">
      <span
        aria-hidden
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-wide text-muted">{label}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Two-initial avatar fallback, mirroring SiteNav's helper. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Strip a phone string down to a dialable tel: target (keep digits and +). */
function telHref(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

type IconProps = { className?: string };

function iconBase(className = "h-5 w-5") {
  return {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function PinIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L13 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}
