import { describe, expect, it } from "vitest";
import {
  REGISTRATION_URL_ERROR,
  isAllowedPushEndpoint,
  parseRegistrationUrl,
  safeInternalPath,
} from "./url";

/**
 * Same-origin path guard used by login redirects and notification deep links.
 * A bare startsWith("/") check is not enough — //evil.com is still dangerous.
 */
describe("safeInternalPath", () => {
  it("accepts a normal app path", () => {
    expect(safeInternalPath("/reservations")).toBe("/reservations");
  });

  it("accepts nested paths with query strings", () => {
    expect(safeInternalPath("/posts/abc?x=1")).toBe("/posts/abc?x=1");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalPath("//evil.com")).toBe("/");
  });

  it("rejects backslash smuggling", () => {
    expect(safeInternalPath("/\\evil.com")).toBe("/");
  });

  it("rejects absolute http(s) URLs", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
  });

  it("rejects empty / nullish input", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });

  it("honours a custom fallback", () => {
    expect(safeInternalPath("//evil.com", "/home")).toBe("/home");
  });
});

/** Web Push endpoint allowlist — rejects junk/SSRF targets before we store or POST. */
describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/foo",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-c.wns.notify.windows.com/y",
  ])("allows %s", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/x",
    "https://evil.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.com/x",
    "not-a-url",
    "",
  ])("rejects %s", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

/**
 * The guard behind the Register button. Anything it lets through is rendered as
 * an `<a href>` for every member, so the interesting cases are the rejections.
 */
describe("parseRegistrationUrl", () => {
  describe("accepts", () => {
    it("a full https URL, unchanged", () => {
      expect(parseRegistrationUrl("https://golfgenius.com/e/123")).toEqual({
        url: "https://golfgenius.com/e/123",
      });
    });

    it("http as well as https", () => {
      expect(parseRegistrationUrl("http://golfgenius.com/e/123").url).toBe(
        "http://golfgenius.com/e/123",
      );
    });

    it("a pasted link with no scheme, defaulting to https", () => {
      expect(parseRegistrationUrl("golfgenius.com/e/123").url).toBe(
        "https://golfgenius.com/e/123",
      );
    });

    it("a bare domain", () => {
      expect(parseRegistrationUrl("golfgenius.com").url).toBe(
        "https://golfgenius.com/",
      );
    });

    it("surrounding whitespace", () => {
      expect(parseRegistrationUrl("  https://golfgenius.com/e/123  ").url).toBe(
        "https://golfgenius.com/e/123",
      );
    });

    it("an uppercase scheme, normalizing the host", () => {
      expect(parseRegistrationUrl("HTTPS://GolfGenius.com/E/123").url).toBe(
        "https://golfgenius.com/E/123",
      );
    });

    it("a query string and fragment", () => {
      expect(parseRegistrationUrl("golfgenius.com/e?id=7#tee").url).toBe(
        "https://golfgenius.com/e?id=7#tee",
      );
    });

    it("a subdomain", () => {
      expect(parseRegistrationUrl("www.golfgenius.com/e").url).toBe(
        "https://www.golfgenius.com/e",
      );
    });
  });

  describe("treats as absent", () => {
    it.each(["", "   "])("blank input %o, with no error", (input) => {
      expect(parseRegistrationUrl(input)).toEqual({ url: null });
    });
  });

  describe("rejects", () => {
    // Each of these would otherwise persist and render as a dead or dangerous
    // link behind a prominent Register button.
    it.each([
      ["a non-web scheme", "mailto:pro@starkvillecc.com"],
      ["a javascript: URL", "javascript:alert(1)"],
      ["a data: URL", "data:text/html,<script>alert(1)</script>"],
      ["the single-slash typo", "https:/golfgenius.com"],
      ["a placeholder word", "TBD"],
      ["another placeholder", "N/A"],
      ["a hostname with no TLD", "localhost"],
      ["a sentence", "ask the pro shop"],
      ["a trailing dot with no TLD", "golfgenius."],
    ])("%s", (_label, input) => {
      expect(parseRegistrationUrl(input)).toEqual({
        url: null,
        error: REGISTRATION_URL_ERROR,
      });
    });
  });
});
