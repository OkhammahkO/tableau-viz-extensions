# Plan

_Current status and next steps. The full session-by-session record (findings, decisions, reasoning) is in
[history.md](history.md)._

## Status (2026-11-03)
- **Raincloud v1.1.0** released 2026-11-02 (v1.0.0 2026-10-31). Features: [CHANGELOG.md](../CHANGELOG.md); release
  steps and limitations: [RELEASE.md](RELEASE.md).
- **Correlation matrix: ready for its first release, 0.9.0 "preview"** (user, 2026-11-03). Tableau round C1–C12
  passed (user: "looking pretty good"); code review done (fixes in history.md). Status and design:
  `docs/concepts/correlation-matrix/README.md`.

Released: site live at https://okhammahko.github.io/tableau-viz-extensions/ (checked in Tableau 2026-10-31),
GitHub Release v1.0.0 and v1.1.0, community portal PR https://github.com/tableau/extensions-api/pull/673 (CLA green,
awaiting review).

**Every push redeploys every viz** (the site build takes both from `master`), so raincloud changes ride along with any
release: keep raincloud edits for a planned raincloud release, and run its quick checks (TESTING.md P) before a push.

## Next steps (in order)
1. **Correlation 0.9.0 release:**
   - Website as a **portfolio** (user, 2026-11-03): the root becomes a short home page with a card per viz;
     `/raincloud/` gets today's page and `/correlation/` its own page in the same layout. Existing `.trex` URLs stay.
   - README section, `CHANGELOG` entry, release notes marked "preview"; tag `correlation-v0.9.0` (per-viz tags from
     now on; the raincloud's existing tags stay as they are).
   - Built-site check (`npm run site:preview`, TESTING.md P for both vizzes), then the user pushes and publishes the
     GitHub Release with `correlation.trex`.
2. **Scale-out groundwork** (before viz 3; see "Scaling to more vizzes" below).
3. **Raincloud v1.2** (pipeline below), then the brushing review (item 6).
4. **Export for both vizzes** (raincloud F12): API 1.17 (Tableau 2026.2+) lets an extension report "render complete"
   and pass its own image when Tableau exports (`isExporting`, `reportExtensionRenderComplete(mediaBlob)`). The
   correlation matrix has it (also on its landing page), unverified: check on Cloud/Server and Desktop, then port.
5. **Tableau Exchange:** email extensiongallery@tableau.com (contributor access + Tableau UI permission), icon
   (280×280 PNG + 70×70 in the `.trex`), privacy/terms/support pages, tagline, 1–3 screenshots (1200×680). One
   listing per viz.
6. **Raincloud brushing review** (user, 2026-11-03; from the correlation matrix's interactions; mock up first):
   drag across the rain or cloud to select a value range (1-D brush); click a histogram-cloud bar to select its range;
   draw the selection's distribution over every cloud; legend hover brings a colour forward; a value crosshair across
   all rows (the raincloud's equivalent of cross-highlighting, since each record appears once); maybe a focus view of
   one row (with the correlation matrix's ⤢ button). Highlights from other sheets (F11) are shared.
7. Correlation queue: size modes (fixed cell size that scrolls), density presets, clustered ordering, CI in the
   focus view, log scale, CDF on the diagonal. Detailed-testing TODO in RELEASE.md.

## Raincloud v1.2 pipeline (learnt in the correlation round, 2026-11-03)
- Landing page: `AVG(Value)` pill instead of `SUM(Value)` (with one record per mark every aggregation agrees; AVG reads
  right and survives a repeated row ID); redraw once per frame while resizing (correlation fix).
- Export path from the correlation matrix (kit `snapshotPng`), including the landing page.
- Marker decimals "Automatic" by the data's spread (kit `decimalsForSpan`, whole numbers for integer data), as the
  correlation matrix's default; today the raincloud uses the field format.
- Plain-language tooltips (as `interpret.ts`): say what the shape means (skewed, two peaks, outliers) in words.
- Harness URL switches `?landing&w=&h=` for headless screenshots (as the correlation harness).
- Check tick labels can't collide between neighbouring panels (correlation `keepInside`; move it to `kit/grid/ticks`).
- ~~Selection after a filter~~: fixed in both vizzes (`kit/tableau/selection.ts`); ships as raincloud 1.1.1 with the
  correlation release.
- Vertical orientation (on hold since v1.1).

## Scaling to more vizzes
`kit/` already carries what isn't viz-specific (grid, colours, formats, stats, settings store, dialog session,
splash parts, tooltip, snapshot, build preset), and the second viz reused it unchanged. Before viz 3:
1. **Adapter in the kit:** both `main.ts` files repeat ~100 lines of Tableau wiring (init + configure → Format
   dialog, settings and summary-data listeners with the refresh sequence guard, resize, theme from workbook
   formatting, hover throttle, selection toggling, stable colours, export report, error logging). Move it to
   `kit/tableau/viz.ts`; a viz supplies `read(page)` and `draw()`. Re-test both vizzes in Tableau after.
2. **Scaffold:** `npm run new-viz <name>` copies a template viz (manifests with the next free port, harness, splash and
   dialog stubs, vite configs) and registers it in `package.json`, the site build and the site.
3. **Per-viz metadata** (name, tagline, features, screenshots, `.trex`) generating the home-page card and the viz page.
4. **Per-viz versions:** tags `<viz>-vX.Y.Z`, a changelog section per viz, one GitHub Release per viz release.
5. Pick viz 3 from `docs/CANDIDATES.md` by the gap in native Tableau (as for candidate 6).

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
