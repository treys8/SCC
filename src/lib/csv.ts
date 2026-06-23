/**
 * Minimal RFC-4180 CSV helpers — no dependency, used by the roster import.
 *
 * `parseCsv` is a single-pass state machine that handles quoted fields with
 * embedded commas/newlines and doubled ("") escaped quotes. Fully blank lines
 * are dropped (so a trailing newline or stray blank row never yields a phantom
 * record). `toCsv` is the inverse, used to build the downloadable error report.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n") {
      endRow();
    } else if (c === "\r") {
      endRow();
      if (input[i + 1] === "\n") i++; // swallow the LF of a CRLF pair
    } else {
      field += c;
    }
  }

  // Flush a final record that wasn't terminated by a newline.
  if (field.length > 0 || row.length > 0) endRow();

  // Drop blank lines (a single empty/whitespace-only field carries no record).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

const NEEDS_QUOTING = /[",\r\n]/;

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return rows
    .map((row) =>
      row
        .map((field) =>
          NEEDS_QUOTING.test(field) ? `"${field.replace(/"/g, '""')}"` : field,
        )
        .join(","),
    )
    .join("\r\n");
}
