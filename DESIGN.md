# DRISHTI design system

## Point of view
DRISHTI is read like a **flood bulletin**, not a SaaS dashboard. Hydrological agencies have published
river-level bulletins for a century: ruled tables, numbered sections, a date line, one sentence of
summary, figures aligned on the decimal. We borrow that authority and make it interactive.

The reference is the printed gazette and the survey sheet. It is **not** neon-on-navy, glass cards,
glow, gradients or pills. The audience is a duty officer and an examiner: they need to find the number,
trust it, and know where it came from.

### Principles
1. **Bulletin, not dashboard.** Structure comes from rules, columns and numbered sections instead of boxed cards.
2. **Colour is reserved for state.** Everything is ink on paper. Only severity and the single water-blue data colour carry hue, so a coloured mark always means something.
3. **Shape plus colour.** Severity is never colour alone: each level has its own glyph (see below), so it survives greyscale, colour-blindness and a washed-out projector.
4. **Numbers are typography.** Tabular monospace figures, right-aligned, large when they matter.
5. **Always show provenance.** Every page states its "as of" time, and the data is stamped SIMULATED. Honesty is a visible part of the design.
6. **Projector-first.** Light paper background; meeting-room projectors wash out dark UIs.

## Tokens (single source: `client/src/tokens.js`, injected as CSS variables)

### Colour
| Token | Value | Use |
|---|---|---|
| `paper` | `#F1F3EF` | page ground (cool grey-green, deliberately not cream) |
| `surface` | `#FAFBF8` | inputs, map panels, drawer content |
| `sunken` | `#E6EAE4` | table hover, code blocks |
| `rule` | `#CBD2CA` | hairlines |
| `ink` | `#15211E` | text, strong rules, primary buttons |
| `ink-2` / `ink-3` | `#43524E` / `#6C7A75` | secondary / tertiary text |
| `water` | `#0B5C7A` | the one data colour: rainfall, levels, links |
| `sev-normal` | `#5B8A8F` | grey-teal, calm, recedes |
| `sev-elevated` | `#C79A1B` | ochre |
| `sev-high` | `#D1561F` | vermilion |
| `sev-critical` | `#A3102E` | crimson, always paired with an ink outline |

Text never sits on a severity colour except in ink or paper at ≥ 4.5:1. Severity colours are fills and marks, not text colours.

### Severity glyphs
| Level | Glyph | Score |
|---|---|---|
| NORMAL | hollow circle | < 30 |
| ELEVATED | solid circle | 30–50 |
| HIGH | solid triangle | 50–70 |
| CRITICAL | solid diamond inside a ring | ≥ 70 |

### Type
| Role | Face | Notes |
|---|---|---|
| Display / headings | IBM Plex Serif 600–700 | gazette voice; the wordmark and summary sentence |
| UI text | IBM Plex Sans 400–600 | |
| Figures, IDs, times, code | IBM Plex Mono 400–600 | tabular, aligned |
| Hindi wordmark | Tiro Devanagari Hindi | दृष्टि |

All fonts are self-hosted (`@fontsource`) so the app works offline.
Scale (px): 11 label · 12 meta · 14 body · 16 · 20 section · 30 lede · 44 figure.
Labels are 11 px uppercase with +0.08 em tracking.

### Space, shape, depth
- 4 px base grid: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Radius **2 px**. Instruments have corners. No pills, no circles for UI chrome.
- No shadows. Depth is a rule and a scrim. The gauge sheet slides in over a 25 % ink scrim with a 2 px ink left rule.
- Rules: 1 px `rule` for rows, 2 px `ink` to open a section, 4 px `ink` over the masthead.

### Motion
160 ms ease-out for the drawer only. One live indicator that blinks in steps (not a glow). Nothing pulses.

## Components
| Component | Spec |
|---|---|
| Masthead | 4 px ink top rule · wordmark + full form · numbered nav · as-of block · SIMULATED stamp |
| Section | 2 px ink rule, mono number, serif title, right-aligned mono meta (query time, counts) |
| Lede | one generated sentence in serif that states the situation |
| Waffle | one square per gauge, ordered by score; the whole network at a glance |
| Table | small-caps header, hairline rows, numbers right-aligned in mono, row hover = `sunken` |
| Button | 2 px radius, 1 px ink border; primary = ink fill; secondary = outline |
| Segmented | bordered group, selected = ink fill |
| Map | light-grey Esri base; severity glyph markers sized by score; dashed zone outlines; ruled legend panel |
| Gauge sheet | drawer: id (mono) · name (serif) · score on a banded scale · reasons as a definition list · chart · tables |

## Data visualisation
- One hue per chart unless the hue encodes a category the reader must separate.
- No chart box, no vertical grid, hairline horizontal grid, mono 11 px tick labels in `ink-3`.
- Continent comparisons use **small multiples** with a shared y-scale instead of six overlapping lines.
- Threshold lines (warning, danger) are drawn in the severity colour and labelled directly on the line.
- Prefer direct labels to legends.

## Voice
Plain, specific, no marketing language. "River at 98 % of danger level, rising 0.21 m/h" is the register.
