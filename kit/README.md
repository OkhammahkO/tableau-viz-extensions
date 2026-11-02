# kit: shared toolkit for Tableau viz extensions

Generic code every viz in `vizzes/` can use. Imported as `@kit/…`. **The kit never imports from a viz.**

| Module | What it gives you |
|---|---|
| `tableau/api.ts` | Paged summary-data reading, tuple ids, encodings, logged API calls |
| `tableau/settings.ts` | `createSettingsStore(key, merge)`: options as one JSON string in Tableau settings, serialized saves |
| `grid/layout.ts` | Size modes (Entire view, Fit width/height, Standard), Rows × Columns panels, wrapping; tick strip per cell or once per block (`footH`) |
| `grid/ticks.ts` | Axis tick values (Fewer / Auto / More density, fixed interval) and label thinning so labels never overlap |
| `grid/paths.ts` | Row/column combinations for Rows/Columns tiles (every combination, capped) |
| `grid/headers.ts` | Nested/spanning row headers, column headers (nested or per wrapped panel), colour legend |
| `colours.ts` | Tableau 10/20 palettes, "Other" folding, stable colours remembered per field |
| `format.ts` | Number format inferred from Tableau's formatted values; tick/summary formatting; axis titles |
| `theme.ts` | Default text/line colours and font |
| `ui/dialog.ts` | Format-dialog session with live save (`startDialog(store, defaults)`) |
| `ui/splash.ts` | Landing-page parts: Tableau-style pills, numbered steps, feature chips |
| `ui/tooltip.ts` | Small in-chart tooltip and HTML escaping |
| `build/vite.ts` | `vizConfig(name, pages)`: the shared, sandbox-safe Vite setup |
| `public/lib/` | Tableau Extensions API library (Apache-2.0) |

## Adding a viz
1. Create `vizzes/<name>/` with `app/` (HTML pages loading `/src/…`), `src/`, `manifests/`, and
   `vite.config.ts`: `export default defineConfig(vizConfig('<name>', { <name>: '<name>.html' }))`.
2. Add a `<name>.trex` at the top level and scripts in `package.json` (`--config vizzes/<name>/vite.config.ts`).
3. Reuse the kit; keep viz-specific code in the viz. Tests next to the code are picked up by `npm test`.
