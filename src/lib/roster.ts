/**
 * Roster-import types + pure validation shared by the import UI (preview) and
 * the server action (defensive re-check). Keeping it framework-free lets it be
 * unit-tested without a browser or Supabase.
 */

// Staff-assigned club account number: 1–5 digits, leading zeros significant
// ('00123' ≠ '123'), so it is validated and stored as text, never parsed.
export const ACCOUNT_NUMBER_RE = /^[0-9]{1,5}$/;

// Permissive shape check; Supabase auth is the real authority on deliverability.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FULL_NAME_MAX = 120;

/** One mapped roster row, before it is sent to the server. */
export type RosterInput = {
  rowNumber: number; // 1-based source row (for error reporting)
  accountNumber: string;
  fullName: string;
  email: string; // "" when the member has no email on file
};

/** What the server did with one row. */
export type RowOutcomeKind =
  | "invited" // login created + invite email sent
  | "account_only" // no email → account row ensured, no login
  | "skipped_existing" // email already registered
  | "error";

export type RowOutcome = {
  rowNumber: number;
  email: string;
  fullName: string;
  accountNumber: string;
  kind: RowOutcomeKind;
  message?: string;
};

export type RowValidation =
  | { kind: "ok" }
  | { kind: "no_email" }
  | { kind: "error"; message: string };

/** Validate a single mapped row for the preview + as a server-side guard. */
export function validateRow(row: RosterInput): RowValidation {
  const account = row.accountNumber.trim();
  if (!ACCOUNT_NUMBER_RE.test(account)) {
    return { kind: "error", message: "Account number must be 1–5 digits." };
  }
  if (!row.fullName.trim()) {
    return { kind: "error", message: "Name is required." };
  }
  const email = row.email.trim();
  if (!email) return { kind: "no_email" };
  if (!EMAIL_RE.test(email)) {
    return { kind: "error", message: "Email looks invalid." };
  }
  return { kind: "ok" };
}

/** Normalize the raw mapped strings (trim, lowercase email, cap name). */
export function normalizeRow(row: RosterInput): RosterInput {
  return {
    rowNumber: row.rowNumber,
    accountNumber: row.accountNumber.trim(),
    fullName: row.fullName.trim().slice(0, FULL_NAME_MAX),
    email: row.email.trim().toLowerCase(),
  };
}

/**
 * Row numbers whose email duplicates an earlier row's (case-insensitive).
 * Blank emails are ignored; repeated account numbers are fine (households).
 */
export function duplicateEmailRows(rows: RosterInput[]): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) dupes.add(row.rowNumber);
    else seen.add(email);
  }
  return dupes;
}

export type ColumnMapping = {
  accountNumber: number | null;
  fullName: number | null;
  email: number | null;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-effort auto-map of a CSV's header row to our three fields. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const cols = headers.map(norm);
  const find = (pred: (h: string) => boolean) => {
    const i = cols.findIndex(pred);
    return i === -1 ? null : i;
  };
  return {
    email: find((h) => h.includes("email") || h.includes("mail")),
    accountNumber: find(
      (h) => h.includes("account") || h.includes("acct") || h.includes("membernumber"),
    ),
    fullName: find((h) => h.includes("name") && !h.includes("account")),
  };
}
