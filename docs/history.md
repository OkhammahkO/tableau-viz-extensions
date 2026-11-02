# History

_Last updated 2026-10-29 (end of session 1)._

## v1.0 (2026-10-31)

Raincloud v1.0 tagged: everything in CHANGELOG.md. Release steps and known limitations: [RELEASE.md](RELEASE.md).
Post-v1 priorities (agreed list): theme/dark backgrounds, highlights from other sheets (F11), export (F12), keyboard
(F10), clickable legend, summary table (F13); nice to have F8, F15, F9; on hold F5–F7.

## Where we are

**Phase 0: research + workspace + hello viz. ✅ Done.**

- Workspace: Vite 8 + TypeScript 7 + d3, Node 26, Extensions API 1.17.0 bundled in `public/lib/`.
- Skill: `.claude/skills/tableau-viz-extension/SKILL.md` holds everything below in reusable form.
- Hello Viz (`hello-viz.trex`, `src/main.ts`) **passed all 9 checks in Tableau Desktop**:
  instructions screen with empty encodings, render, native hover tooltips (correct mark), click and
  Ctrl+click selection, clearing, keyboard focus navigation, Enter to select, Esc to leave, redraw on
  filter with the selection kept, and resize.

### Verified in Tableau (not just from docs)

| Finding | Detail |
|---|---|
| Tuple ID = row index + 1 | Across pages. The 1.17 type docs say `totalRows - index`; that's wrong. |
| Don't use `getAllPagesAsync` | Throws on 0 rows. Loop `pageCount` / `getPageAsync`. |
| Never `hoverTupleAsync(-1)` | → "Error parsing command parameter value string". On mouse-out, clear local state only. |
| Keyboard on `document` | Element-level listeners miss keys; Tableau's Sankey uses `document.onkeydown`. |
| Focus ≠ selection | Arrows move focus (outline + tooltip), Enter selects. Make the focus ring visually distinct. |
| Encodings return `FieldInstance` | Match `field.name === column.fieldName`. |
| Reloading a viz extension | Vite reloads on save, or Ctrl+R in the attached DevTools. There's no "More Options → Reload" (dashboard-only). Re-add after `.trex` edits. |

### Still unknown / to check
- Tableau Desktop version under test (not recorded yet; it's in the `[hello-viz] initialized` console line).
- Whether the Vite dev client runs in older Tableau (Chromium 87). We have a `build:watch` + `preview` fallback.
- Tableau Cloud/Server loading (safe-list `http://localhost:.*`), the Tableau MCP connection (`.mcp.json`), export (API 1.17).
- No `.trex` XSD is published. Manifest errors only show in `My Tableau Repository` logs.

## Concept input: transfer-flow network

`docs/concepts/flow-diagram/` (user's concept: `transfer_flows.dot` / `.png`). A rail transfer network:
origins A and B, an interchange C split into one node per line (C1, C2, both labelled "C"), onward legs
to E and F, and **transfers in both directions between C1 and C2**. Edge width = passenger flow; edge
colour = edge type (line vs transfer). Laid out top to bottom.

What this means for the build:
- **Data model is an edge list**: source node, target node, flow measure, edge type. Node id ≠ node
  label. This is not the Tableau Sankey's "levels" model.
- **Cycles and same-rank links** (C1⇄C2). **d3-sankey can't lay these out** (it requires a DAG and
  only links between different columns). Options: d3-sankey for the DAG part plus custom-routed
  same-rank/back edges; a layered graph layout (ELK.js / dagre) with width-scaled edges; or a custom
  layout, possibly with explicit rank/position fields from the data.
- Edge type → colour (a categorical encoding); flow → width; labels on edges.
- In Tableau, each summary row = one edge = one tuple, which maps cleanly to hover and selection.

## Decision (2026-10-30): two separate extensions

The user decided that **Sankey** and **network flow diagram** are separate things, built as separate
extensions on a shared core.

| | Sankey | Network flow diagram |
|---|---|---|
| Structure | Stages/levels in columns, flow moves one way (acyclic) | Any directed graph: cycles, two-way and same-level links |
| Data | Levels (dims 1→n per row) or staged source/target | Edge list: from, to, flow, edge type; node id ≠ label |
| Meaning | How a total splits and merges across stages | Movement between places: transfers, routes, interchanges |
| Layout | Columns by stage (d3-sankey) | Layered/graph layout (ELK.js / dagre / custom), maybe data-given positions |
| Benchmarks | Tableau Sankey (native), Infotopics (options) | Infotopics Circular/Recursive are nearest; largely open |

**Shared core:** the plumbing proven by the hello viz (paged reader + tuple IDs, state + `update(reason)`,
hover/select/keyboard, formatting, splash, settings, dialogs). Each extension has its own `.trex`,
encodings, layout and Format options.

## Raincloud: step 0 spike ✅ (2026-10-31, Tableau 2026.3.0)

`spike-raincloud.trex` + `src/spike/main.ts`, tested with `data/synthetic/`:
- One row per record works, via a row-ID dimension on Detail **or** Aggregate Measures off. Stats match the CSVs exactly.
- Native hover tooltips and selection work per dot (one dot = one record = one tuple).
- Nulls arrive (counts correct, all-null category kept); the null category arrives as its own member.
- 100k records: 10 pages, ~956 ms, hover OK.
- Open: the frame appeared wider than the visible area in one screenshot (unconfirmed). The real chart must size from the frame (ResizeObserver).

## Raincloud: step 1, v0.1 prototype ✅ (2026-10-31, works in Tableau 2026.3.0)

- **Axis "Whiskers + 5%"** (user idea): outermost Tukey whiskers across groups plus a 5% margin. Better than fixed
  percentiles for outliers (P1–P99 too loose, P5–P95 too tight on outliers_response_ms). Caveat: on long-tailed data it can
  hide a real tail; the edge counts show it. **Decided (user, 2026-10-31): cutting is off by default; switching it
  on selects Whiskers + 5%.** Percentiles remain an alternative.

- `raincloud.trex` / `raincloud.html` / `src/raincloud/main.ts`: Tableau adapter (Value + optional Category,
  aggregation warning, native hover/selection per dot, workbook font, ResizeObserver sizing).
- `src/charts/raincloud/`: `stats.ts` (pure maths, unit-tested), `model.ts`, `options.ts`, `render.ts`, `raincloud.css`.
- `dev.html` + `src/dev/main.ts`: harness on the synthetic CSVs with every option and a resizable frame (`npm run dev` → /dev.html).
- Defaults: ggdist style (half density clipped to data + slim Tukey box + Wilkinson dot plot); options: histogram cloud,
  strip rain, bandwidth, bins, min n for a density (5).
- **Markers (user request 2026-10-31):** mean diamond and labelled percentile ticks (`options.markers`), already drawn.
  Later: choose marker styles and labels in the Format dialog; maybe the median value as a label.
- Tests: 49 (stats unit tests + render smoke test across all datasets and option combinations).
- **Percentile truncation** (brought forward after the outliers dataset looked warped): `options.axis` cuts the view at
  pooled percentiles; statistics use all values; density and bins are computed for the visible window; cut-off values
  are counted per group (`‹ 3`, `12 ›`) with a footnote. Harness: Axis control. Tableau: off until the Format dialog.
- **Large-n dots** (100k bled into the next band): dots shrink to 1.5 px, then stacks compress (ggdist's "compress"),
  with a test that no dot leaves its band (30k records).
- Not yet: keyboard navigation, Format dialog/settings, reference lines, large-n rain rule, selection restore.

## Raincloud: step 3, Format dialog, two prototypes (built 2026-10-31, awaiting Tableau test)

User plans a **free Exchange release**, so the Tableau UI licence matters (it's "subject to Tableau EULA", not open
source). Building both to compare:
- `raincloud-tableau-ui.trex` → **Raincloud (Tableau UI)**: React 18.3.1 (as Tableau's own Sankey/Table, despite the
  library's stale `^16.9.0` peer range; npm override) + `@tableau/tableau-ui` 3.15. Dialog JS 482 KB (110 KB gz).
- `raincloud.trex` → **Raincloud (Lite)**: plain TS + CSS styled like Tableau's panes. Dialog JS 3.8 KB (1.7 KB gz).
- Same options, same live save: `settings.ts` stores one JSON string in Tableau settings (merged over defaults so old
  workbooks gain new options); the chart re-renders on SettingsChanged. Modeless 320 × 620 dialog via
  `<configure-context-menu-item/>`.
- Open question to Tableau (Exchange team): may a free Exchange extension bundle `@tableau/tableau-ui`?
- **User stance (2026-10-31): not too worried about the EULA**, since we can pivot back to Lite if needed (only the
  dialog changes). The Tableau UI library would give us a range slider (axis cut), ColorGrid with Tableau palettes
  (colour per category), SideTabs (bigger dialog), Stepper, Accordion, Spinner, design tokens.
  Final choice after the side-by-side test in Tableau.

### Feedback round 1 on the Lite dialog (2026-10-31) — fixed, awaiting re-test
- Mean marker covered the median → hollow diamond.
- New "Show values on markers": labels median, mean, percentiles; collision rows; halo.
- Smoothing slider "touchy" → logarithmic 0.25×–4×, 1× in the middle, snaps to 1×.
- Viz "going blank sometimes" → numbered refreshes, try/catch with visible error, "No values to show" message.
  Probable partial cause: dev-server reloads while code was being edited.
- "Format Extension" appears on the Marks card below the encoding tiles (confirmed by user).

## Raincloud feature backlog (2026-10-31, numbered for reference)

Decided against: **log scale** (user: no); **custom category sorting** (Tableau's native sort on the Category field
already works, because the chart keeps the order Tableau sends).

**User priorities (2026-10-31):** F2 keen · F4 yes · F14 new (layout fit) · F1 if light · F8, F12, F13 nice to have ·
F10, F11 later · F3, F5, F6, F7 on hold (F3: per-category colour gets little; colouring dots/cloud is preferred) ·
F9 to be explained again.

### Scope: F14 → F2 → F4 (proposed 2026-10-31, user idea: Rows/Columns tiles)

**Tiles (max 4):** **Value** (1 measure) · **Rows** (≤3 ordered dimensions, nested headers; innermost = one raincloud
per row; replaces Category) · **Columns** (≤2 ordered dimensions → side-by-side panels) · **Colour** (1 dimension,
sub-categories). Mirrors Tableau's shelves; Infotopics appears to do the same (rows.png/columns.png icons in its bundle).
**Confirmed (user, 2026.3.0): native Rows/Columns shelves don't work with viz extensions.** Detail and Tooltip are
always present and outside the 4-tile limit: Detail holds the row ID (record level; other dimensions there split dots
but don't group); Tooltip fields appear in the native hover tooltip for free. The instructions screen should explain that
without a row ID, a Detail dimension gives one dot per member, not per record.

- **Phase A, F14: layout engine + fit.** Grid of header + cells, a raincloud per cell (same look with one dimension).
  Size modes named like Tableau: Entire view (default) / Fit width / Fit height / Standard, each with minimum sizes
  that scroll rather than squash.
- **Phase B, F2: Rows & Columns.** Nested row headers (outer levels span); column panels with headers; shared axis
  (default) or independent; wrap after N panels when Columns has one dimension; order follows Tableau's sort.
- **Phase C, F4: Colour.** Dots coloured by sub-category (Tableau 10, member order) + legend; cloud combined
  (default) or split into overlaid semi-transparent sub-category clouds; box stays combined; single-colour choices
  for cloud and dots.
**Decisions (grilled 2026-10-31):**

| Topic | Decision |
|---|---|
| Format dialog | **Tableau UI goes forward**; Lite frozen as fallback (not maintained) |
| Category tile | **Removed**; Rows replaces it (pre-release clean break) |
| Empty Rows | One raincloud of all values, labelled with the measure name |
| Nested Rows headers | **Span** (outer member once, across its inner rows) |
| Empty combinations | **Shown** as a row with a "no values" note (grid stays regular) |
| Column axes | **Shared** by default; Format option for each panel's own range |
| Wrap (1 Columns dim) | **Auto** per row (readable width), user can override N |
| Tick labels | **Under every panel** |
| Entire view overflow | **Scroll**, minimum raincloud height **64 px** |
| Colour: cloud | **Combined** by default; Format option to split into overlaid sub-category clouds |
| Colour: box | **Combined** |
| Many colour members | Tableau 20, then smallest members grouped as grey "Other" |
| Coloured dots in stacks | **Grouped by colour** (composition per bin) |
| Review flow | Harness first, then a short Tableau checklist per phase |
| F9 large data | Leave for now; revisit with real data |
| Axis cut default | **Revised 2026-10-31: on by default (whiskers + 5%)**; hides nothing without outliers. Amber badge bottom-right when values are cut; click = show all for this viewer (not saved). Replaces the faint footnote; per-cell ‹ n / n › counts stay |
| Strip / no rain | Rain band shrinks (12 px strip, 2 px none), cloud takes the space, min row height 44 / 36 px |
| Default markers | **P5, P95 and the mean, with value labels** (median label comes with the box) |

**Progress:** Phase A (F14) ✅ committed. Phase B (F2) built 2026-10-31, awaiting harness review: `model.ts` grid
(every combination, cap 500 → existing only), `layout.ts` `computeGrid`/`autoPerRow`, renderer per cell with spanning
row headers, column headers (nested or per wrapped panel), ticks under every cell with Columns, shared/independent
axes. Manifests: `raincloud.trex` = main (Tableau UI dialog; tiles Value · Rows · Columns · Colour), `raincloud-lite.trex`
= frozen Lite; `raincloud-tableau-ui.trex` removed. Phase B ✅ committed, harness reviewed, **works in Tableau** (user).

Phase C (F4) ✅ approved and committed 2026-10-31 (Tableau check pending): `colours.ts` (Tableau 10 → 20 → 19 largest + grey Other),
dots coloured and grouped by colour within stacks (`orderWithinStacks`), legend above the grid, combined cloud turns
neutral grey with a Colour field, **Split cloud** option (share-scaled curves; stacked histogram bars), box combined.
**Polish round ✅ (harness approved 2026-10-31; Tableau check pending):** box lane (`boxLane`: gap ≥ 6 px growing 6% of row,
box 7–11 px), decimal places (`markers.decimals`, default 0, thousands separators), stable colours
(`colour.assigned` per Colour field in settings; saved by the adapter in authoring mode only when new members appear).
The three items below are now done in that round.

**Queued (user, 2026-10-31): decimal places for summary values.** Marker labels (Median, Mean, P5,
P95…) and the box tooltip get a "Decimal places" option, **default 0**. Today `fmt()` picks automatically (integers
as-is, 1–2 decimals otherwise). Natural link to F1 (axis/number formatting) later.

**Decided against (user, 2026-10-31): colouring the median/mean markers or labels.** They stay in ink; shapes
already distinguish them (solid line, hollow diamond, dashed ticks).

**Open: box looks squashed** between cloud and rain (gaps fixed at ~4 px above, 3 px below). Proposed: own lane with
minimum gaps plus gaps that scale with row height, slightly taller box. Awaiting go-ahead.

**Follow-up: stable colours.** Colours are assigned by position among members present, so filtering one out shifts
the rest. Fix by remembering member→colour in settings (also the base for per-member colour picks, F3).

- Testing: synthetic data already has `segment` and `region` → Category × Region × Segment in the harness;
  layout unit tests; Tableau checkpoint per phase.
- To verify in Tableau: native Rows in 2026.3; field order kept on multi-field tiles; summary-data order with
  several sorted dimensions.
- Dialog decision made: Tableau UI (see table).
- Considered: **F15 ECDF** as a cloud option + hover "% below" readout (not an overlay: two scales in one band).
  Native Tableau can draw a standalone ECDF. Not yet prioritised.

| # | Feature | Notes |
|---|---|---|
| F14 | **Layout fit** (user, 2026-10-31) | Tableau's Standard / Fit Width / Fit Height / Entire View don't affect the extension: it always fills the frame, with bands ≥ 64 px and vertical scrolling. Add our own Size option (Entire view: squash to fit; Fit width: fixed band height, scroll; Fit height). Check whether Tableau's Fit menu is greyed out for viz extensions and whether the API exposes it (probably not). |
| F1 | **Axis formatting** | No native axis dialog (no Rows/Columns axes; `ClassNameKey` has only worksheet, pane, title, tooltip, dividers). Inherit fonts, colours and field number formats (`applyWorksheetFormatting`); infer tick format from `formattedValue`; own Axis section: title, fixed min/max, tick count, number format (decimals, K/M, %, prefix/suffix), gridlines, reverse. |
| F2 | **Panels (small multiples)** | One panel dimension → N panels per row, then wrap. Two → a rows × columns grid like Tableau's Rows/Columns shelves. Shared vs independent axis. Uses a **Panels** encoding with ordered fields (as the Sankey's Level tile does). |
| F3 | **Colour by category** | Tableau palettes (10/20, colour-blind), per-member picks saved in settings, separate cloud/box/rain colours. Verify whether Tableau's own colour legend is reachable (probably not). |
| F4 | **Colour field (sub-categories)** | A Colour encoding (e.g. Segment): colour the dots by sub-category, and optionally split the cloud into overlaid semi-transparent sub-category densities. Plus simple single-colour choices for cloud and dots separately (the part of F3 the user wants). |
| F5 | **Reference line from a parameter** | `getParametersAsync` + ParameterChanged: targets/thresholds moved from the dashboard. |
| F6 | **Split violin** | Two groups mirrored back to back (e.g. this year vs last). |
| F7 | **Repeated-measures lines** | ggrain-style: connect each person's points across time. |
| F8 | **Vertical orientation** | |
| F9 | **Auto rain for very large n** | Quantile dots or strip above a size threshold, with a note. |
| F10 | **Keyboard navigation** | Arrows across dots, Esc to leave, screen-reader text (pattern proven in the hello viz). |
| F11 | **Selection & highlight from other sheets** | `getSelectedMarksAsync` / `getHighlightedMarksAsync`, MarkSelectionChanged. |
| F12 | **Export rendering** | PDF/image export on 2026.2+ via `reportExtensionRenderComplete`. |
| F13 | **Summary table toggle** | n, median, IQR, mean per category, for accessibility and copying. |

## Candidate list (2026-10-30)

Full list and native checks: [CANDIDATES.md](CANDIDATES.md). The leading candidate is the **composable distribution
chart** (raincloud MVP with toggleable density / box / points layers, then percentile truncation + reference lines,
then histogram). It's a clear Tableau gap with nothing on the Exchange. Also: Sankey, network flow diagram, live
parameter updater (small dashboard extension), and unchecked ideas (SPC/control charts, chord diagram).

## Decisions needed (next session)

1. **Which extension first:** distribution chart (raincloud MVP), Sankey, network flow diagram, or the small live parameter updater?
2. **UI stack for the Format dialog:** React 16 + `@tableau/tableau-ui` (pixel-native, as Tableau
   does) vs a lighter setup (Svelte or plain TS) styled to match. The viz itself is d3 either way.
3. **Layout engine for the network flow diagram:** ELK.js / dagre / custom (the Sankey uses d3-sankey).
4. **Minimum Tableau version:** 2024.2 (API 1.12) vs 2025.1 (formatting events) vs 2026.2 (export).
5. **Hosting / distribution:** internal self-host, Tableau sandbox via Exchange, or partner hosting.
   Licensing model if commercial (the market pattern is free on Desktop/Public, paid on Server/Cloud).

## Proposed phases

**Phase 1: shared core + first extension MVP**
- Extract the hello viz plumbing into a small reusable core: state + `update(reason)`, paged reader
  with tuple IDs, hover/select/keyboard, formatting, splash, API-call logging. Both extensions build on it,
  as Tableau's own extensions share a framework.
- Restructure as a multi-page Vite build: one HTML page and `.trex` per extension, plus their dialogs.
- First extension MVP: encodings, layout + render (nodes, width-scaled links, labels), native hover
  and selection per link, keyboard navigation across links and nodes.
  - Sankey: Level (≤5 dims) + Link (measure), like Tableau's.
  - Network flow: Source, Target, Flow, plus Edge Type on Colour; a rail-example CSV as test data.

**Phase 2: Format dialog + settings**
- Modeless 320 px dialog. Colours per edge type and per level, link colour modes (source / target /
  gradient), label formats (value / %), node width and padding, sorting, null handling. Persisted via
  `settings`.

**Phase 3: Differentiators**
- Cycles and bidirectional transfers done well, draggable nodes with saved positions, RTL, export
  rendering (1.17), performance at ~5k links, accessibility pass.

**Phase 4: Ship**
- Localisation, hosting, `.trex` for distribution, Exchange submission (extensiongallery@tableau.com) if wanted.

## Housekeeping
- Nothing is committed yet. First commit: workspace + docs + hello viz as a baseline.
- Hands-on competitor scoring (landscape doc, "How to compare") still to do: load each `.trex` and score it.


## 2026-10-31 (late): v1.0 wrap-up and project structure
- v1.0.0 tagged: landing page, axis title + inferred number formats, outliers cut by default with a "show all" badge,
  strip compression, sandbox-safe classic-script build (found: module scripts and `crossorigin` are refused under
  tabextsandbox's null origin; fixed with plugin-legacy, as Tableau's own Sankey does).
- Declutter: hello viz and spike removed; Lite dialog archived; MIT licence; credits page; plan split into PLAN + history.
- Top level reduced to the manifest, key docs and required config; pages moved to an app folder (Vite root + `/src`
  alias). tabextsandbox resolves config paths relative to the config file.
- Final structure: `kit/` (generic toolkit) + `vizzes/raincloud/`, one root package, `@kit/*` alias.
- Decisions: landing hero option B with independent axes; density tails trimmed (option a); example measure renamed.


## 2026-10-31 – 11-02: publishing, then the v1.1 round
- Published: public repo OkhammahkO/tableau-viz-extensions, GitHub Pages site (landing page, hosted extension, live
  demo = the harness built on its own), Release v1.0.0, community portal PR tableau/extensions-api#673.
  Hosted build checked in Tableau Desktop 2026.3.0. Load path users see: Show Me → Viz Extensions → Access Local Viz
  Extensions. CI: the 30k-record render test needed a 30 s timeout on GitHub's runners.
- v1.1 feedback (user used the charts): axis labelling, sparse ticks, "% height", dense small multiples, padding, ECDF,
  and "one chart's rain squashes the row". Root cause of the last: dot size and cloud height were shared across all
  cells, so one spike (e.g. many zeros) shrank everything. Reproduced with the new `spikes_grid.csv`.
- Best-practice check (user asked to be challenged): independent dot sizes break "one dot = one record" across small
  multiples, so the default became one dot size with per-chart compression; independent cloud heights stay the default
  (shape first, user) but are labelled (peak label); the ECDF overlay is a second scale, so it's drawn Pareto-style.
- Peak label first multiplied the density by the gridline interval, which gave "139% per 50" for a spike narrower
  than the interval; now it counts records within that interval around the peak.
- Fixes found while reviewing: blank strip under short rain (band now shrinks to the tallest stack), then boxes not
  aligned across columns (band sized per grid row instead of per cell); hollow circle hid the median (no fill now).
- New candidate logged: correlation / scatterplot matrix (CANDIDATES #6). Vertical orientation moved into v1.1 scope.
- Decided by mock-up (rendered by the engine, viewed via the dev server): box position follows density (own lane /
  on the baseline / inside the cloud); mean marker = hollow orange circle (reverses v1.0's "no coloured markers":
  mean and median must stay distinct when they coincide; the first hollow circle was filled and hid the median, and was
  smaller than the box, so it vanished inside it); colour style stays all-in-mark-colour (grey + accent variants
  dropped, option removed).
- ECDF tweaks from Tableau use: 100% at the top of the cloud area with the n count moved just under the line; the line
  follows the cloud (per colour only when split). Parked: cramped summary labels (short labels / reference lines).
- Tableau round for v1.1 started (TESTING.md T11–T17). Node wasn't on the user's PowerShell PATH.
- Evening (user away): renderer refactor (render.ts 724 → 450 lines; cloud.ts, ecdf.ts, summary.ts, frame.ts; no
  behaviour change), ECDF unit tests, stale comments fixed, unused 'line' mean style removed. Release prep: showcase
  images regenerated, README/site feature lists for v1.1. Research: correlation / scatterplot matrix (gap confirmed,
  ggpairs-style design, ink-efficient mock-up with Pearson vs Spearman) and a quick SPC / control-chart check.
