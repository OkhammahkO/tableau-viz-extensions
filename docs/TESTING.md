# Manual test round

Run before each release. Automated first: `npm test` and `npm run build` must pass. Then start `npm run dev` (and
`npm run sandbox` for section S). Report results by number, e.g. "T5 fails: …".

## H. Harness (http://localhost:5173/dev.html)
- **H1 Landing page:** tick *Landing page*. Steps 1–4 with pills, feature chips, three shape panels (Normal / Bimodal /
  Right-skewed, coloured Courier/Collect, summary labels), four thumbnails with titles above. Drag the frame corner:
  small = steps only, medium = + panels, large = + thumbnails.
- **H2 Datasets:** untick *Landing page*; step through every dataset. No errors, no `NaN`; `small_n` shows "too few
  values for a curve"; `edge_cases` shows missing counts and "no values".
- **H3 Rows/Columns:** Rows region › category (spanning headers); Columns region (panels, ticks under each); Panels
  per row 2 (wraps); Panel axes Independent vs Shared.
- **H4 Colour:** Colour segment (coloured dots, legend, grey cloud, dots grouped by colour per stack); *split cloud*
  (one curve per member); with Cloud = Histogram (stacked bars); `many_categories` + Colour store (Tableau 20 + "Other").
- **H5 Cloud/rain:** Density / Histogram / None; Dot plot / Strip / None (Strip and None compress rows); smoothing.
- **H6 Outliers:** `outliers_response_ms`: amber badge bottom right; click → all values, click again → cut; per-cell
  ‹ n / n › counts; `likert_satisfaction`: no badge.
- **H7 Markers:** P5/P95 + mean + median labels, whole numbers by default; Decimals 2; mean is a hollow orange circle with the median visible through it.
- **H8 Size modes:** Entire view (24 rows scroll at 64 px), Fit width with row height, Fit height, Standard (scrolls
  sideways); box keeps its lane at 64 px and 150 px rows.
- **H9 Interaction:** hover dots (value tooltip), click / Ctrl+click select, click empty space clears; hover the box
  (stats tooltip), also when scrolled.

- **H10 Labels and ticks (v1.1):** Rows empty → no row header, axis title = field name; Axis title Hidden / Custom;
  Ticks Fewer / Auto / More; interval 10; gridlines off → short tick marks; long tick labels never overlap.
- **H11 Scales (v1.1):** `spikes_grid` (Rows store, Columns channel): Store 03 / Online's pile at 0 doesn't shrink other
  charts; Cloud height Fit each / Shared; dots keep one size (crowded stacks overlap); peak labels ≤ 100%; boxes level
  across columns.
- **H12 Density (v1.1):** `large_grid` (40 × 3): Comfortable / Compact / Dense; tick labels once per block; thin rows
  drop labels and n; box position follows density.
- **H13 Split and ECDF (v1.1):** Colour segment + split cloud: each colour 100% vs share (histogram outlines vs
  stacks); ECDF on: one line per colour, 100% / 50% labels, hover readout.

## T. Tableau, dev build (`vizzes/raincloud/manifests/raincloud-dev.trex`; remove older Raincloud sheets first)
- **T1 Load:** Show Me → Viz Extensions → Access Local Viz Extensions → `raincloud-dev.trex`. Landing page shows.
- **T2 Fields:** Value + Row Id on Detail: chart appears. Without Row Id: yellow "aggregating" banner.
- **T3 Rows/Columns/Colour:** nested rows with spanning headers; Columns panels; Colour legend and grey cloud.
  Native sort on a dimension reorders rows.
- **T4 Interaction:** hover a dot → Tableau tooltip for that record (includes Tooltip-shelf fields); click / Ctrl+click
  select; empty click clears.
- **T5 Format Extension** (below the tiles): every section changes the chart live; Reset restores defaults.
- **T6 Number format & title:** a currency or % measure → ticks and labels use `$` / `%`; axis title without SUM().
- **T7 Stable colours:** Region on Colour, filter one region out, then back in: no other colour changes.
- **T8 Outliers:** a measure with outliers → badge; "show all" works; Format → Axis switch off removes the cut.
- **T9 Persistence:** save, close and reopen the workbook: settings and colours kept.
- **T10 Robustness:** remove/re-add fields quickly, filter to nothing ("No values to show"), resize the sheet: never a
  blank frame; any error shows as a red message (check DevTools at http://localhost:8696 for `[raincloud]` lines).
- **T11 Labels (v1.1):** nothing on Rows → no `SUM(…)` row header; Axis → Axis title Hidden, then Custom text.
- **T12 Ticks (v1.1):** Tick marks Automatic / Fewer / More, then Fixed interval 10; Gridlines off → short tick marks;
  tick labels never overlap.
- **T13 Scales (v1.1):** `spikes_grid.csv` (Rows store, Columns channel, row_id on Detail): Store 03 / Online's pile at 0
  doesn't shrink other charts; boxes level across columns; peak labels ≤ 100%; Cloud → Height
  switches to shared heights.
- **T14 Density (v1.1):** `large_grid.csv` (Rows store, Columns region): Layout → Density Compact / Dense show more rows,
  tick labels once per block, box on the baseline (Compact) / inside the cloud (Dense).
- **T15 Split cloud (v1.1):** Colour segment + Split cloud: Each colour = 100% vs Share of the slice, density and histogram.
- **T16 ECDF (v1.1):** Cumulative on: one line (one per colour when split); 100% at the top, n just under it with the
  100% label beside it; 50% guide; hover readout "x% of records ≤ v".
- **T17 Mean (v1.1):** orange hollow circle, median visible through it; Summary → Shape and Colour change it.

## C. Correlation matrix (in development; `npm run dev:correlation`)
Harness http://localhost:5174/dev.html, then Tableau with `vizzes/correlation/manifests/correlation-dev.trex`
("Correlation (dev)"): measures on **Measures**, `row_id` on **Detail**, optionally a dimension on **Colour**.
- **C1 Layout:** `corr_health_8.csv` with 8 measures: names on the diagonal (no `SUM()`), boxes under histograms,
  sized/tinted coefficients, trend lines; resize the frame.
- **C2 Numbers:** hover a coefficient: r, ρ, n, formula with R², r per colour; `corr_edge_cases.csv`: the constant
  shows "—" with an explanation; `corr_anscombe.csv`: four .82s, four shapes.
- **C3 Colour:** `corr_groups.csv` tier / store / segment: split histograms (each 100% / stacked / off), per-colour
  boxes, Other past 20, Null member; Premium visible despite 5%.
- **C4 Highlight and brush:** hover a scatter (pair + names), a histogram (row and column in orange), a point (record in
  every scatter + ticks on histograms); drag a rectangle; click a histogram bar; hover a legend member.
- **C5 Focus:** click a number, or the ⤢ that appears on a hovered scatter (or double-click it); clicking a point
  still selects it; in the focus view, drag a rectangle (selects what's inside), hover a marginal bar (its
  records light up, tooltip with range and count) and click it (selects them; Ctrl adds); the selection shows on the
  marginal histograms; pause over a scatter for the top-right preview, click it;
  Esc closes; stays open after selecting.
- **C6 Big data:** `large_corr_100k.csv`: density cells, hover count, click selects the bin; "Always points" for speed.
- **C8 Outliers:** `corr_customers.csv` income + spend: dashed cut edges, "1 ›" on a histogram, amber badge; "show all"
  and back; Format → Outliers off / margin.
- **C9 Format dialog:** Format Extension opens it; every section changes the chart live; Reset; Done closes; settings
  and colours survive save/close/reopen.
- **C10 Formats:** a currency or % measure: ticks and bar ranges in its format.
- **C11 Landing page (draft v2):** with fewer than two measures: four steps beside a live matrix (age, max heart rate,
  height, weight); when roomy, six thumbnails (incl. "Correlation isn't cause") and the reminder line; resize to
  medium (no thumbnails) and small (steps only). Focus thumbnails: title and numbers don't overlap.
- **C12 Export (Tableau 2026.2+, ideally Cloud/Server):** export the sheet or dashboard as image/PDF: the points appear
  (DevTools: "[correlation] export: render complete reported").
- **C13 Selection after a filter (both vizzes; failed 2026-11-03, fixed in both by remapping; raincloud 1.1.1):** select a few points, then filter the sheet (or a quick filter) so
  rows drop out. The highlighted points must be the same records as before (or the selection cleared), never others.
- **C14 Export on the landing page:** with fewer than two measures, export the sheet: no hang (render complete is
  reported for the landing page too).
- **C7 Tableau:** native tooltips on hover; selections (click, Ctrl, brush, bar, bin) select in Tableau and drive
  actions; no errors in DevTools (http://localhost:8696, `[correlation]` lines).

## P. Tableau, built site (what GitHub Pages will serve; do before every push)
`npm run site:preview` (builds `dist/site/` and serves it on http://localhost:4180), then load
`vizzes/raincloud/manifests/raincloud-preview.trex` ("Raincloud (preview)") or
`vizzes/correlation/manifests/correlation-preview.trex` ("Correlation (preview)"). Repeat T1–T5, T9 and T11–T17 quickly.
Differences from dev to watch for: the built bundle uses classic scripts and bundles everything, so a failure here
but not in dev points at the build (check DevTools at http://localhost:8696). Also open http://localhost:4180/ to
check the site, images and demo.

## S. Tableau, sandbox build (`npm run sandbox`; `vizzes/raincloud/manifests/raincloud-sandbox.trex`)
- **S1** Landing page and chart load (classic-script build under the sandbox).
- **S2** Format Extension opens and changes apply live.
- **S3** Colours, badge and hover/selection behave as in T.
