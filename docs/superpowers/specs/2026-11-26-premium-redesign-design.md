# Premium redesign — "Type & color" (Direction B)

**Date:** 2026-11-26 · **Status:** approved (Trey) · **Branch:** `design/premium-refresh`

## Why
The Today page read as a generic SaaS dashboard: every section the same white
bordered box, four repeated "Open" pills, a placeholder-looking gold fork block,
and a wordmark that wrapped to three lines. A private club should feel premium
and editorial. Two directions were mocked (photo-led vs. type & color); Trey
chose **B · Type & color** and a **full app pass** (every member page, not just
Today).

## Goals / non-goals
- **Goals:** a deep club-green header and title band with a gold hairline;
  large, light Playfair headlines with gold italic accents; hairline rules
  instead of boxes; dining set like a printed menu; consistent across phone,
  desktop, sign-in and the installed PWA.
- **Non-goals:** no data or behaviour changes; no stock photography (the club
  has no photo library yet); no bespoke redesign of the staff `/manage`
  console (it inherits the primitives and band only).
- **Anti-goals:** contrast regressions (gold on parchment is only 2.8:1 — small
  gold text uses `--gold-ink` instead); horizontal scroll from full-bleed bands;
  a Today-shaped loading skeleton flashing on other routes.

## Approaches considered
1. Today only — fastest, but the jump to other pages looks worse.
2. Shared shell + Today — premium frame everywhere, pages later.
3. **Full app pass (chosen)** — shell + Today first, a checkpoint review with
   Trey, then every member page.

## Design decisions
- **Tokens** (`globals.css`): `--green-deep #1d3523`, `--green-darker #152a1b`,
  `--cream #f3eee2`, `--gold-soft #d9c29a` (accent on green, 7.6:1),
  `--gold-ink #7d6136` (small gold on parchment, 5.2:1). Existing category
  palette unchanged.
- **Type:** `.text-display` / `.text-h1` go large and light; `.text-h2` stays
  compact (it's ~50 in-card titles). New `.text-section`, `.text-hero`,
  `.eyebrow`. Playfair loads italic.
- **Primitives:** `.card` flat (hairline, no shadow); buttons pill-shaped,
  primary = deep green; new `.rule-list` and `.section-rule`. Buttons on a
  green `.band` invert to gold/cream.
- **Shell:** green header with one-line wordmark (hidden lg–xl, when the link
  row needs the room); links lg+, hamburger below. Staff tools (Directory,
  Manage, Members) moved into an avatar-menu "Staff" group and a drawer
  "Staff" section (Trey's call). Green drawer, green bottom tab bar, green
  footer, green sign-in. `themeColor` → deep green.
- **PageHeader** is a full-bleed green title band (the `(50vw − 50%)` breakout
  keeps its content on the page's own column); it must be a page's first
  element because `<main>` no longer has top padding. Detail pages (post,
  event, facility) get a band with a back link.
- **Today:** green hero (gold-italic name, concierge line, big temperature on
  md+); conditions as one hairline strip (4-up / 2×2) with serif status in the
  facility-status palette for every state; dining via `DiningCard
  variant="feature"`; events as a ruled list with an italic empty state.

## Left to the builder
Per-page restyles in §4 follow the pattern: band via PageHeader,
`card divide-y` lists → `.rule-list`, section h2s → `.section-rule`, chips
with a gold active state.
