# Candidate 6: correlation / scatterplot matrix

Research and design note (2026-11-02). Idea from the user: "a combined correlation matrix / scatter plot with the
histograms down the diagonal and the number showing in the middle … looks slick but is efficient with ink."
Mock-up: [mockup.html](mockup.html) (regenerate with `python -I docs/concepts/correlation-matrix/make_mockup.py`).

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

## 6. Questions for the user (next session)
1. Default coefficient: Pearson (familiar) or Spearman (robust)? Show both on hover?
2. Trend line by default: linear, LOESS, or none?
3. Should the upper triangle optionally show circles (corrplot style) instead of numbers?
4. How many measures do you typically compare (sets the default cell size and the correlogram fallback)?
5. First step: a small spike to confirm a multi-measure encoding works in Tableau?
