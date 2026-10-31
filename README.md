# Raincloud for Tableau

A Tableau **viz extension** (custom mark type) that shows a distribution's shape, summary and every record:
a density or histogram **cloud**, a slim **box plot**, and one dot per record as **rain**, in a Rows × Columns grid.

**[Website](https://okhammahko.github.io/tableau-viz-extensions/) · [Live demo](https://okhammahko.github.io/tableau-viz-extensions/raincloud/demo/)**

![Raincloud plots in a Rows × Columns grid](docs/images/hero-a-rows-columns.svg)

## Quick start
1. **Download** [`raincloud.trex`](https://okhammahko.github.io/tableau-viz-extensions/raincloud/raincloud.trex).
2. **Add it in Tableau** (Desktop 2024.2+): **Show Me → Viz Extensions → Access Local Viz Extensions** → pick the
   file → follow the prompts.
3. **Drag fields:** a measure to **Value**, a row ID to **Detail** (one dot per record), and optionally a dimension
   to **Rows**.

That's it. Fine-tune with **Format Extension** (below the tiles). *On Tableau Cloud or Server, an admin first adds
`https://okhammahko.github.io` to the extension allow list.*

## Run it from source (developers)
1. `npm install`, then `npm run dev` (serves http://localhost:5173).
2. **Show Me → Viz Extensions → Access Local Viz Extensions →** `vizzes/raincloud/manifests/raincloud-dev.trex` (points at localhost) → follow the prompts.
3. Drag a measure to **Value**, a row ID to **Detail** (or turn off Analysis → Aggregate Measures), and optionally
   dimensions to **Rows**, **Columns** and **Colour**.
4. **Format Extension** (below the tiles) for cloud, rain, outliers, markers, layout and colour.

## Features (v1.0)
- Density (KDE, clipped to the data) or histogram cloud; stacked Wilkinson dot plot or strip rain; Tukey box.
- Native Tableau tooltips and selection per dot; workbook font.
- Rows (≤3) × Columns (≤2) grid with nested headers, wrapping, shared or independent axes; size modes.
- Colour tile: Tableau palettes, stable colours, optional split cloud.
- Outliers cut at whiskers + 5% by default, with a badge that lets viewers show all values.
- Markers: median, mean, P5/P95 with values; decimals setting; field number format and axis title.

## Architecture
| Folder | Role |
|---|---|
| `kit/` | Shared toolkit for any Tableau viz extension: Tableau API and settings, grid layout and headers, colours, number formats, dialog and landing-page parts, build preset (see `kit/README.md`) |
| `vizzes/raincloud/` | The raincloud viz: `src/chart` (statistics, rendering), `src/extension` (Tableau adapter, landing page), `src/dialog` (Format dialog), `src/harness` (dev harness), `app/` (pages), `manifests/` (sandbox) |
| `raincloud.trex` | The manifest users load (points at the GitHub Pages copy) |
| `site/`, `.github/workflows/pages.yml` | The website; every push to `main` builds it with the hosted extension and live demo and deploys it to GitHub Pages |

## Develop
| Command | What |
|---|---|
| `npm run dev` | Dev server; harness at http://localhost:5173/dev.html (synthetic data, every option, landing page) |
| `npm test` | Vitest: stats, layout, colours, format, render smoke tests |
| `npm run build` | Type-check and build to `dist/raincloud/` (classic SystemJS scripts for sandbox hosting) |
| `npm run sandbox` | Build, then serve `dist/raincloud/` with Tableau's sandbox server on :8765; load `vizzes/raincloud/manifests/raincloud-sandbox.trex` |
| `npm run site` | Build the website into `dist/site/` (landing page, hosted extension, `.trex`, live demo); look with `npx vite preview --outDir dist/site` |
| `python -I scripts/make_synthetic.py` | Regenerate `data/synthetic/` |

Credits and resources reviewed: `CREDITS.md`. See `.claude/CLAUDE.md` (project map), `docs/PLAN.md` (status, decisions, backlog), `docs/RELEASE.md` (release checklist).

## Licences
Our code: MIT (see `LICENSE`). Bundled: Tableau Extensions API (Apache-2.0, `kit/public/lib`),
`@tableau/tableau-ui` (Tableau EULA), React (MIT), d3 modules (ISC).
