# Candidate custom vizzes

All candidates build on the shared core proven by the hello viz (see [PLAN.md](PLAN.md)).
Each one gets its own `.trex`, encodings, layout and Format options.

| # | Candidate | Status | Notes |
|---|---|---|---|
| 1 | **Sankey** | Researched | Staged/level flows. Benchmarks: Tableau Sankey (native), Infotopics (options). |
| 2 | **Network flow diagram** | Concept | Directed graph with cycles and two-way transfers (rail interchange example in `docs/concepts/flow-diagram/`). Landscape not yet surveyed. |
| 3 | **Highlight table with per-measure formatting** | **Parked (2026-10-30): native Tableau covers it** | The need: a native-style text/highlight table where each measure in Measure Names/Values gets its own colour scale (as in Power BI's per-measure conditional formatting). Native Tableau has done this since **10.2 (2017)**: right-click the Measure Values pill on Colour → **Use Separate Legends**. The user confirmed this covers their need. Revisit only if threshold rules, mixed formatting types per measure, or easier setup become a requirement. References: Tableau Table (below), [idir-aj/tableau-advanced-table-viz-extension](https://github.com/idir-aj/tableau-advanced-table-viz-extension). |

## Reference: Tableau Table (Exchange [1041](https://exchange.tableau.com/products/1041))

Tableau-built, free, v3.0.0 (Dec 2025) plus a Jan 2026 hotfix, Tableau 2024.3+. Hosted at
`https://tableau-extensions.tableauusercontent.com/table/table.html` (not the sandbox host).
[Release notes](https://tableau-extensions.tableauusercontent.com/table/ReleaseNotes.html).

- **How it's used:** dimensions and measures go on **Detail** (no custom encodings needed). It shows record-level rows.
- **Features:** conditional formatting (colour scale, data bars), Viz in Cell, search, column filters
  (wildcard text; numeric and date sliders with a filter indicator), show/hide and reorder columns
  (drag-and-drop on web, plus toolbar), column widths that persist across publish, header font, shading and
  alignment, Google Fonts, null display setting, experimental column totals, copy/paste of a row or
  column, Excel export matching the viz, alias editing from the header (2025.1+), keyboard navigation for
  headers, header controls and tooltips, and workbook formatting for dividers and number/date formats (2025.1+).
- **Build:** React + `@tableau/tableau-ui`, Vite. **Custom grid**: no AG Grid, TanStack, react-window etc.
  Uses ExcelJS for export and ResizeObserver. Three dialogs: Format Extension (behaviour), Formatting
  (conditional formatting / Viz in Cell), Table Settings (appearance). A separate data-highlighter chunk.
  Uses the same API set as Tableau's Sankey (tuples, hover/select, selected/highlighted marks, settings,
  formatting event), so it likely shares the same in-house framework.
- **Release cadence:** v1 Oct 2024 → v2 Mar 2025 → v3 Dec 2025, with hotfixes in between.

| 4 | **Violin plot** | Candidate: passes native check (2026-10-30) | Distribution per category: a KDE-smoothed density, mirrored, with optional box plot / points inside. Details below. |
| 4c | **Histogram (enhanced)** | Feature set: partly native (2026-10-30) | Percentile-based axis range (e.g. P5–P95) and reference lines (mean/median/percentile) computed from the underlying records and kept in step with filters. Same family as 4/4b. Details below. |
| 5 | **Live parameter updater** (dashboard extension) | Candidate: gap confirmed (2026-10-30) | Keeps parameters equal to a calculated value (e.g. P5/P95) **while filters change**, so native Dynamic Axis Ranges and reference lines follow the data. Details below. |
| 4d | **Box plot + beeswarm** (+ jitter/sina) | Candidate: beeswarm/sina not native | Points packed without overlap over a box plot. Part of the composable distribution chart below. |
| 4b | **Raincloud plot** | Candidate: passes native check (2026-10-30) | Half-violin ("cloud") + box plot + jittered raw points ("rain"). Shares data shape, KDE and encodings with the violin, so it's one family. Details below. |

## Distribution family: one composable chart with layers (user direction, 2026-10-30)

The user wants **multiple overlay options combined in one chart** (e.g. beeswarm + violin + box plot) and
**axis truncation at percentiles** (e.g. P1–P99). So candidates 4/4b/4c/4d become one engine with stackable layers:

| Layer | Options |
|---|---|
| **Density** | none / full violin / half violin ("cloud"); kernel, bandwidth (auto rule-of-thumb, manual, per category) |
| **Box** | none / box + whiskers (Tukey 1.5×IQR or min–max or percentiles) / mean marker / notches |
| **Points** | none / jitter (strip) / **beeswarm** (non-overlapping) / sina (density-shaped spread); size, opacity |
| **Histogram** | none / bars (bin width or count) |
| **Reference lines** | mean, median, any percentile, constant; computed from the raw records |
| **Axis** | auto / **truncate at percentiles (e.g. P1–P99, P5–P95)** / fixed; orientation |

**Presets**, each shipped as its own mark type (`.trex`), all on the same app: Violin, Raincloud (half violin + box
+ points), Box + Swarm, Histogram. Users can then switch layers on or off in Format.

**Research:** [raincloud-research.md](raincloud-research.md), with a live gallery of variants and a layer playground
(prototype engine in `docs/prototypes/raincloud-gallery.html`).

**Build order (agreed 2026-10-30): raincloud first, with every layer toggleable.**
1. **MVP: Raincloud** (half violin + box + points). Switching layers off also gives the violin, violin + box, box + swarm
   and strip/beeswarm views, so one mark type covers most of the family. Points: jitter first, then beeswarm.
2. Percentile axis truncation + reference lines (apply to every view).
3. Histogram layer (and a Histogram preset).
4. Split violin (two groups mirrored, e.g. this year vs last), sina points, further presets as separate `.trex`.

**Truncation design questions** (decide before building):
- Compute statistics (box, density, mean) on **all** data, and truncate only the view? (Recommended: the stats stay true.)
- How to show points beyond the cut: pinned at the edge with an overflow marker, a "+n beyond" count label, or hidden.
- The density curve gets clipped at the edge; mark the clip visually so it doesn't look like the real tail.

**Native check (4d, box + dots):** box plots and random jitter (a `RANDOM()`/`INDEX()` calc) are doable natively;
**beeswarm and sina are not** (not yet verified on the Exchange).

## Candidates 4 + 4b: distribution family (violin, raincloud)

**Raincloud native check:** Tableau can draw box plots, and jittered points via a calculation, but not the density
cloud (same KDE workaround as the violin). No Exchange results for "raincloud" (42 unrelated results, 2026-10-30)
and no Tableau-specific tutorial found. Reference: Allen et al. 2019, "Raincloud plots: a multi-platform tool for
robust data visualization", with open code in R/Python/Matlab at
[RainCloudPlots/RainCloudPlots](https://github.com/RainCloudPlots/RainCloudPlots) (licence not yet checked); in R, ggdist.

**Packaging idea:** one shared distribution engine (disaggregated rows → per-category KDE, quartiles, jitter) and
one app, shipped as **separate mark types** (one `.trex` each, e.g. `?chart=violin` / `?chart=raincloud`) so each
appears by name on the Marks card. Infotopics does the same: one bundle, the chart chosen per page. The layers become
toggles: full or half density, box, points (jitter / strip / beeswarm), orientation.

### 4c: Histogram features (user request 2026-10-30)

1. **Axis range set from the measure's distribution** (e.g. 5th–95th percentile).
   - Native: **Dynamic Axis Ranges (2023.3)** bind axis start/end to parameters
     ([datavis.blog](https://datavis.blog/2023/09/19/tableau-dynamic-axis-ranges/),
     [Data School AU](https://www.thedataschool.com.au/blogs/dynamic-axis-range-new-feature-in-tableau-desktop-2023-3/)).
     A parameter computed from a field only refreshes on workbook open (to verify), so it won't follow filters.
     Parameter actions are a manual workaround.
   - Extension: compute percentiles from the records in view; clip the axis; show clipped tails as overflow bins or counts.
2. **Reference line from an aggregate of the underlying data** (e.g. mean of the raw values).
   - Native: reference lines exist, with Table/Pane/Cell scope ([Tableau help](https://help.tableau.com/current/pro/desktop/en-us/reference_lines.htm)).
     Pitfall: the average of aggregated marks ≠ the mean of the records. **Confirmed gap (user tested 2026-10-30):** "Add Reference Line"
     is only offered on the count (non-bin) axis, so a line at the mean/median/percentile of the raw values can't be placed on a native histogram.
   - Extension: mean/median/percentile/constant lines computed from the raw data; label and style options.

Both features apply across the family (violin, raincloud, histogram), so they belong in the shared engine's options.

## Candidate 5: Live parameter updater (dashboard extension)

**Problem (user-tested 2026-10-30):** native Dynamic Axis Ranges need a parameter, and a parameter computed from
a field only refreshes **on workbook open**. Parameter actions update only when someone clicks or hovers a mark.

**Existing:** Tableau's free "Parameter Actions" extension ([Exchange 104](https://extensiongallery.tableau.com/products/104),
[source](https://github.com/tableau/extension-parameter-actions)) sets a parameter from **mark selections**, so it's
not automatic on filter changes. Nothing found that keeps a parameter equal to a computed value.

**Idea:** a small invisible dashboard extension. Configure pairs: *source sheet + field → target parameter*. The
source is a (hidden) sheet whose single mark is the value, e.g. `PERCENTILE([Sales], 0.95)` with the dashboard
filters applied. On the source sheet's data/filter-change events it reads the value from summary data and calls
`parameter.changeValueAsync(value)`, so any native axis range, reference line or calculation using the parameter updates live.
- API (checked in the 1.17 types): `sheet.findParameterAsync(name)` / `getParametersAsync()`, `Parameter.changeValueAsync(v)`
  (rejected if invalid; range parameters clamp to min/max), worksheet `FilterChanged` / `SummaryDataChanged` events.
- **Dashboard** extension (`<dashboard-extension>` manifest), not a viz extension, but the same API, tooling and debugging.
- Risks: update loops (a parameter change → recompute → change again; guard by comparing values), a brief flicker
  while the second query runs, and parameter domain limits.
- Generic: works for any "live" parameter (percentiles, max date, top-N thresholds), not just axes. Small build;
  a good second project after the hello viz.
- Complements 4c: the histogram extension computes these internally; this one helps **native** charts.

## Candidate 4: Violin plot

**Native check:** Tableau has box plots but **no violin plot**. The community workarounds are heavy:
scaffold table + calculated join + KDE calculated field + negated dual axis drawn as polygon paths
([Data School: Liam Holland](https://thedataschool.co.uk/liam-holland/understanding-and-making-violin-plot-in-tableau),
[Data School: Edward Hayter](https://thedataschool.co.uk/edward-hayter/violin-plots-in-tableau)). A real gap.

**Exchange:** searching "violin" found none (2026-10-30). Nearest relative: Infotopics' Show Me More includes a
**Ridgeline** chart with KDE (seen in their bundle), the same density maths in a different shape. Also Infotopics
Marginal Histogram ([1071](https://exchange.tableau.com/products/1071)) and Actinvision Error Bars ([1098](https://exchange.tableau.com/products/1098)) as other distribution-type extensions.

**Reference product: Power BI "Violin Plot"** by Daniel Marsh-Patrick ([AppSource WA104381947](https://appsource.microsoft.com/product/power-bi-visuals/WA104381947), docs on Bitbucket `dm-p/power-bi-visuals-violin-plot`):
- Violin with optional **combo plot**: box, barcode or column.
- Split and colour by category; **4 kernels**; sampling resolution.
- **Bandwidth**: rule-of-thumb by default (poor for multimodal or skewed data), manual override, and per-category bandwidth (v1.1.0). The bandwidth used is shown in the tooltip.
- Limit: 100 categories per visual (KDE cost).

**Key technical point:** viz extensions get the worksheet's **summary** data, but a violin needs the **distribution**.
The worksheet must be disaggregated to one row per record or observation, as Tableau Table does by putting
dimensions on Detail: e.g. a row-ID dimension on Detail, or Analysis → Aggregate Measures off. Then:
- Encodings: **Category** (dimension, optional), **Value** (measure), maybe **Split/Colour** (dimension); the row ID goes on Detail.
- KDE computed in the browser (d3 + a small KDE; `getSummaryDataReaderAsync` pages up to 4M rows, so performance needs testing).
- Each observation is one tuple, so points and barcode marks map 1:1 to Tableau selection, and selecting a whole violin = selecting all its tuples.
- To prove first: behaviour with ~100k rows, and how users find the disaggregation step (splash screen guidance).

## Per-candidate checklist
- **First: does native Tableau already do it?** Search for the native feature before anything else (candidate 3 was covered by a 2017 feature).
- What it shows that native Tableau can't, or does badly
- Data shape and encodings (≤4 custom tiles)
- Existing Exchange or community alternatives
- Layout/render approach and libraries
- Native-feel requirements (tooltips, selection, keyboard, formatting)
- Effort and risk
