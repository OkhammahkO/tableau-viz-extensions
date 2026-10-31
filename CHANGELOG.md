# Changelog

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
