# Raincloud research

_2026-10-30. Visual gallery: https://claude.ai/artifact/JfoasV12P9XWN7WokMKc7P (source: `docs/prototypes/raincloud-gallery.html`)._

## Anatomy (Correll 2023)

| Part | Job | Options seen in the wild |
|---|---|---|
| **Cloud** | shape of the distribution | half density (KDE), violin, histogram, quantile dot plot |
| **Lightning** | summary statistics | box plot, median + intervals, mean marker, mean ± interval |
| **Rain** | raw values | random jitter, strip, beeswarm, Wilkinson dot plot, barcode |

The common default is density + jitter + box: in Correll's survey of 50 published rainclouds, density appeared in 48, jitter in 40 and a box plot in 38.

## Variants (all drawn in the gallery)

Box only → box + jitter → box + beeswarm → violin + box → **classic raincloud** (Allen et al.) → **ggdist style**
(half-eye + dot plot; the user's r-bloggers link) → barcode rain (Scherer) → **defensive raincloud** (Correll:
half density + beeswarm + labelled interval) → histogram cloud (for discrete data).

## Implementations

| Source | Platform | Licence | Notes |
|---|---|---|---|
| RainCloudPlots (Allen et al. 2019/2021) | R/Python/Matlab | MIT | Original paper + tutorials |
| **ggrain** `geom_rain` | R | MIT | Best feature set: rain side l/r/flanking, repeated-measures lines (`id.long.var`), Likert jitter, covariate colour, per-layer args. v0.1.2 (Jan 2026) |
| ptitprince | Python | MIT | seaborn port |
| ggdist `stat_halfeye`+`stat_dots` | R | to verify | The r-bloggers look |
| Scherer 2021 tutorial | R | blog | 14 variants, with the case against each; design reference |
| Correll 2023 "Teru Teru Bōzu: Defensive Raincloud Plots" (EuroVis, Tableau Research) | paper | — | Design guidance (below) |
| vijithassar gist, git-blue-white repo | JS / D3 v5 | **none** | Toy demos: smoothed histogram (not KDE), random jitter. Can't copy |
| Observable @jeyabbalas/rain-cloud-plots | D3 notebook | unknown | Reusable components; couldn't load (HTTP 429) |
| dm-p Deneb gist | Vega-Lite (Power BI) | unknown | Density + box + jitter, fixed domains |
| d3, d3-force, Observable Plot | JS | ISC | Building blocks; Plot `dodge` = beeswarm. d3-beeswarm is WTFPL |
| Power BI Violin Plot (dm-p) | Power BI | ? | Combo box/barcode/column, 4 kernels, bandwidth by category, 100-category limit |

The Medium article the user linked (amorimfranchi) returned HTTP 403, so it wasn't reviewed. No Tableau Public raincloud
template turned up.

## Design guidance to adopt

- **Deterministic rain** (beeswarm / dot plot / strip / barcode) over random jitter. Jitter "hallucinates" and hides discrete values. If we offer jitter, seed it so it's stable.
- **Half density** by default, not a mirrored violin.
- **Clip the density to the observed range**: no density beyond the data.
- **Bandwidth control**: the rule-of-thumb default (Silverman) smooths away gaps. Expose a multiplier, maybe per category.
- **Label the lightning** (which whiskers or intervals are drawn).
- **Histogram cloud for discrete data.**
- **Truncation**: statistics on all data, the view cut at percentiles, with counts for values outside.

## Recommendation

No JS raincloud is worth porting as-is. Port the **design** (ggrain features, ggdist look, Correll's defaults) and
write the engine in D3. The gallery engine (~300 lines: Gaussian KDE, Silverman bandwidth, Tukey box, intervals,
deterministic beeswarm, Wilkinson dot plot, histogram, percentile truncation with overflow counts, mean line) is the
first draft to lift into the extension.

Later features worth having: repeated-measures lines (ggrain), flanking rain, colour by covariate, vertical orientation.
