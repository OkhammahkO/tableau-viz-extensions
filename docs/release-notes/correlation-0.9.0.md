# Correlation matrix 0.9.0 (preview)

A new free viz extension for Tableau: see how your measures relate. Every pair of measures as a scatter, each
measure's distribution on the diagonal, and how strongly they move together, explained in words.

**Get it:** download `correlation.trex` below (or from the [website](https://okhammahko.github.io/tableau-viz-extensions/correlation/)),
then in Tableau 2024.2+ choose **Show Me → Viz Extensions → Access Local Viz Extensions** and pick the file. Drag two
to eight measures to **Measures** (as AVG), a row ID to **Detail**, and optionally a dimension to **Colour**.
[Live demo](https://okhammahko.github.io/tableau-viz-extensions/correlation/demo/).

## What's in it
- Scatters below the diagonal, histograms (or density curves) with box plots on it, coefficients above it: sized
  numbers or shaded tiles, red for negative and blue for positive.
- Pearson r or Spearman ρ. Hover any number for both, n, the trend line's formula and R², and r per colour group.
- Plain-language readings with the caveats that apply: curved or outlier-driven relationships, colour groups that
  disagree (Simpson's paradox), few records. And always: correlation is not causation.
- Look closer at one pair: click a number or the ⤢ on a scatter. Marginal histograms and boxes with labelled markers,
  the trend line with its 95% confidence band, a line per colour group.
- Brushing everywhere: drag a rectangle, click a histogram bar or a density cell; hover a point to find the record in
  every scatter. Native Tableau tooltips, selection and actions.
- Big data: above 5,000 records, scatters become density cells (still selectable).
- Outliers cut from the axes automatically (correlations still use every value), with a badge to show them all.

## Preview
This is a preview: the features are complete for now, but details may change before 1.0. Not yet verified: Tableau's
image/PDF export of the sheet (Tableau 2026.2+). Feedback and bug reports are welcome in the
[issue tracker](https://github.com/OkhammahkO/tableau-viz-extensions/issues).

On Tableau Cloud or Server, an admin first adds `https://okhammahko.github.io` to the site's extension allow list.
Your data stays in Tableau: the extension draws inside the worksheet and sends nothing anywhere.
