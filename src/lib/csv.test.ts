import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows and a header", () => {
    expect(parseCsv("account,name,email\n123,Jane,jane@x.com")).toEqual([
      ["account", "name", "email"],
      ["123", "Jane", "jane@x.com"],
    ]);
  });

  it("trims a trailing newline (no empty final row)", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("unquotes fields and keeps embedded commas", () => {
    expect(parseCsv('id,name\n1,"Doe, Jane"')).toEqual([
      ["id", "name"],
      ["1", "Doe, Jane"],
    ]);
  });

  it("keeps embedded newlines inside quotes", () => {
    expect(parseCsv('note\n"line1\nline2"')).toEqual([["note"], ["line1\nline2"]]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('q\n"she said ""hi"""')).toEqual([["q"], ['she said "hi"']]);
  });

  it("preserves empty fields and leading zeros", () => {
    expect(parseCsv("a,b,c\n00123,,x")).toEqual([
      ["a", "b", "c"],
      ["00123", "", "x"],
    ]);
  });

  it("returns [] for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   \n  ")).toEqual([]);
  });

  it("does not split commas that sit inside quotes spanning the row", () => {
    expect(parseCsv('"a,b","c,d"')).toEqual([["a,b", "c,d"]]);
  });
});

describe("toCsv", () => {
  it("joins plain rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("quotes fields with commas, quotes, or newlines and doubles quotes", () => {
    expect(toCsv([["Doe, Jane", 'say "hi"', "two\nlines"]])).toBe(
      '"Doe, Jane","say ""hi""","two\nlines"',
    );
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["account", "name", "email"],
      ["00123", "Doe, Jane", "jane@x.com"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
