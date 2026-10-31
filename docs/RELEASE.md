# Release checklist (Raincloud v1.0 → Tableau Exchange)

## Done in v1.0
- [x] Chart, grid, colour, outliers, markers, number format, axis title, landing page.
- [x] 120 automated tests (`npm test`).
- [x] Sandbox check (`npm run sandbox` + `vizzes/raincloud/manifests/raincloud-sandbox.trex`): every built file loads under the sandbox CSP.
      Found and fixed: module scripts and `crossorigin` are refused there (null origin, no CORS headers), so the
      build emits classic SystemJS scripts only, like Tableau's own Sankey.

## Test round (2026-10-31, Tableau Desktop 2026.3.0)
- Passed: dev build overall incl. T5 (Format dialog, Done closes), T6 (number format, axis title); sandbox build
  S1 (loads), S2 (dialog opens and closes), S3 (colours, badge, interaction).
- Fixed during the round: dialog URL relative to the .trex (sandbox); Done closes like Tableau's Sankey (Desktop).
- [ ] **TODO detailed testing:** T7 stable colours with a filter, T9 save/reopen, T10 robustness, H1–H9 after the
      latest changes, plus Tableau Cloud/Server (safe-list) and an older Desktop (2024.2, Chromium 87).

## Community portal (lighter, before the Exchange)
- [x] GitHub Pages site built (`site/`, `npm run site`, `.github/workflows/pages.yml`); `raincloud.trex` points at
      https://okhammahko.github.io/tableau-viz-extensions/raincloud/raincloud.html; dev manifest in `vizzes/raincloud/manifests/`.
- [x] Public repo https://github.com/OkhammahkO/tableau-viz-extensions pushed; Pages live (Source: GitHub Actions).
- [x] **Tableau check of the hosted build** (2026-10-31, Desktop 2026.3.0): downloaded `.trex` loads from Pages; chart,
      Format dialog and Done work.
- [ ] GitHub Release v1.0.0 with `raincloud.trex` attached.
- [ ] PR to tableau/extensions-api: entry in `community/community_extensions.json` + manifest in
      `community/CommunityManifests/` (docs: https://tableau.github.io/extensions-api/docs/publish/trex_contributing).

## Before submitting
- [ ] **Tableau check of the sandbox build:** add `vizzes/raincloud/manifests/raincloud-sandbox.trex` in Tableau with `npm run sandbox` running;
      confirm chart, Format dialog (live preview), settings saved with the workbook, colours, badge, landing page.
- [ ] Tableau checks still pending: F4 colour, polish round, outlier badge/default, strip compression, landing page,
      axis title/number format (on a currency or % field).
- [x] **Licence for our code:** MIT (`LICENSE`).
- [ ] Third-party notices bundle: Extensions API (Apache-2.0), React (MIT),
      d3 (ISC), Tableau UI (Tableau EULA).
- [ ] **Tableau UI permission:** ask extensiongallery@tableau.com whether a free Exchange extension may bundle
      `@tableau/tableau-ui` (fallback: frozen Lite dialog).
- [ ] **Hosting:** Exchange route (Tableau sandbox hosting via submission) or own HTTPS host. Final `.trex` with the
      HTTPS URL, no query string, author/website/description, localized strings.
- [ ] Icon/screenshots for the listing (Exchange wants a 280×280 PNG).
- [ ] Tableau Cloud/Server: safe-list test.

## Known limitations (v1.0)
- Number format inference outputs en-US separators even when the workbook uses another locale.
- Chart assumes a light background (dark dashboards: backlog item "theme").
- No keyboard navigation, no highlights from other sheets, export rendering untested (backlog F10–F12).
