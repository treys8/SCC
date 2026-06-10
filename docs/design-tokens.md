# Design tokens — single source of truth

The foundation lives in **`src/app/globals.css`** (Tailwind v4 `@theme`, no
`tailwind.config`). This doc summarizes the token set and flags every place a
page or component still uses a one-off value that deviates from it.

Scope of the audit: the **Today**, **Feed**, **Reservations**, and **Calendar**
pages and every component they render. This pass only *normalized the
foundation* — it added named tokens and did **not** touch component markup, so
visuals are unchanged. Deviations below are debt to reconcile in later passes.

---

## 1. The token set

### Color — brand & surface (already canonical, unchanged)
| Token | Value | Role |
| --- | --- | --- |
| `--background` | `#f6f3ea` | App background (parchment) |
| `--surface` | `#ffffff` | Card / sheet surface |
| `--surface-2` | `#fbf9f3` | Inset / hover surface, image placeholders |
| `--foreground` | `#1c2620` | Ink / primary text |
| `--muted` | `#6b7269` | Secondary text |
| `--border` | `#e4ddcd` | Hairlines, dividers |
| `--primary` | `#335d3b` | Club green — brand, buttons, tennis |
| `--primary-600` | `#2c5234` | **Unused** (see flag D1) |
| `--primary-700` | `#244328` | Button hover |
| `--accent` | `#b08d57` | Gold — dining |
| `--accent-600` | `#99784a` | Gold text / “View all →” |
| `--danger` | `#b3261e` | Destructive, declined, errors |
| `--success` | `#2d6a4f` | Golf, confirmed, open, success text |
| `--ring` | `rgba(51,93,59,.35)` | Focus ring |

### Color — extended category palette (**new** this pass)
These four hues were previously raw Tailwind classes (`sky/violet/amber/slate`)
hardcoded in `badges.tsx`, `calendar-view.tsx`, and `attachment-list.tsx`. They
now have one home. Values are Tailwind v4’s OKLCH defaults copied verbatim, so
adopting them is a **visual no-op**. Each hue has three stops:
`-soft` (badge bg, was `*-100`) · base (calendar dot, was `*-500`) · `-strong`
(badge text, was `*-700`, amber `*-800`).

| Token family | base = dot | `-soft` = badge bg | `-strong` = badge text | Used by |
| --- | --- | --- | --- | --- |
| `--info` | sky-500 | sky-100 | sky-700 | pool · frost delay · DOC |
| `--violet` | violet-500 | violet-100 | violet-700 | social |
| `--warning` | amber-500 | amber-100 | amber-800 | pro_shop · lightning hold |
| `--neutral` | slate-500 | slate-100 | slate-700 | membership · rain delay · TXT |

All twelve are registered in `@theme` as `--color-info`, `--color-info-soft`,
`--color-info-strong`, … so utilities (`bg-info-soft`, `text-info-strong`,
`bg-info`) generate for the later adoption pass.

### Category → color map (the full 8, in one table)
| Department | Badge bg | Badge text | Calendar dot |
| --- | --- | --- | --- |
| golf | `success`/10 | `success` | `success` |
| dining | `accent`/10 | `accent-600` | `accent` |
| tennis | `primary`/10 | `primary` | `primary` |
| general | `foreground`/10 | `muted` | `muted` |
| pool | `info-soft` | `info-strong` | `info` |
| social | `violet-soft` | `violet-strong` | `violet` |
| pro_shop | `warning-soft` | `warning-strong` | `warning` |
| membership | `neutral-soft` | `neutral-strong` | `neutral` |

All badge backgrounds now use the canonical **10%** tint (group B reconciled).

### Type scale — semantic role classes (single source of truth)
Headings and body now use **role classes** defined in `globals.css` (`@layer
components`), each bundling family + size + weight + leading + tracking so a role
sets the whole thing and the scale can't drift. Compose with colour utilities
(`text-foreground`, `text-muted`); the role classes set no colour.

| Class | Size | Family | Role |
| --- | --- | --- | --- |
| `.text-display` | 30→36px | serif | the Today hero greeting (front-door moment) |
| `.text-h1` | 24px | serif | page titles, detail / auth / calendar-month titles |
| `.text-h2` | 20px | serif | section & card titles |
| `.text-body` | 16px | sans | running prose (1.5 leading, ~65ch measure) |
| `.text-caption` | 12px | sans | timestamps, eyebrows, meta, fine print |

`text-sm` (14px) stays the general-purpose UI text (labels, table cells,
single-line secondary lines) between `body` and `caption`. Raw steps `text-2xs`
(new, 10px) and the Tailwind defaults remain available for non-prose numerals
(e.g. the date-chip day numeral) that aren't type-scale roles.

### Font weight
`font-normal` (400) · `font-medium` (500, dominant) · `font-semibold` (600,
headings & numerals) · `font-bold` (700, **one outlier** — see flag E1).

### Font family
`--font-sans` Inter (body) · `--font-serif` Playfair Display (`h1–h3`,
`.font-serif`). Canonical and consistent.

### Radius (Tailwind steps, mapped to roles via component classes)
`rounded-md` controls (`.btn`, `.input`) · `rounded-lg` chips, menus,
attachment tiles · `rounded-xl` cards (`.card`), galleries · `rounded-full`
pills, badges, avatars, dots. Bare `rounded` appears only on skeleton bars.

### Elevation (Tailwind shadow steps, by role)
`shadow-sm` cards (`.card`) · `shadow-md` popover menu (`post-actions`) ·
`shadow-lg` floating UI (feed FAB, “N new posts” pill). Consistent.

### Component classes (in `globals.css`, unchanged & canonical)
`.btn` + `.btn-primary/-accent/-outline/-ghost/-danger/-sm` · `.card` ·
`.input/.select/.textarea` · `.label` · `.field-hint` · `.badge`.

---

## 2. Deviation report

### A. Off-system palette — ✅ RECONCILED (adopted the new tokens; zero pixel change)
| # | File | Was | Now |
| --- | --- | --- | --- |
| A1 | `components/badges.tsx` (dept) | `sky/violet/amber/slate`-100/700-800 | `bg-{info,violet,warning,neutral}-soft text-…-strong` |
| A2 | `components/badges.tsx` (facility) | frost sky, rain slate, lightning amber | `info` / `neutral` / `warning` soft+strong |
| A3 | `components/calendar/calendar-view.tsx` | `DOT` map duplicated badge palette as `bg-{sky,violet,amber,slate}-500` | `bg-{info,violet,warning,neutral}` |
| A4 | `components/attachment-list.tsx` | DOC/DOCX `bg-sky-100 text-sky-700` | `bg-info-soft text-info-strong` |

> A3 was the clearest duplication — the file’s comment literally said the dot map
> was “mirroring the badge palette.” Both now read from the same tokens, so badge
> and dot can’t drift apart. The `info/violet/warning/neutral` tokens hold the
> exact OKLCH values of `sky/violet/amber/slate`, verified pixel-identical in the
> built CSS (`.bg-info-soft → var(--info-soft) → oklch(95.1% … )` = sky-100).
> No raw `sky/violet/amber/slate` class remains anywhere in `src`.

### B. Badge tint opacity — ✅ RECONCILED to canonical **/10**
| # | File | Was | Now |
| --- | --- | --- | --- |
| B1 | `badges.tsx` 15, 37; `post-card.tsx` 49; `attachment-list.tsx` 11–12 | `bg-accent/15` (dining, pending, pinned, PPT) | `bg-accent/10` |
| B2 | `badges.tsx` 17, 40; `attachment-list.tsx` 13, 42 | `bg-foreground/5` (general, cancelled, TXT, file-tag default) | `bg-foreground/10` |

> golf/tennis/confirmed/declined/open already used `/10`; B1–B2 were the only
> outliers. Applied 2026-06-10 — a small, deliberate pixel shift (dining/pending/
> pinned/PPT slightly lighter; general/cancelled/TXT slightly darker). All badge
> backgrounds are now their text colour at 10%.

### C. Type-size one-offs
| # | File | Status | Detail |
| --- | --- | --- | --- |
| C1 | `date-chip.tsx`, `calendar-view.tsx`, `attachment-list.tsx`, `notification-bell.tsx`, `bottom-nav.tsx`, `post-composer.tsx` | ✅ RECONCILED | all 6 `text-[10px]` → `text-2xs`. Pixel-identical at default root font; now rem-based so it respects user font scaling. No `text-[10px]` left in `src`. |
| C2 | `components/post-card.tsx` | ✅ RESOLVED | `text-[15px]` post body → `.text-body` (16px) via the new type-scale roles. The standalone 15px step was dropped in favour of the semantic `body` role. |

### D. Tokens themselves
| # | Where | Issue | Suggested action |
| --- | --- | --- | --- |
| D1 | `globals.css` `--primary-600` (#2c5234) | **Dead token** — defined + registered in `@theme`, referenced nowhere | Remove, *or* repurpose. It’s also a **near-identical green to `--success`** (#2d6a4f) — your “three near-identical greens” case (`#335d3b` / `#2c5234` / `#2d6a4f`). Decide whether `success` should remain a distinct green or alias the brand. |

### E. Font weight — ✅ RESOLVED
| # | File | Was | Now |
| --- | --- | --- | --- |
| E1 | `components/calendar/date-chip.tsx` | `font-bold` day numeral | `font-semibold` — matches every other prominent numeral/heading. |

> The only `font-bold` left in `src` is the tiny 10px file-type tag in
> `attachment-list.tsx` (PDF/DOC/…). Bold at that size aids legibility — kept as
> intentional, not drift.

### F. Translucent overlays / scrims (near-duplicates)
| # | File | Line | Current | Note |
| --- | --- | --- | --- | --- |
| F1 | `components/post-gallery.tsx` | 117 | `bg-black/55` (“+N” overlay) | vs `bg-black/60` used by the dropzone scrims (`event-form`, `post-composer`). Pick one (60). |
| F2 | `components/feed-filter.tsx` 35 vs `bottom-nav.tsx` 27 | — | sticky translucent bar uses `bg-background/85` in one place, `bg-surface/95` in the other | Align the “frosted bar” alpha + base. |
| — | `lightbox.tsx` (`bg-black/95`, `bg-white/10`, `/20`, `text-white/80`) | — | self-consistent within the lightbox; fine as-is | If desired, name as `--scrim-*` tokens later. |

> Overlay/scrim tokens were intentionally **not** added this pass — they’re few
> and confined to the media viewers. Listed for completeness.

---

## 3. What changed

### Pass 1 — foundation (no visual change)
- **`src/app/globals.css`** — purely additive: a new `:root` block with the
  12 extended-category tokens + documentation comments, and 13 `@theme`
  registrations (`--color-info*`, `--color-violet*`, `--color-warning*`,
  `--color-neutral*`, `--text-2xs`). No existing rule was modified.

### Pass 2 — group B reconciled (deliberate small pixel shift)
- **`badges.tsx`, `post-card.tsx`, `attachment-list.tsx`** — all 9 badge/file-tag
  backgrounds moved to the canonical 10% tint (`accent/15→/10`,
  `foreground/5→/10`). `globals.css` tint comment updated to reflect conformance.

### Pass 3 — group A reconciled (zero pixel change)
- **`badges.tsx` (dept + facility), `attachment-list.tsx`, `calendar-view.tsx`** —
  all raw `sky/violet/amber/slate` classes replaced with the `info/violet/warning/
  neutral` tokens. The duplicated calendar `DOT` map now reads from the same
  palette as the badges. No raw Tailwind palette class remains in `src`.

### Pass 4 — group C1 reconciled (zero pixel change)
- **`date-chip.tsx`, `calendar-view.tsx`, `attachment-list.tsx`, `notification-bell.tsx`,
  `bottom-nav.tsx`, `post-composer.tsx`** — all 6 `text-[10px]` one-offs → the
  `text-2xs` token. `.text-2xs` resolves to `font-size:.625rem` (= 10px at default
  root), so it's identical and now scales with user font-size preferences.

Verified with `next build` (compiles clean; `text-2xs` generates).

### Pass 5 — type-scale roles (C2 resolved + heading rollout)
A semantic type scale (`.text-display/.text-h1/.text-h2/.text-body/.text-caption`)
was introduced in `globals.css` as the heading/body single source of truth, with
`.text-display` carrying the responsive hero step (`sm:text-4xl`). The rollout
across the four pages and their components is **complete**:
- **C2 resolved**: post body → `.text-body` (16px); the standalone 15px step dropped.
- Card/section titles → `.text-h2`; page titles → `.text-h1`, the Today hero →
  `.text-display` (the one responsive role, 30→36px); the calendar month label →
  `.text-h1`, selected-day → `.text-h2`. Body prose (post content, event
  description, hero summary) → `.text-body`; eyebrows/timestamps/meta → `.text-caption`.
- **Intentionally not roles** (not drift): the `site-nav` wordmark and the
  `date-chip` day numeral — display lettering & numerals, not type-scale prose.
  `text-sm` (14px) remains general-purpose UI text.

Remaining flags: **D** (dead `--primary-600` / near-identical green — needs your
call), **F** (scrims). **B, C, E and the type-scale rollout are done.**
