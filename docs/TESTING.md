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
- **H7 Markers:** P5/P95 + mean + median labels, whole numbers by default; Decimals 2; mean is a hollow diamond.
- **H8 Size modes:** Entire view (24 rows scroll at 64 px), Fit width with row height, Fit height, Standard (scrolls
  sideways); box keeps its lane at 64 px and 150 px rows.
- **H9 Interaction:** hover dots (value tooltip), click / Ctrl+click select, click empty space clears; hover the box
  (stats tooltip), also when scrolled.

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

## S. Tableau, sandbox build (`npm run sandbox`; `vizzes/raincloud/manifests/raincloud-sandbox.trex`)
- **S1** Landing page and chart load (classic-script build under the sandbox).
- **S2** Format Extension opens and changes apply live.
- **S3** Colours, badge and hover/selection behave as in T.
