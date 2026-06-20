# Today page — desktop dashboard re-layout

**Date:** 2026-06-20
**Status:** Approved design, pending plan
**Scope:** Presentational re-layout of the member Today page (`src/app/(app)/page.tsx`). No data, logic, or behavior changes.

## Problem

On desktop the Today page is the mobile single-column stack inflated to `max-w-6xl`
(1152px). Two kinds of whitespace result:

- **Horizontal dead-centers (primary).** Every block is a full-width row whose
  content hugs both edges. A conditions row reads `[icon] Golf Course … Open ›`
  with ~700px of nothing between the name and the badge. Low content density per
  very wide row → reads as empty.
- **Vertical air (secondary).** ~5 stacked blocks with `space-y-10` (40px) gaps on
  a tall viewport.

Root cause: the page does not use the desktop's two dimensions — it's a tall narrow
document stretched sideways.

## Decision

Convert the desktop layout to a **two-column dashboard**, scoped entirely to the
`lg:` breakpoint, and **tighten mobile** vertical rhythm. Mobile structure and DOM
source order are preserved; only additive `lg:*` classes plus modest base-gap trims.

Chosen over:
- *Narrow the column* (`max-w-3xl`) — stops the stretch but doesn't use the width;
  rejected because the goal is a denser dashboard feel.
- *Conditions row-list everywhere, two-column only* — leaves a tall narrow stretched
  list inside the new left column, partly re-creating the original problem.

## Desktop layout (`lg` and up)

Grid: wide main column + fixed-width rail.

- Container: `lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8` (≈320px rail).
  - **Fixed rail chosen** over a proportional 2:1 split — predictable, doesn't
    balloon the rail on ultra-wide monitors.
- Editorial logic: **left = state of the club, right = what to do today.**

### Left / main column
1. **Hero** (`TodayHero`) — unchanged content.
2. **Featured card** (`FeaturedCard`) — highlighted event if present; stays adjacent
   to the hero.
3. **Conditions** — heading + a **2×2 card grid** on desktop (`lg:grid-cols-2`).
   Each tile carries icon, facility name, one-line summary, and status badge — the
   current `ConditionRow`, recomposed as a tile. This is the page centerpiece, so it
   keeps the prominent wider column.

### Right / rail
4. **Dining today** — lunch buffet card (`BuffetCard`) + Fri/Sat dinner / Sunday
   brunch (`DiningCard`), grouped.
5. **Today's schedule** — events list (`TodayEvents`) with the existing
   "Full calendar →" link.

Balance note: on Fri/Sat the rail fills with dinner + events; on a quiet Monday both
sides are simply short — short reads as calm, not empty. Acceptable.

## Mobile (below `lg`): same content, tightened

- Collapses to the current single column. **Source order preserved**: hero →
  featured → conditions → buffet → dinner/brunch → events. In a CSS grid the mobile
  fallback renders in source order, so the rail markup must keep this order.
- **Conditions stays the row-list** below `lg`; the 2×2 grid is `lg:`-only (one
  component, two arrangements via breakpoint classes).
- **Tightening**: section gaps `space-y-8 sm:space-y-10` → `space-y-6 sm:space-y-8`;
  shave conditions row padding a touch (`py-3.5` → `py-3`). Gets its own before/after
  check.

## Explicitly unchanged

- All data fetching, `conciergeSummary` logic, weather, reservation/dining/event
  logic — untouched. Purely a presentational re-layout of existing blocks.
- **Staff `canManage` branch** keeps the current editable `FacilityStatusWidget`
  (row editor), placed in the main column. The 2×2 card grid is **members-first**;
  staff treatment deferred. The editable widget is not restyled in this change.

## Affected files (anticipated)

- `src/app/(app)/page.tsx` — grid wrapper; move dining/events blocks into a rail
  container; preserve source order.
- `src/components/conditions-grid.tsx` — add `lg:` 2×2 tile arrangement alongside the
  existing row-list.
- Possibly a small rail wrapper / "Dining today" grouping element.

## Success criteria

- Desktop: no full-width single-content rows on Today; conditions render as a 2×2
  grid; dining + events sit in a ~320px right rail; page height roughly halves.
- Mobile: visually unchanged except slightly tighter vertical rhythm; conditions
  remain a row-list; block order identical to today.
- No change to any fetched data, summary text, or interactive behavior.
