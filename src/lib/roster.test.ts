import { describe, expect, it } from "vitest";
import {
  type RosterInput,
  duplicateEmailRows,
  guessColumnMapping,
  validateRow,
} from "./roster";

function input(p: Partial<RosterInput>): RosterInput {
  return { rowNumber: 1, accountNumber: "123", fullName: "Jane Member", email: "jane@x.com", ...p };
}

describe("validateRow", () => {
  it("accepts a full valid row", () => {
    expect(validateRow(input({}))).toEqual({ kind: "ok" });
  });

  it("treats a missing email as account-only, not an error", () => {
    expect(validateRow(input({ email: "" }))).toEqual({ kind: "no_email" });
    expect(validateRow(input({ email: "   " }))).toEqual({ kind: "no_email" });
  });

  it("rejects a malformed email", () => {
    expect(validateRow(input({ email: "not-an-email" })).kind).toBe("error");
  });

  it("rejects a missing name", () => {
    expect(validateRow(input({ fullName: "" })).kind).toBe("error");
    expect(validateRow(input({ fullName: "   " })).kind).toBe("error");
  });

  it("rejects a bad account number", () => {
    expect(validateRow(input({ accountNumber: "" })).kind).toBe("error");
    expect(validateRow(input({ accountNumber: "abc" })).kind).toBe("error");
    expect(validateRow(input({ accountNumber: "123456" })).kind).toBe("error");
  });

  it("keeps leading zeros valid", () => {
    expect(validateRow(input({ accountNumber: "00123" }))).toEqual({ kind: "ok" });
  });
});

describe("duplicateEmailRows", () => {
  it("flags the 2nd+ occurrence of a repeated email, case-insensitively", () => {
    const rows: RosterInput[] = [
      input({ rowNumber: 1, email: "a@x.com" }),
      input({ rowNumber: 2, email: "B@X.com" }),
      input({ rowNumber: 3, email: "a@x.com" }),
      input({ rowNumber: 4, email: "b@x.com" }),
    ];
    expect(duplicateEmailRows(rows)).toEqual(new Set([3, 4]));
  });

  it("ignores blank emails and does not flag repeated account numbers (households)", () => {
    const rows: RosterInput[] = [
      input({ rowNumber: 1, accountNumber: "10", email: "" }),
      input({ rowNumber: 2, accountNumber: "10", email: "" }),
      input({ rowNumber: 3, accountNumber: "10", email: "spouse@x.com" }),
    ];
    expect(duplicateEmailRows(rows)).toEqual(new Set());
  });
});

describe("guessColumnMapping", () => {
  it("maps exact template headers", () => {
    expect(guessColumnMapping(["account_number", "full_name", "email"])).toEqual({
      accountNumber: 0,
      fullName: 1,
      email: 2,
    });
  });

  it("maps human-formatted headers", () => {
    expect(guessColumnMapping(["Account #", "Member Name", "Email Address"])).toEqual({
      accountNumber: 0,
      fullName: 1,
      email: 2,
    });
  });

  it("maps abbreviations and punctuation", () => {
    expect(guessColumnMapping(["Acct", "Name", "E-mail"])).toEqual({
      accountNumber: 0,
      fullName: 1,
      email: 2,
    });
  });

  it("returns null for columns it cannot identify", () => {
    expect(guessColumnMapping(["foo", "bar"])).toEqual({
      accountNumber: null,
      fullName: null,
      email: null,
    });
  });
});
