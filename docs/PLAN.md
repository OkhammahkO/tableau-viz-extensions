# Plan

_Current status and next steps. The full session-by-session record (findings, decisions, reasoning) is in
[history.md](history.md)._

## Status: Raincloud v1.0.0 (tagged 2026-10-31)

Feature list: [CHANGELOG.md](../CHANGELOG.md). Release steps and known limitations: [RELEASE.md](RELEASE.md).

**Pending Tableau checks** (built and tested in the harness, not yet confirmed in Tableau):
- Sandbox build (`npm run sandbox` + `vizzes/raincloud/manifests/raincloud-sandbox.trex`): chart, Format dialog, settings, colours, badge, landing page.
- Colour tile, polish round (box lane, decimals, stable colours with a filter), outlier badge/default,
  strip compression, landing page, axis title and number format on a currency or % field.

## Since v1.0 (2026-10-31)
- Project split into **`kit/`** (reusable toolkit for any viz, see `kit/README.md`) and **`vizzes/raincloud/`**.
  Single root package; build output `dist/<viz>/`. 115 tests.
- Landing page: hero = three shape panels (Normal / Bimodal / Right-skewed) with their own axes, coloured by method,
  summary labels on; example measure "Delivery time (min)".
- Density tails stay **trimmed** at the data (user decision; independent axes are the fix when shapes look cut short).
  awaiting first commit with the user's GitHub no-reply email.

## Next steps (in order)
1. ~~Full test round~~ done (see RELEASE.md); a **detailed-testing TODO** remains there.
2. **GitHub:** first public commit + tag; **GitHub Pages hosting is built** (`site/` landing page, `npm run site`,
   `.github/workflows/pages.yml`; `raincloud.trex` → Pages URL; `vizzes/raincloud/manifests/raincloud-dev.trex` → localhost).
   Live at https://okhammahko.github.io/tableau-viz-extensions/ and checked in Tableau (2026-10-31). Next: GitHub Release.
   Needs the GitHub username and repo name.
3. **Community portal** (https://tableau.github.io/extensions-api/community/): fork tableau/extensions-api, add an entry
   to `community/community_extensions.json` (name, author, description; source link) and our Pages-hosted `.trex` to
   `community/CommunityManifests/`, then open a PR (reviewed by Tableau's Extensibility team).
4. Exchange submission items in RELEASE.md (Tableau UI permission, icon, screenshots, listing text).

## Key decisions (details in history.md)

| Topic | Decision |
|---|---|
| Format dialog | Tableau UI (React 18.3.1 + `@tableau/tableau-ui`); Lite frozen as fallback |
| Tiles | Value · Rows (≤3) · Columns (≤2) · Colour (1); Detail holds the row ID |
| Defaults | Density cloud, box, stacked dots; P5/P95 + mean with values, 0 decimals; outliers cut at whiskers + 5% with a badge |
| Grid | Spanning row headers, empty combinations shown as "no values", shared axes (option: independent), auto wrap, ticks under every panel |
| Colour | Tableau 10 → 20 → "Other"; dots grouped by colour; grey combined cloud; optional split cloud; stable colours |
| Build | Classic SystemJS scripts (plugin-legacy) without `crossorigin`, required by sandbox hosting |
| Not doing | Log scale; custom category sort (native sort works); coloured median/mean markers |

## Next

**Release (see RELEASE.md):** Tableau checks above · licence for our code · Tableau UI permission
(extensiongallery@tableau.com) · hosting choice · icon and screenshots.

**Post-v1 backlog, in priority order:**
1. Theme: respect worksheet background colour (dark dashboards).
2. F11 Highlights and selections from other sheets.
3. F12 Export rendering (PDF/image).
4. F10 Keyboard navigation.
5. Clickable legend (highlight a colour member).
6. F13 Summary table toggle.
7. Nice to have: F8 vertical orientation, F15 ECDF cloud, F9 very large data.
8. On hold: F5 parameter reference lines, F6 split violin, F7 repeated-measures lines.

**Other candidates:** see [CANDIDATES.md](CANDIDATES.md) (Sankey, network flow diagram, live parameter updater, SPC charts).
