# Raincloud for Tableau

Tableau **viz extension** (custom mark type): a raincloud plot (density/histogram cloud, box, dot-plot rain) in a
Rows × Columns grid. v1.0.0, aimed at a free Tableau Exchange release.

## Read first
- `docs/PLAN.md`: status, key decisions, next steps. `docs/RELEASE.md`: release checklist. `docs/TESTING.md`: manual test round.
- `.claude/skills/tableau-viz-extension/SKILL.md`: Extensions API patterns and gotchas verified in Tableau. Load it
  for any extension work.
- `docs/history.md`: the full record of findings and decisions; `docs/CANDIDATES.md`: other viz ideas.

## Architecture
```
kit/                 Shared toolkit for any viz (imported as @kit/…; never imports viz code): tableau/ (API, settings
                     store), grid/ (layout, paths, headers), colours, format, theme, ui/ (dialog session, splash parts,
                     tooltip), build/vite.ts (vizConfig preset), public/lib (Extensions API library). See kit/README.md.
vizzes/raincloud/    The raincloud viz: src/chart (stats, model, options, render), src/extension (main.ts adapter,
                     settings, splash), src/dialog (Format dialog, React + Tableau UI), src/harness (dev harness),
                     app/ (HTML pages; code loads as /src/…), manifests/ (dev + sandbox manifests, sandbox config), vite.config.ts
```
Data flow: Tableau summary data → `extension/main.ts` → `chart/model.buildGrid` → `chart/render.renderRaincloud`.
Options live in Tableau settings as one JSON string (kit settings store, merged over `chart/options.DEFAULT_OPTIONS`).

## Other folders
`raincloud.trex` (the manifest users load; points at GitHub Pages) · `site/` (website landing page;
`npm run site` builds `dist/site/`, `.github/workflows/pages.yml` deploys it) · `data/synthetic/` (test CSVs; `python -I scripts/make_synthetic.py`) ·
`examples/` (test workbook) · `archive/lite-dialog/` (frozen fallback dialog) · `docs/` · `reference/` (git-ignored, optional:
clone tableau/extensions-api there for the official samples) · `dist/<viz>/` (build output).

## Commands
- `npm run dev`: dev server on http://localhost:5173 (the URL in `vizzes/raincloud/manifests/raincloud-dev.trex`); harness at /dev.html.
- `npm test`: Vitest. `npm run build`: type-check and bundle to `dist/raincloud/` (classic SystemJS scripts, required by
  sandbox hosting). `npm run sandbox`: build and serve `dist/raincloud/` with Tableau's sandbox server (:8765).
- Old Tableau (Chromium 87) may reject the dev client: use `npm run build:watch` + `npm run preview`.

## Conventions
- Extensions API ≥ 1.12 (Tableau 2024.2+); feature-detect newer APIs.
- `kit/` never imports from `vizzes/`. A viz's `src/chart` stays free of Tableau calls; only `src/extension` and `src/dialog` talk to Tableau.
- Check visuals in the harness first, then in Tableau; record Tableau findings in the skill.
- Everything bundled (sandbox hosting blocks the network); relative asset paths.
- Environment: Windows 11, Node 26, Python 3.12, Tableau Desktop 2026.3.0 for testing.
