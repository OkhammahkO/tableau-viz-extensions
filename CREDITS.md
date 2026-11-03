# Credits and resources

These viz extensions stand on other people's research, tools and examples. This page credits them and lists what
was reviewed while building them. All of the extensions' code is our own; the products listed under "Reviewed" were
studied for ideas and conventions, not copied.

## Research and design: Raincloud

| Credit | What it gave this project |
|---|---|
| Allen, Poggiali, Whitaker, Marshall, van Langen & Kievit, *Raincloud plots: a multi-platform tool for robust data visualization*, Wellcome Open Research (2019, 2021) · [RainCloudPlots](https://github.com/RainCloudPlots/RainCloudPlots) (MIT) | The raincloud itself: cloud, box and rain together |
| Michael Correll, *Teru Teru Bōzu: Defensive Raincloud Plots*, EuroVis / Computer Graphics Forum (2023) · [paper](https://ar5iv.labs.arxiv.org/html/2303.17709) | Defaults: deterministic rain over random jitter, half density over violin, no density beyond the data, labelled summaries, histogram cloud for discrete data |
| Cédric Scherer, [*Visualizing Distributions with Raincloud Plots*](https://cedricscherer.netlify.app/2021/06/06/visualizing-distributions-with-raincloud-plots-and-how-to-create-them-with-ggplot2/) (2021) | The variant catalogue (box + jitter, beeswarm, barcode…) and the case against each default |
| Matthew Kay, [ggdist](https://mjskay.github.io/ggdist/) · Business Science, [*ggdist: Make a Raincloud Plot*](https://www.r-bloggers.com/2021/07/ggdist-make-a-raincloud-plot-to-visualize-distribution-in-ggplot2/) (2021) | The look we chose: half-eye cloud, slim box, stacked dot plot |
| Nicholas Judd, Jordy van Langen et al., [ggrain](https://github.com/njudd/ggrain) (MIT) | Feature ideas: rain side, repeated-measures lines, colour by covariate |
| Davide Poggiali, [ptitprince](https://github.com/pog87/PtitPrince) (MIT) | Python reference implementation |
| Leland Wilkinson, *Dot Plots*, The American Statistician (1999) | The stacked dot-plot layout |
| B. W. Silverman, *Density Estimation for Statistics and Data Analysis* (1986) | Rule-of-thumb bandwidth |
| John W. Tukey, *Exploratory Data Analysis* (1977) | Box plot with 1.5 × IQR whiskers, and the outlier cut |
| Kay, Kola, Hullman & Munson, *When (ish) is My Bus?* (CHI 2016) | Quantile dot plots (considered for very large data) |
| Daniel Marsh-Patrick, [Violin Plot for Power BI](https://appsource.microsoft.com/product/power-bi-visuals/WA104381947) | Feature reference: combo plots, kernels, per-category bandwidth |
| The Data School: Liam Holland, [*Making a violin plot in Tableau*](https://thedataschool.co.uk/liam-holland/understanding-and-making-violin-plot-in-tableau); Edward Hayter, [*Violin plots in Tableau*](https://thedataschool.co.uk/edward-hayter/violin-plots-in-tableau) | How hard this is natively, the gap this extension fills |

## Research and design: Correlation matrix

| Credit | What it gave this project |
|---|---|
| Barret Schloerke et al., [GGally `ggpairs`](https://ggobi.github.io/ggally/) (R) | The layout: scatters below the diagonal, distributions on it, correlations above |
| Michael Waskom, [seaborn `pairplot`](https://seaborn.pydata.org/) (Python); Taiyun Wei & Viliam Simko, [corrplot](https://github.com/taiyun/corrplot) (R) | Reviewed alternatives: mirrored scatters, coefficient-only correlograms; red/blue as the correlation convention |
| Richard A. Becker & William S. Cleveland, *Brushing Scatterplots*, Technometrics (1987) | Brushing and linked highlighting across the scatters |
| Cynthia Brewer, [ColorBrewer](https://colorbrewer2.org/) RdBu | The red and blue of negative and positive coefficients |
| Charles Spearman, *The proof and measurement of association between two things* (1904) | Rank correlation (ρ), with average ranks for ties |
| E. H. Simpson, *The Interpretation of Interaction in Contingency Tables* (1951) | The Simpson's paradox caveat and landing-page example |
| F. J. Anscombe, *Graphs in Statistical Analysis*, The American Statistician (1973) | Anscombe's quartet, one of the test datasets |
| B. W. Silverman and John W. Tukey (above) | Density curves on the diagonal; box plots and the outlier axis cut |

## Tableau platform

| Credit | Use |
|---|---|
| [Tableau Extensions API](https://github.com/tableau/extensions-api) and samples (Apache-2.0) | The API library shipped in `public/lib`, the viz-extension samples (Sankey sample: tuple-based hover and selection), docs on manifests, debugging and sandboxing |
| [@tableau/extensions-api-types](https://www.npmjs.com/package/@tableau/extensions-api-types) (MIT) | TypeScript types |
| [@tableau/tableau-ui](https://tableau.github.io/tableau-ui/) (Tableau EULA) | Format dialog components |
| [@tableau/tabextsandbox](https://www.npmjs.com/package/@tableau/tabextsandbox) (MIT) | Local sandbox hosting test |
| Tableau's Sankey and Tableau Table viz extensions (Exchange) | Studied for native integration conventions: modeless format pane, settings-driven live preview, keyboard and tooltip patterns, classic-script build |
| [Tableau MCP](https://github.com/tableau/tableau-mcp) and [Tableau plugin](https://github.com/tableau/tableau-plugin) | Reviewed as AI tooling for Tableau work |

## Libraries and tools

[D3](https://d3js.org/) modules d3-selection, d3-scale and d3-shape by Mike Bostock and contributors (ISC) ·
[React](https://react.dev/) (MIT) · [TypeScript](https://www.typescriptlang.org/) (Apache-2.0) ·
[Vite](https://vitejs.dev/) and [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy) (MIT) ·
[Vitest](https://vitest.dev/) (MIT) · [happy-dom](https://github.com/capricorn86/happy-dom) (MIT) · Tableau 10/20 colour palettes.

Built with the help of [Claude Code](https://claude.com/claude-code) (Anthropic).

## Resources reviewed

- **Official docs and tooling:** see [RESOURCES.md](docs/RESOURCES.md).
- **Correlation matrix research:** layouts compared, decisions and the spike in
  [concepts/correlation-matrix](docs/concepts/correlation-matrix/README.md).
- **Raincloud design research:** implementations, licences and design guidance in [raincloud-research.md](docs/raincloud-research.md),
  with a live variant gallery in [prototypes/raincloud-gallery.html](docs/prototypes/raincloud-gallery.html).
- **Exchange extensions reviewed** (features, hosting and integration only): Sankey (Tableau), Tableau Table, and Sankey-family
  extensions by Infotopics (Show Me More), KLIMN, LaDataViz and Billigence; Parameter Actions (Tableau).
- **Native Tableau checks** behind the candidate list (e.g. "Use Separate Legends", Dynamic Axis Ranges): [CANDIDATES.md](docs/CANDIDATES.md).
- **Other references:** LaDataViz *Viz Extensions FAQ* (platform limits), Playfair Data and datavis.blog (dynamic axes,
  per-measure legends), InterWorks (viz extension overview).
