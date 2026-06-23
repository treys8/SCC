"use client";

import { useMemo, useRef, useState } from "react";
import { bulkInviteMembers } from "@/app/(app)/members/actions";
import { cn } from "@/lib/cn";
import { parseCsv, toCsv } from "@/lib/csv";
import {
  type ColumnMapping,
  type RosterInput,
  type RowOutcome,
  type RowOutcomeKind,
  duplicateEmailRows,
  guessColumnMapping,
  normalizeRow,
  validateRow,
} from "@/lib/roster";

// Send this many rows per Server Action call so each invocation stays short and
// progress updates as we go. The action caps the chunk server-side too.
const CHUNK_SIZE = 25;
const PREVIEW_LIMIT = 50;

const TEMPLATE_CSV = [
  "account_number,full_name,email",
  "00123,Jane Member,jane@example.com",
  "00123,John Member,john@example.com",
  "00456,Pat Guest,",
].join("\r\n");

const FIELDS = [
  { key: "accountNumber", label: "Account number", required: true },
  { key: "fullName", label: "Full name", required: true },
  { key: "email", label: "Email", required: false },
] as const;

type Step = "upload" | "map" | "running" | "done";

type Classified = {
  input: RosterInput;
  // What the preview shows and how the row will be handled on import.
  state: "ok" | "no_email" | "duplicate" | "error";
  message?: string;
};

const STATE_LABEL: Record<Classified["state"], string> = {
  ok: "Will invite",
  no_email: "No email — account only",
  duplicate: "Duplicate in file — skipped",
  error: "Error",
};

const STATE_CLASS: Record<Classified["state"], string> = {
  ok: "text-success",
  no_email: "text-muted",
  duplicate: "text-muted",
  error: "text-danger",
};

const OUTCOME_LABEL: Record<RowOutcomeKind, string> = {
  invited: "Invited",
  account_only: "Account only (no email)",
  skipped_existing: "Skipped",
  error: "Error",
};

const OUTCOME_CLASS: Record<RowOutcomeKind, string> = {
  invited: "text-success",
  account_only: "text-muted",
  skipped_existing: "text-muted",
  error: "text-danger",
};

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RosterImport() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({
    accountNumber: null,
    fullName: null,
    email: null,
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<RowOutcome[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => {
    if (grid.length === 0) return [];
    return hasHeader
      ? grid[0]
      : grid[0].map((_, i) => `Column ${i + 1}`);
  }, [grid, hasHeader]);

  const dataRows = useMemo(
    () => (hasHeader ? grid.slice(1) : grid),
    [grid, hasHeader],
  );

  const inputs = useMemo<RosterInput[]>(() => {
    const cell = (row: string[], idx: number | null) =>
      idx === null ? "" : (row[idx] ?? "");
    return dataRows.map((row, i) =>
      normalizeRow({
        rowNumber: hasHeader ? i + 2 : i + 1,
        accountNumber: cell(row, mapping.accountNumber),
        fullName: cell(row, mapping.fullName),
        email: cell(row, mapping.email),
      }),
    );
  }, [dataRows, mapping, hasHeader]);

  const classified = useMemo<Classified[]>(() => {
    const dupes = duplicateEmailRows(inputs);
    return inputs.map((input) => {
      const check = validateRow(input);
      if (check.kind === "error") {
        return { input, state: "error", message: check.message };
      }
      if (dupes.has(input.rowNumber)) {
        return { input, state: "duplicate" };
      }
      return { input, state: check.kind === "no_email" ? "no_email" : "ok" };
    });
  }, [inputs]);

  const counts = useMemo(() => {
    const c = { ok: 0, no_email: 0, duplicate: 0, error: 0 };
    for (const row of classified) c[row.state]++;
    return c;
  }, [classified]);

  const mappingReady = mapping.accountNumber !== null && mapping.fullName !== null;
  const sendableCount = counts.ok + counts.no_email;

  function loadCsv(text: string, name: string) {
    setParseError(null);
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setParseError("That file had no rows. Check it’s a CSV with data.");
      return;
    }
    setGrid(rows);
    setFileName(name);
    setHasHeader(true);
    setMapping(guessColumnMapping(rows[0]));
    setStep("map");
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadCsv(text, file.name);
  }

  function onHeaderToggle(next: boolean) {
    setHasHeader(next);
    // Re-guess from the first row only when it's actually a header.
    setMapping(next && grid[0] ? guessColumnMapping(grid[0]) : mapping);
  }

  function setField(key: (typeof FIELDS)[number]["key"], value: string) {
    const idx = value === "" ? null : Number(value);
    setMapping((m) => ({ ...m, [key]: idx }));
  }

  async function runImport() {
    setRunError(null);
    // Split into rows we'll send and rows handled entirely client-side.
    const send: RosterInput[] = [];
    const preResults: RowOutcome[] = [];
    for (const row of classified) {
      const base = {
        rowNumber: row.input.rowNumber,
        email: row.input.email,
        fullName: row.input.fullName,
        accountNumber: row.input.accountNumber,
      };
      if (row.state === "error") {
        preResults.push({ ...base, kind: "error", message: row.message });
      } else if (row.state === "duplicate") {
        preResults.push({
          ...base,
          kind: "skipped_existing",
          message: "Duplicate email earlier in this file.",
        });
      } else {
        send.push(row.input);
      }
    }

    setResults(preResults);
    setProgress({ done: preResults.length, total: classified.length });
    setStep("running");

    const collected = [...preResults];
    try {
      for (let i = 0; i < send.length; i += CHUNK_SIZE) {
        const chunk = send.slice(i, i + CHUNK_SIZE);
        const out = await bulkInviteMembers(chunk);
        collected.push(...out);
        setResults([...collected]);
        setProgress({ done: collected.length, total: classified.length });
      }
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : "Something went wrong during import.",
      );
    }

    collected.sort((a, b) => a.rowNumber - b.rowNumber);
    setResults(collected);
    setStep("done");
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setGrid([]);
    setMapping({ accountNumber: null, fullName: null, email: null });
    setParseError(null);
    setRunError(null);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadAttentionCsv() {
    const rows = results.filter(
      (r) => r.kind === "error" || r.kind === "account_only",
    );
    const out: string[][] = [
      ["row", "account_number", "full_name", "email", "result", "detail"],
      ...rows.map((r) => [
        String(r.rowNumber),
        r.accountNumber,
        r.fullName,
        r.email,
        OUTCOME_LABEL[r.kind],
        r.message ?? "",
      ]),
    ];
    download("roster-needs-attention.csv", toCsv(out));
  }

  // ---- Step: upload ----------------------------------------------------
  if (step === "upload") {
    return (
      <div className="card p-6">
        <h2 className="text-h2 text-foreground">Upload a roster</h2>
        <p className="mt-1 text-sm text-muted">
          Export your member list as a <strong>CSV</strong> (in Excel: File → Save
          As → CSV). It should have a column for account number, full name, and
          email. We’ll let you confirm which column is which.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn btn-primary cursor-pointer">
            Choose CSV file
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFileChange}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => download("roster-template.csv", TEMPLATE_CSV)}
          >
            Download template
          </button>
          {fileName && <span className="text-sm text-muted">{fileName}</span>}
        </div>

        {parseError && (
          <p className="mt-3 text-sm text-danger">{parseError}</p>
        )}

        <p className="mt-4 text-caption text-muted">
          Members with an email get an invitation. Two rows sharing an account
          number join the same household account. Rows without an email create the
          account only — you can invite them later once you have an address.
        </p>
      </div>
    );
  }

  // ---- Step: map + preview --------------------------------------------
  if (step === "map") {
    const shown = classified.slice(0, PREVIEW_LIMIT);
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-h2 text-foreground">Match your columns</h2>
          <p className="mt-1 text-sm text-muted">
            From <strong>{fileName}</strong> — {dataRows.length} row
            {dataRows.length === 1 ? "" : "s"}.
          </p>

          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => onHeaderToggle(e.target.checked)}
            />
            First row is a header
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`map_${f.key}`}>
                  {f.label}
                  {f.required ? "" : " (optional)"}
                </label>
                <select
                  id={`map_${f.key}`}
                  className="select"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  <option value="">— not in file —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!mappingReady && (
            <p className="mt-3 text-sm text-danger">
              Choose which columns hold the account number and full name.
            </p>
          )}
        </div>

        {mappingReady && (
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-h2 text-foreground">Preview</h3>
              <p className="text-sm text-muted">
                {counts.ok} to invite · {counts.no_email} account-only ·{" "}
                {counts.duplicate} duplicate · {counts.error} error
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-caption text-muted">
                  <tr>
                    <th className="py-2 pr-4">Row</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.input.rowNumber} className="border-t border-border">
                      <td className="py-2 pr-4 text-muted">{row.input.rowNumber}</td>
                      <td className="py-2 pr-4">{row.input.accountNumber || "—"}</td>
                      <td className="py-2 pr-4">{row.input.fullName || "—"}</td>
                      <td className="py-2 pr-4">{row.input.email || "—"}</td>
                      <td className={cn("py-2", STATE_CLASS[row.state])}>
                        {STATE_LABEL[row.state]}
                        {row.message ? ` — ${row.message}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {classified.length > PREVIEW_LIMIT && (
                <p className="mt-3 text-caption text-muted">
                  Showing first {PREVIEW_LIMIT} of {classified.length} rows.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={sendableCount === 0}
                onClick={runImport}
              >
                Invite {sendableCount} member{sendableCount === 1 ? "" : "s"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Choose a different file
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Step: running / done -------------------------------------------
  const pct =
    progress.total === 0
      ? 0
      : Math.round((progress.done / progress.total) * 100);
  const summary = results.reduce<Record<RowOutcomeKind, number>>(
    (acc, r) => {
      acc[r.kind]++;
      return acc;
    },
    { invited: 0, account_only: 0, skipped_existing: 0, error: 0 },
  );
  const attention = results.filter(
    (r) => r.kind === "error" || r.kind === "account_only",
  );

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-h2 text-foreground">
          {step === "running" ? "Importing…" : "Import complete"}
        </h2>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-success transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          {progress.done} of {progress.total} rows processed.
        </p>

        {step === "done" && (
          <p className="mt-3 text-sm text-foreground">
            {summary.invited} invited · {summary.account_only} account-only ·{" "}
            {summary.skipped_existing} skipped · {summary.error} error
          </p>
        )}

        {runError && <p className="mt-3 text-sm text-danger">{runError}</p>}

        {step === "done" && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {attention.length > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={downloadAttentionCsv}
              >
                Download {attention.length} row
                {attention.length === 1 ? "" : "s"} needing attention
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Import another file
            </button>
          </div>
        )}
      </div>

      {step === "done" && attention.length > 0 && (
        <div className="card p-6">
          <h3 className="text-h2 text-foreground">Needs attention</h3>
          <p className="mt-1 text-sm text-muted">
            These rows were not invited — fix and re-import, or add an email and
            invite them from the members page.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-caption text-muted">
                <tr>
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((r) => (
                  <tr key={r.rowNumber} className="border-t border-border">
                    <td className="py-2 pr-4 text-muted">{r.rowNumber}</td>
                    <td className="py-2 pr-4">{r.accountNumber || "—"}</td>
                    <td className="py-2 pr-4">{r.fullName || "—"}</td>
                    <td className="py-2 pr-4">{r.email || "—"}</td>
                    <td className={cn("py-2", OUTCOME_CLASS[r.kind])}>
                      {OUTCOME_LABEL[r.kind]}
                      {r.message ? ` — ${r.message}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
