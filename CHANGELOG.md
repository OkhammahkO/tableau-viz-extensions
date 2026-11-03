# Changelog

Each viz has its own versions (git tags `<viz>-vX.Y.Z` from the correlation matrix on; the raincloud's earlier tags are
`v1.0.0` and `v1.1.0`).

# Correlation matrix

## 0.9.0 preview (2026-11-03)
First public version of the correlation / scatterplot matrix.
- Matrix: scatters below the diagonal (canvas points, seeded draw order; density cells above 5,000 records), each
  measure's histogram or density curve with a box plot and markers on the diagonal, coefficients above it (sized
  number, shaded tile or plain; red/blue with grey marks, neutral with a Colour field). Two to eight measures.
- Pearson r or Spearman ρ (ties ranked), pairwise-complete n, least-squares trend lines, formula and R².
- Plain-language readings with caveats (curved or outlier-driven, Simpson's paradox, groups disagreeing, few records).
- Focus view for one pair (click a number, the ⤢ on a scatter, or double-click): marginal histograms and boxes with
  labelled markers, 95% confidence band, a line per colour group with direct labels, the reading in words; hover
  preview after a pause.
- Brushing and cross-highlighting; native Tableau tooltips, selection and actions.
- Outlier axis cut (whiskers + 5%) with counts beyond each histogram's edge and a "show all" badge.
- Colour tile: split histograms (each colour 100% or share), a box per colour, stable colours, legend hover.
- Format dialog (Tableau UI): coefficients, scatters, histograms, markers, outliers, colour. Number formats from Tableau.
- Marker values (median, mean, percentiles): decimals suited to each measure's spread by default (age → 0,
  hours → 1, rates → 2), or the field's own format, or 0–4.
- Landing page with familiar health examples, Simpson's paradox and "correlation isn't cause" (ice cream vs drownings).
- Export: reports its own image when Tableau exports (API 1.17, Tableau 2026.2+; not yet verified).

# Raincloud

## 1.1.1 (2026-11-03)
- Fix: a selection now survives a filter. The extension remembered selected records by row position, so after a
  filter dropped rows it highlighted different records from the ones Tableau kept selected.

## 1.1.0 (2026-11-02)
From using the charts (user feedback 2026-11-02); a best-practice check shaped the defaults.
- Labels: no row header when Rows is empty (it showed the raw `SUM(Value)`); axis title Automatic / Hidden / Custom.
- Ticks: denser by default; Automatic / Fewer / More / Fixed interval; gridlines on/off; overlapping labels skipped.
- Scales: cloud height **Fit each chart** (default) / Shared, labelled with a peak label ("88% per 50", counted);
  dots keep **one size, and crowded stacks overlap**, so one spiky cell no longer squashes the others. Overlapping stacks get more transparency and dots a surface ring.
- Split cloud: **Each colour = 100%** (default; histogram outlines) or share of the slice (stacked).
- Density: Comfortable / Compact / Dense (row minimum, padding, gaps, tick labels once per block); thin rows drop
  marker labels that don't fit and the n count. Box position follows density (own lane / on the baseline / inside).
- Cumulative line (ECDF), Pareto-style: 100% at the top of the cloud area, its own 100% / 50% labels and a hover
  readout; follows the cloud (one line per colour when the cloud is split).
- Mean marker: hollow orange circle by default (the median shows through and stays distinct); shape and colour options.
- Rain band shrinks to the tallest stack per grid row (no blank strip; boxes stay aligned across columns).
- New test data: `spikes_grid.csv`, `large_grid.csv`.

## 1.0.0 (2026-10-31)
First complete version of the Raincloud viz extension.
- Raincloud chart: density/histogram cloud, Tukey box (own lane), stacked dot plot or strip rain.
- Rows × Columns grid with nested headers, wrapping, shared/independent axes; size modes (Entire view, Fit width,
  Fit height, Standard); strip/none rain compresses rows.
- Colour tile with Tableau palettes, stable colours remembered in settings, optional split cloud.
- Outliers cut at whiskers + 5% by default; amber badge to show all values (viewer only).
- Markers: median, mean, P5/P95 with values; decimal places (default 0); field number format and axis title.
- Format dialog (Tableau UI, React 18) with live preview; frozen Lite fallback (`raincloud-lite.trex`).
- Landing page with live examples and feature hints.
- Classic-script build that loads under Tableau's sandbox hosting (verified with `@tableau/tabextsandbox`).
- Hosted on GitHub Pages: website with quick start, live demo, and the downloadable `raincloud.trex`.
