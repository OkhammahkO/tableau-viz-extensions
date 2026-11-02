# Changelog

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
