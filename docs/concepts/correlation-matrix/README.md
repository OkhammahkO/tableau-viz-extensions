# Candidate 6: correlation / scatterplot matrix

Research and design note (2026-11-02). Idea from the user: "a combined correlation matrix / scatter plot with the
histograms down the diagonal and the number showing in the middle … looks slick but is efficient with ink."
Mock-up: [mockup.html](mockup.html) (regenerate with `python -I docs/concepts/correlation-matrix/make_mockup.py`).
Interactive gallery (2026-11-02): https://claude.ai/artifact/Da99dmxV6RW7zRALwaY6db: playground of the chosen layout
(toggles for each layer, Pearson/Spearman, colour by group, linked highlight) and nine variants from R, Python and Tableau.

## 1. Native check (done first, as always)
- **No native chart type.** Tableau has no scatterplot matrix (SPLOM) or correlation matrix. The known workarounds:
  - pivot the measures (Measure Names / Values), self-join the table, put each copy's Measure Names on Rows and
    Columns, and compute `WINDOW_CORR` / `CORR()` (with LODs) per cell
    ([The Data School](https://www.thedataschool.co.uk/a/brian-scally/how-to-make-a-correlation-matrix-in-tableau/),
    [The Bricks](https://www.thebricks.com/resources/guide-how-to-create-correlation-matrix-in-tableau),
    [Graphed](https://graphed.com/blog/how-to-create-a-correlation-matrix-in-tableau));
  - that gives *either* a coefficient heatmap *or* a grid of scatters: a sheet can't mix scatters, histograms and
    numbers in different cells, and the data reshaping is fiddly and slow on large tables.
- **Exchange:** no SPLOM or correlation-matrix extension found. Closest: Infotopics' *Marginal Histogram*
  ([1071](https://exchange.tableau.com/products/1071)), a single scatter with marginal histograms (free in Desktop and
  web authoring; viewers of published dashboards need the paid version).
- **Verdict: gap confirmed.** The mixed-cell matrix is exactly what native Tableau can't do in one view.

## 2. Reference designs
| Design | Cells | Notes |
|---|---|---|
| **GGally `ggpairs`** (R) | lower: scatter · diagonal: density · upper: correlation | The canonical "pairs" layout; options include smooth/LOESS lines, density contours, bars on the diagonal ([docs](https://ggobi.github.io/ggally/articles/ggpairs.html)). This is the user's idea. |
| seaborn `pairplot` (Python) | scatter everywhere, histogram/KDE diagonal | No coefficients; mirrors scatters in both triangles (redundant ink). |
| Correlogram (`corrplot`) | coefficient only (colour, circles or numbers) | Scales to 20+ variables; no view of the actual relationship (outliers, curves). |
| Tableau workaround | heatmap of r, or scatter grid | Not mixed. |

## 3. Recommended design (see the mock-up)
**Lower triangle: scatter · diagonal: histogram + the variable's name · upper triangle: the coefficient.**

Ink-efficiency choices (Tufte: every mark carries data; nothing repeated):
- **The diagonal labels the matrix.** Each measure's name sits on its histogram, which labels both its row and its
  column, so there are no row or column headers.
- **No redundancy:** each pair is drawn once (scatter below), its number once (above). Seaborn's mirrored scatters
  double the ink for no information.
- **No cell borders or gridlines.** Whitespace separates cells; tick labels only on the bottom row and left column.
- **Small translucent points** (overplotting reads as density); a **thin least-squares line** (≈45% ink) shows
  direction at a glance. Optional: LOESS for curves, none.
- **Coefficient as the only "bold" element:** the number's size and a faint cell tint both scale with |r|, so strong
  pairs pop and weak ones recede. Diverging colour (blue positive, orange-red negative, grey near zero) with
  lightness differences, so it survives colour-blindness; the number itself carries the value (colour is never the
  only cue). Format `.70` / `−.28` (no leading zero, true minus sign).
- **Linked highlight:** hovering or selecting a point highlights the same record in every scatter (the orange dot in
  the mock-up). This "brushing" is the SPLOM's superpower, and maps directly onto Tableau's tuple selection.

**Coefficient:** Pearson r by default, **Spearman ρ** as an option (robust to outliers, catches monotonic curves). The
mock-up shows both side by side: the outlier lowers Pearson for Income–Spend (.70 vs .75). Hover on a coefficient:
r, n, and (later) a p-value or confidence interval.

## 4. Fit as a Tableau viz extension
- **Encodings (≤ 4 custom):** *Measures* (a tile taking several continuous measures, e.g. `max-count="6"`), *Colour*
  (optional dimension: points coloured by group, diagonal histograms per group), Detail holds the row ID (one mark
  per record, as for the raincloud). Possibly *Panels* later (one matrix per member).
  **To verify first in Tableau:** that a single viz-extension encoding accepts several *measures* (the raincloud's
  Columns tile takes two dimensions; measures may behave differently).
- **Data:** summary data at record level (row ID on Detail), all measures as columns: no pivot or self-join needed.
- **Size:** 2–6 measures (6 → 15 pairs) stays legible in a dashboard tile; more becomes a correlogram (offer
  "Upper: number / circle / blank" and "Lower: scatter / blank" so very wide sets can drop the scatters).
- **Performance:** a 6×6 matrix with 10k records is 150k points: SVG gets slow. Plan: draw points on a `<canvas>`
  per cell (SVG for axes and labels), and switch dense scatters to hexbin / alpha density above a threshold.
  Selection then needs our own hit-testing (a quadtree), not per-element events.
- **Reuse from `kit/`:** Tableau API (summary data, tuple ids, hover/select), settings store, dialog session,
  colours (Tableau palettes, stable colours), number formats, tooltip, theme. New: a square n×n layout (simpler than
  the raincloud grid), canvas point layer, correlation stats (Pearson, Spearman with ties, later p-values).
- **Options (first cut):** coefficient Pearson / Spearman; trend line none / linear / LOESS; diagonal histogram /
  density; upper number / circle / blank; point size and opacity; shared Format dialog patterns.

## 5. Effort and risk
- Effort: moderate. Layout and stats are simple; the canvas layer + hit-testing and multi-measure encoding are the
  new parts. Roughly a raincloud v1.0 minus the grid complexity.
- Risks: (1) multi-measure encoding behaviour in Tableau (verify with a hello-viz spike first); (2) performance at
  10k+ records (canvas); (3) legibility past 6 measures (fall back to a correlogram).

## 6. Decisions (user, 2026-11-02)
| Question | Decision |
|---|---|
| Coefficient | **Pearson r** by default, **Spearman ρ** as an option; hover shows the other for comparison |
| Scatter extras | **Thin linear (least-squares) line**; LOESS and none as options |
| Upper triangle | **The number, sized and tinted by strength** (as in the mock-up) |
| How many measures | **Up to 6–8** (so up to 28 scatters: compact ticks and a large-data plan matter) |
| Colour field | **Colours the points** (Tableau palette, stable colours as in the raincloud) |
| Large data | **Every point drawn** (canvas), faded by density; hexbin only above a high threshold |
| Diagonal | **Histogram** |
| Layout | **Confirmed from the gallery** (user, 2026-11-02): the "leaning towards" design (scatter + thin line below, histogram with the name on the diagonal, sized and tinted number above) |
| Big data | **Needed as an option** (user): Points = Automatic / Always points / Density cells. Automatic switches a scatter to density cells above a threshold (proposal ≈5,000 records, tuned after performance tests); hovering a cell shows its count, **clicking a cell selects its records in Tableau**, so interaction survives at 100k rows |
| Process | **Spike first** (multi-measure tile in Tableau), then mock-ups for everything visual, as for the raincloud. The user will share layout ideas and example links. |

## 7. Spike: several measures on one tile
`vizzes/correlation/` (first files of the new viz): `npm run dev:correlation` (port 5174) and
`vizzes/correlation/manifests/correlation-dev.trex` ("Correlation (spike)"). Tiles: **Measures** (continuous-measure,
max 8) and **Colour**. The page lists the encodings Tableau sends, the summary-data columns and first rows, and
Pearson r for the first two measures.

**Result (Tableau Desktop 2026.3.0, 2026-11-02): works.** With `corr_health_8.csv`, three measures on the tile arrive as
three encodings (`measures`, role measure) and three summary-data columns, in tile order: `SUM(Age)`,
`SUM(Blood Pressure)`, `SUM(Bmi)` (floats). With Row Id on Detail: 1,000 rows, one per record; Pearson r(Age, Blood
Pressure) = 0.619, matching the generator (≈ .62). Notes for the build: strip `SUM(…)` for labels (kit `axisTitle`);
Tableau title-cases CSV headers (`blood_pressure` → "Blood Pressure"); order follows the tile.

## 8. Build status
- **2026-11-02: chart engine + dev harness.** `vizzes/correlation/src/chart/`: stats (Pearson, Spearman with tied
  ranks, pairwise-complete n, least squares, bins), model, options, renderer (SVG cells + canvas points + SVG overlay;
  spatial index for hover; density cells with click-to-select bins; linked highlight; legend), tests on the synthetic
  CSVs (Anscombe, edge cases). Harness: `npm run dev:correlation` → http://localhost:5174/dev.html.
- Next: review in the harness; then the Tableau adapter (hover/select tuples, settings, Format dialog, landing page).
- Since: cross-highlighting (paired cells, names, row/column from a histogram; the hovered record ticked on every
  histogram), brushing (drag a rectangle, histogram bars select ranges, legend hover, selection drawn on histograms),
  box under each histogram (combined / per colour), formula + R² + r per colour in tooltips, split histograms by colour
  (each 100% / stacked / off), draw order shuffled, colour-case data (`corr_groups.csv`).
- Gallery v2 adds live demos to choose from: clustered ordering, confidence intervals (fade uncertain), focus view,
  outlier cut and log scale.
- **Chosen from the demos (user, 2026-11-02): focus view** (built: click a coefficient or double-click a scatter; ×/Esc
  closes; hover/select inside; survives redraws). Queued, not dropped: clustered ordering, confidence intervals, outlier
  cut and log scale.

## 9. Raincloud features that carry over (review 2026-11-02)
| Raincloud | Correlation matrix |
|---|---|
| Number formats inferred from Tableau, clean titles | **Yes, essential**: ticks and tooltips in each field's format (only `SUM()` stripping so far) |
| Outlier cut (whiskers + 5%) with the viewer's "show all" badge | **Yes**: one outlier squashes a whole row and column (gallery demo) |
| Density presets (Comfortable / Compact / Dense) | **Partly**: smaller fonts, tighter gaps, hidden ticks at 8 measures |
| Stable colours; split cloud (each 100% / share) | Done (shared kit; split histograms) |
| Tick options, axis titles | Light: ticks only on the outer edges; "hide ticks" for Dense |
| Format dialog, Done/close, settings store and merge, landing page | **Yes**: same kit pieces when the Tableau side is built |
| ECDF line | Queued as the CDF on the histogram |
| Peak label, box position, mean marker | No equivalent |
| Shared backlog: dark theme, highlights from other sheets (F11), export to PDF/image (F12) | Yes for both. **New risk: points are on a canvas; check Tableau's export captures it** |

## 10. Tableau adapter (first cut, 2026-11-02) and next steps
- `vizzes/correlation/src/extension/main.ts` + `app/correlation.html` (the spike page moved to `app/spike.html`):
  reads Measures + Colour at record level, renders, hover → `hoverTupleAsync`, selection (click, Ctrl+click, brush,
  bars, density cells) → `selectTuplesAsync`. No settings, Format dialog or landing page yet (defaults only).
  Manifest `vizzes/correlation/manifests/correlation-dev.trex` ("Correlation (dev)"), `npm run dev:correlation`.
- Next session, in order: user's Tableau test of this cut; **outlier axis cut** as in the raincloud (whiskers + 5%,
  dashed cut edges, "‹ n" counts on the histograms, amber badge with viewer "show all"; statistics use all values;
  user liked it, 2026-11-02); number formats from Tableau; settings store + Format dialog; landing page; canvas
  export check (Tableau PDF/image).

## 11. Export (research 2026-11-02)
The canvas points were the open risk for PDF/image export. API 1.17 (Tableau 2026.2+) added export support:
`environment.isExporting`, `environment.exportedMediaType` (`image` | `pdf`) and
`extensions.reportExtensionRenderComplete(mediaBlob?: ArrayBuffer)` ("can be called by an extension to indicate that
it is ready for exporting"; release notes: "exporting extensions on Tableau Cloud and Server"). Plan: when exporting,
render, then compose the base SVG, the points canvas and the overlay SVG into one PNG (an offscreen canvas) and pass
it as the media blob. Feature-detect; verify on Cloud/Server and Desktop 2026.3. Same mechanism for the raincloud.
Sources: release notes https://tableau.github.io/extensions-api/docs/trex_release-notes/ and the installed types
(`@tableau/extensions-api-types` 1.17.0: `Extensions.d.ts`, `Environment.d.ts`).

## 12. Built while the user was away (2026-11-02, night)
- **Outlier axis cut** as in the raincloud (on by default, whiskers + 5%, adjustable): dashed cut edges, "‹ n / n ›"
  counts on the histograms, density cells and hover ignore what's beyond, focus view uses the same windows, amber
  badge with the viewer's "show all". Statistics use every value.
- **Number formats** per measure inferred from Tableau's formatted values (ticks, bar ranges, focus view).
- **Settings + Format dialog** (Coefficients · Scatters · Histograms · Outliers · Colour), stable colours remembered.
- **Export path**: kit `ui/snapshot.ts` composes SVG + canvas into a PNG; the adapter passes it to
  `reportExtensionRenderComplete` when `isExporting` (feature-detected). **Not verified in Tableau.**
- **Draft landing page** (for review): steps + live mini matrix; harness toggle.
- To review in Tableau: TESTING.md C1–C11.

## 13. Decisions 2026-11-03
- Coefficients **red (negative) / blue (positive)** with **grey marks**; neutral automatically with a Colour field
  (one meaning per colour). Red/blue kept over blue/green: correlation convention (corrplot, seaborn), opposite ends
  look opposite, robust for colour-blind readers; orange/blue (Tableau's diverging default) considered and not chosen.
- Tooltips and the focus view explain results in words (chart/interpret.ts).
- Focus view: bigger marginal histograms (≈16% of the panel, 70–110 px) with box plots, confidence band, group lines.

## 14. Since (2026-11-03)
- Hover preview = the focus view, smaller (only the reading in words left out); direct labels on the focus lines
  (formula + R² on the trend line, r on each group line).
- Raincloud markers on the boxes (orange mean circle, P5/P95 ticks; labelled in the focus view, on hover in the
  matrix) with a Markers section (mean, percentiles, values, decimal places).
- Diagonal: Histogram / **Density** (kit KDE), split by colour like the histograms. Shared statistics moved to
  `kit/stats.ts`.
- **Release kit:** `correlation.trex` (public, GitHub Pages URL, v0.9.0), `manifests/correlation-preview.trex`
  (:4180), `npm run site` builds `dist/site/correlation/` (extension, Format dialog, demo = the harness, `.trex`),
  `npm run build` builds both vizzes. Not linked from the website yet (landing page and site section to decide).
- **Landing page v2** (draft for review), laid out like the raincloud's: four Tableau-style steps (pills) beside a live
  hero matrix, then "Make it yours" thumbnails drawn by the real engine. Sample data = seeded **health** people (user:
  familiar science, no Superstore): height–weight (strong +), age–max heart rate (strong −, "208 − 0.7 × age"),
  exercise–cholesterol (Simpson's paradox by age group). Thumbnails: Look closer (focus), Colour can flip a trend,
  **Correlation isn't cause** (ice cream vs drownings by season: r ≈ .8 overall, ≈ .2 within a season, the confounder
  is temperature), Smooth or bars, Big data, Tiles; a reminder line under them. Tests check each claim's r.
- Focus view header: title and summary numbers no longer overlap.
- Queued: size modes (fixed cell size that scrolls), density presets (Comfortable / Compact / Dense at 6–8 measures).

## 15. Tableau round and code review (2026-11-03)
- Tableau round C1–C12 passed. Fixed from it: vertical box labels piled at the bottom (focus view); two tooltips on a
  focus point (only Tableau's now, as in the matrix); landing page layout (3 × 2 thumbnails, none clipped, short names
  in small matrices, hero box hugs the matrix); tick labels colliding between cells; square plots centred in wide
  frames; AVG pills.
- **⤢ expand button** on the hovered scatter opens its focus view (user: a scatter is the obvious thing to click);
  click and drag still select, as in Tableau.
- Code review fixes: hover highlight drawn outside cells for values beyond a cut axis; one Esc listener (one per
  chart leaked on landing-page resizes); density-cell ids off the DOM (megabytes at 100k records); export reports
  render complete on the landing page too; landing page redraws once per frame while resizing.
- Selection after a filter: C13 failed (highlighted points became other records); fixed by remembering selected
  records by content and remapping after each read (`kit/tableau/selection.ts`). Export (C12, C14) left unverified
  for 0.9 (user). Open, both vizzes: the Format
  dialog's copy of the options can overwrite colours assigned while it is open (self-heals on the next draw).
- Release: **0.9.0 "preview"**; the website becomes a portfolio (home page + a page per viz). See PLAN.md.
