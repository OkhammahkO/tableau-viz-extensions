# Resources — Tableau Viz Extensions

Checked 2026-10-29. Latest Extensions API: **1.17.0** (June 2026).

## Official docs & code

| What | Link |
|---|---|
| Viz extension getting started | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_getstarted |
| Viz manifest (.trex) reference | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_manifest |
| Viz samples index | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_examples |
| API reference | https://tableau.github.io/extensions-api/api/ |
| Release notes | https://tableau.github.io/extensions-api/docs/trex_release-notes/ |
| TypeScript guide | https://tableau.github.io/extensions-api/docs/core/trex_typescript |
| Debugging | https://tableau.github.io/extensions-api/docs/debug/trex_debugging |
| Publishing to Tableau-hosted sandbox | https://tableau.github.io/extensions-api/docs/publish/trex_sandbox_publish |
| Design guidelines | https://tableau.github.io/extensions-api/docs/ux_design |
| Repo (lib, samples) — cloned to `reference/extensions-api` | https://github.com/tableau/extensions-api |
| Types package | `npm i -D @tableau/extensions-api-types@1.17.0` |
| Tableau UI (React components with Tableau's look) | `@tableau/tableau-ui@3.15.0`: docs https://tableau.github.io/tableau-ui/ · licence "subject to Tableau EULA" · runs on React 18.3.1 like Tableau's own extensions (its React 16 peer range is stale) |
| Raincloud design research | [raincloud-research.md](raincloud-research.md): RainCloudPlots, ggrain, ggdist, Scherer 2021, Correll 2023 |
| User help: add viz extensions | https://help.tableau.com/current/pro/desktop/en-us/viz_extensions.htm |
| Tableau Exchange — viz extensions | https://exchange.tableau.com/viz-extensions (submissions: extensiongallery@tableau.com) |
| Developer community forum | https://community.tableau.com/s/topic/0TO4T000000QF8eWAG/developers-apis |

## AI tooling (MCP, plugins, skills)

| What | Notes |
|---|---|
| **Tableau MCP** — https://github.com/tableau/tableau-mcp | Official. Hosted at `https://mcp.tableau.com` (OAuth, Tableau Cloud) or self-host `npx -y @tableau/mcp-server@latest` (v5.1.5, Node ≥ 22.7.5, PAT via `SERVER`/`SITE_NAME`/`PAT_NAME`/`PAT_VALUE`). Queries datasources (VizQL Data Service), lists/inspects workbooks and views, gets view images. Useful for test data and checking published workbooks — not for the extension runtime itself. Not configured in this project; add it with `claude mcp add` if needed. |
| **Tableau plugin** — https://github.com/tableau/tableau-plugin | Official Claude/Codex plugin (cloned to `reference/tableau-plugin`). Skills: `tableau-about`, `tableau-content-viewer`, `tableau-dashboard-advisor`, `tableau-data-app-authoring` (data apps = sandboxed viz extensions that query live), `tableau-data-quality-sentinel`, `tableau-viz-critique`, `tableau-workbook-authoring` (with TWB XSDs 2024.2→). Built dist is on branch `dist/claude`. Good reference for skill structure and workbook XML. |
| Project skill `.claude/skills/tableau-viz-extension` | Ours. Distilled API patterns, manifest, build constraints, debugging. |
| Community skills (unvetted) | `personamanagmentlayer/pcl` → `tableau-expert` (calc/LOD focus); claudskills.com `data-tableau-designer`. Not extension-specific; skip unless needed. |

## Community templates & examples

| What | Notes |
|---|---|
| https://github.com/asluzh/tableau-ext-withreact | React + Vite + TS extension template (MIT, ~Oct 2025). Dashboard-oriented; check before reuse. |
| https://github.com/sonnguyendataai/tableau-viz-extensions | D3 viz-extension skeleton (single render fn + .trex encodings). README in Vietnamese. |
| https://github.com/topics/tableau-extension | GitHub topic listing. |
| Observable D3 gallery (Sankey, etc.) | ISC-licensed chart code the official samples adapt from. |

## Local reference material

- `reference/extensions-api/` — official repo (shallow clone).
- `reference/tableau-plugin/` — official plugin source.

`reference/` is git-ignored: it is third-party material.
