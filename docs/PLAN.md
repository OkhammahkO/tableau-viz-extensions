# Plan

_Current status and next steps. The full session-by-session record (findings, decisions, reasoning) is in
[history.md](history.md)._

## Status: Raincloud v1.1.0 (released 2026-11-02; v1.0.0 2026-10-31)

Feature list: [CHANGELOG.md](../CHANGELOG.md). Release steps and known limitations: [RELEASE.md](RELEASE.md).

**Pending Tableau checks** (built and tested in the harness, not yet confirmed in Tableau):
- Sandbox build (`npm run sandbox` + `vizzes/raincloud/manifests/raincloud-sandbox.trex`): chart, Format dialog, settings, colours, badge, landing page.
- Colour tile, polish round (box lane, decimals, stable colours with a filter), outlier badge/default,
  strip compression, landing page, axis title and number format on a currency or % field.

## Since v1.0 (2026-10-31)
- Project split into **`kit/`** (reusable toolkit for any viz, see `kit/README.md`) and **`vizzes/raincloud/`**.
  Single root package; build output `dist/<viz>/`. 115 tests.
- Landing page: hero = three shape panels (Normal / Bimodal / Right-skewed) with their own axes, coloured by method,
  summary labels on; example measure "Delivery time (min)".
- Density tails stay **trimmed** at the data (user decision; independent axes are the fix when shapes look cut short).
  awaiting first commit with the user's GitHub no-reply email.

## Next steps (in order)
1. **Tableau round for v1.1** (started 2026-11-02): TESTING.md T11–T17 with `raincloud-dev.trex` and the dev server,
   on the user's workbooks plus `spikes_grid.csv` / `large_grid.csv`. Fix what it finds.
2. **Remaining v1.1 item:** 7 many dots (may matter less now that dots compress per chart). Vertical orientation is
   on hold (v1.2). Parked: cramped summary labels (backlog 9).
3. **Release v1.1:** see RELEASE.md "v1.1 release".
4. **Tableau Exchange:** email extensiongallery@tableau.com (contributor access + Tableau UI permission), icon
   (280×280 PNG + 70×70 in the `.trex`), privacy/terms/support pages, tagline, 1–3 screenshots (1200×680).
5. Detailed-testing TODO in RELEASE.md.
6. **Next viz: candidate 6, correlation / scatterplot matrix** (researched 2026-11-02, gap confirmed): answer the
   open questions in `docs/concepts/correlation-matrix/README.md`, then a small spike to confirm a multi-measure
   encoding in Tableau.

Released: site live at https://okhammahko.github.io/tableau-viz-extensions/ (checked in Tableau 2026-10-31),
GitHub Release v1.0.0, community portal PR https://github.com/tableau/extensions-api/pull/673 (CLA green, awaiting review).

## v1.1 scope (in build order)
Root cause found for "one chart squashes the others" (user, 2026-11-02): dot size/stack step (`dotLayout` over all
cells) and cloud height (`maxD`) are shared across every cell, so one spike (e.g. many values at 0) shrinks every
other cell. Reproduce with quirks.csv "Mostly zero".
1. **Labels** (built): no row header when Rows is empty (it showed the raw `SUM(Value)`); axis title Automatic /
   Hidden / Custom.
2. **Ticks** (built; user: good): default denser (~70 px per tick; was 90, felt too sparse); Fewer / Auto / More; fixed interval; gridlines on/off.
3. **Split cloud sizing** (built): **Each colour = 100% (default, user 2026-11-02)** / Share of slice. Histogram:
   100% overlays per-colour outlines, share stacks the bars.
   Also fixed: the stacked-dot band shrinks to the tallest stack (blank strip under short rain, user report).
4. **Scales** (built 2026-11-02). Decisions after a best-practice check (user asked to be challenged on departures):
   - **Cloud height: Fit each chart (default) / Shared.** Shape first (user); independent heights aren't comparable, so
     they're labelled: a **peak label** per cloud (built), "12% per 10" (density: % of the chart's records per gridline
     interval at the peak) or "12% per bin" (histogram); Automatic (shown when heights fit each chart) / Always /
     Never. The n count moved to the top-right corner to make room.
   - **Dots: one size, crowded stacks overlap** (no option: "Fit each chart" and "Shared" were trimmed before v1.1,
     user 2026-11-02). One dot = one record in every chart; a cell with a big pile compresses its own stacks.
   - Split cloud stays **Each colour = 100%** by default (shapes over group sizes; the dots still show counts).
5. **Density: Comfortable / Compact / Dense** (built 2026-11-02, in review): minimum row 64 / 40 / 24 px, padding
   8 / 6 / 4, panel gap 14 / 10 / 6; Compact and Dense put tick labels once under each block (with Columns, every
   cell had its own 16 px strip). At any density, thinning by real row height: marker labels get only the rows that
   fit (dropped otherwise), n hidden below 36 px, smaller box / mean / percentile ticks below 48 px.
   Possible follow-up: an "Automatic" density that picks the densest needed to avoid scrolling.
6. **ECDF line over the cloud** (built): Pareto-style after a dual-scale check: thin line, 100% at the top of the
   cloud area (the n count drops just under it, the "100%" label beside n), 50% guide (crosses at the median),
   hover readout; off by default. Follows the cloud: one line per colour only when the cloud is split.
7. **Many dots** (if 4 isn't enough): Rain: Auto (dots → strip above ~300 per cell), strip jitter + transparency,
   hard cap on the rain band.
8. **Vertical orientation: on hold** (user, 2026-11-02; moved out of v1.1). Flip the whole chart (value axis vertical,
   clouds side by side). Plan when resumed: mock-up first (meaning of Rows/Columns, cloud side, labels), then map
   "along / across" positions to x/y by orientation so text stays upright; ~1–2 sessions. Target v1.2.
9. **Colour style** (decided 2026-11-02): keep everything in the mark colour (Tableau-native), with the orange mean
   as the one accent. Grey + accent variants were mocked up (all grey / accent summary / cloud / rain) and dropped.
10. **Box position** (built; user approved the mock-up 2026-11-02; in the dialog): Automatic (default) follows density: Comfortable → own lane, Compact → on the
    cloud's baseline, Dense → inside the cloud (box fill 70% there). Options: lane / baseline / inside.
11. **Mean marker** (built, user chose 2026-11-02): hollow circle, no fill (the median shows through), in Tableau 10
    orange by default. Dialog: Shape (circle / lifted circle / diamond / dot / cross / triangle) and Colour (Orange /
    Same as median / Mark colour).

Mock-ups (all decided; files deleted): rendered by the chart engine from temporary `scripts/showcase/_mockup-*.test.ts`
files with their own vitest config, written to `vizzes/raincloud/app/mockups/` and viewed via the dev server. Both
paths are git-ignored, so the same approach can be reused.

## Key decisions (details in history.md)

| Topic | Decision |
|---|---|
| Format dialog | Tableau UI (React 18.3.1 + `@tableau/tableau-ui`); Lite frozen as fallback |
| Tiles | Value · Rows (≤3) · Columns (≤2) · Colour (1); Detail holds the row ID |
| Defaults | Density cloud, box, stacked dots; P5/P95 + mean with values, 0 decimals; outliers cut at whiskers + 5% with a badge |
| Grid | Spanning row headers, empty combinations shown as "no values", shared axes (option: independent), auto wrap, ticks under every panel |
| Colour | Tableau 10 → 20 → "Other"; dots grouped by colour; grey combined cloud; optional split cloud; stable colours |
| Build | Classic SystemJS scripts (plugin-legacy) without `crossorigin`, required by sandbox hosting |
| Mean marker | Hollow circle in Tableau 10 orange (user, 2026-11-02; reverses v1.0's "no coloured markers": mean and median must stay distinct when they coincide). Labels stay in text ink |
| Not doing | Log scale; custom category sort (native sort works); coloured median |

## Next

**Release (see RELEASE.md):** Tableau checks above · licence for our code · Tableau UI permission
(extensiongallery@tableau.com) · hosting choice · icon and screenshots.

**Post-v1 backlog, in priority order:**
1. Theme: respect worksheet background colour (dark dashboards).
2. F11 Highlights and selections from other sheets.
3. F12 Export rendering (PDF/image).
4. F10 Keyboard navigation.
5. Clickable legend (highlight a colour member).
6. F13 Summary table toggle.
7. Nice to have: F9 very large data (F8 vertical and F15 ECDF moved to v1.1).
8. On hold: F5 parameter reference lines, F6 split violin, F7 repeated-measures lines.
9. Parked (user, 2026-11-02): summary labels for cramped layouts. Options discussed: short labels ("52", "Md 52")
   or median-only, automatic by available room; or median/P5/P95 as thin vertical reference lines through the cell as
   a Dense alternative to the box. Rotated labels advised against (slower to read, need the height thin rows lack).

**Other candidates:** see [CANDIDATES.md](CANDIDATES.md) (Sankey, network flow diagram, live parameter updater, SPC charts, correlation / scatterplot matrix).
