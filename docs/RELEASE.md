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
- [x] GitHub Release v1.0.0 with `raincloud.trex` attached.
- [x] PR https://github.com/tableau/extensions-api/pull/673 (2026-10-31): entry + `Raincloud.trex` on `gh-pages-dev`
      (the docs page still says `community/` on main; the files live in `website/static/community/` on `gh-pages-dev`).
      CLA signed and green (2026-11-02; the bot only re-checked after closing and reopening the PR). Awaiting review.
      Outside community PRs since 2025-03 were closed unmerged, so don't wait on it.

## v1.1 release (when the v1.1 items are done)
- [x] Dev build in Tableau: user reports it works well (2026-11-02).
- [x] **Built site in Tableau** (TESTING.md section P): user: "all looking good" (2026-11-02).
- [x] Tableau round (dev + built) and harness checks: user sign-off 2026-11-02.
- [x] `npm run showcase` regenerated (2026-11-02, after the renderer refactor); README features and site "Also
      included" updated for v1.1. Still to do: eyeball `docs/images/*.svg` and `npm run site` + preview before pushing.
- [x] Version 1.1.0 in `package.json`, `extension-version` in the four `.trex` files; CHANGELOG dated 2026-11-02.
- [ ] Refresh the public copy (`raincloud-tableau`) from the private HEAD; commit; tag v1.1.0; user pushes (Pages
      redeploys the hosted extension: everyone on the public `.trex` gets v1.1 automatically); GitHub Release notes.
- [ ] Defaults changed since v1.0 (cloud height fit per chart, split 100%, orange mean): workbooks saved with v1.0
      keep only the options they stored, so new options take the new defaults.

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
