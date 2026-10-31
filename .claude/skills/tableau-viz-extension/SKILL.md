---
name: tableau-viz-extension
description: Build, debug and package Tableau Viz Extensions (custom mark types on the Marks card, .trex worksheet-extension manifests, Extensions API 1.12+). Use whenever editing a .trex file, writing code that calls tableau.extensions.*, wiring encodings/summary data/selection/hover/tooltips/formatting, setting up the dev server, debugging inside Tableau Desktop, or preparing an extension for Tableau Exchange.
---

# Tableau Viz Extensions

A viz extension is a web page Tableau loads in an iframe on a worksheet. It shows up as a mark
type on the Marks card, declares custom encoding tiles in its `.trex` manifest, reads the
worksheet's summary data, and draws the viz itself (SVG/canvas). Verified against Extensions
API **1.17.0** (June 2026). When unsure about a signature, grep the local copies first:

- API library + types: `reference/extensions-api/lib/tableau.extensions.1.17.0.js`, npm `@tableau/extensions-api-types@1.17.0`
- Official samples: `reference/extensions-api/Samples/Viz/*` (Sankey = selection/hover/formatting; Settings; UINamespace = dialogs)
- Docs: https://tableau.github.io/extensions-api/docs/vizext/trex_viz_getstarted · API ref: https://tableau.github.io/extensions-api/api/

## Version floor

| Feature | API | Tableau |
|---|---|---|
| Viz extensions, multi-tuple select, `hoverTupleAsync`, keyboard nav, `<context-menu>` Format button | 1.12 | 2024.2 |
| `WorksheetFormattingChanged`, `worksheet.formatting/backgroundColor`, `applyWorksheetFormatting` | 1.13 | 2025.1 |
| `DataValue.hasAlias/aliasValue` | 1.14 | 2025.2 |
| Dialog messaging (`sendDialogMessageAsync`, `DialogMessageReceived`) | 1.15/1.16 | 2025.3/2026.1 |
| Export on Cloud/Server (`reportExtensionRenderComplete`, `environment.isExporting`), `DataRole`/`SemanticRole` in visual spec, `WorkbookLocale` | 1.17 | 2026.2 |

Feature-detect anything newer than your `<min-api-version>` (e.g. `if (tableau.extensions.reportExtensionRenderComplete)`).

## Manifest (`.trex`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.yourco.viz.name" extension-version="0.1.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>…</description>
    <author name="…" email="…" organization="…" website="https://…"/>
    <min-api-version>1.12</min-api-version>
    <source-location><url>http://localhost:5173/index.html</url></source-location>
    <icon/>
    <context-menu><configure-context-menu-item/></context-menu>   <!-- "Format Extension" → configure() -->
    <encoding id="level">                                          <!-- id is what your JS reads -->
      <display-name resource-id="level-name">Level</display-name>
      <role-spec>
        <role-type>discrete-dimension</role-type>                  <!-- continuous-measure | discrete-dimension | continuous-dimension | discrete-measure -->
      </role-spec>
      <!-- optional <data-spec><data-type>numeric|temporal|string|boolean</data-type></data-spec> -->
      <fields max-count="5"/>
      <encoding-icon token="level"/>                               <!-- e.g. letter-x, letter-y, text, level, edge -->
      <tooltip resource-id="level-tip">Drag up to five dimensions here.</tooltip>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">My Viz</text></resource>
  </resources>
</manifest>
```

Rules: max **4 custom encodings** (Detail + Tooltip always exist); `url` must be HTTPS except
localhost; add `<permissions><permission>full data</permission></permissions>` only if you call
underlying-data APIs. `extension-version` in a downloaded .trex is just metadata — the hosted URL
serves whatever is deployed.

One manifest per target, each with its own `id` (workbooks store it, so fix the public id before release): the
public `raincloud.trex` (`io.github.okhammahko.raincloud`, GitHub Pages URL), `manifests/raincloud-dev.trex` (`….dev`,
localhost:5173) and `manifests/raincloud-sandbox.trex` (`….sandbox`, :8765). All built paths are relative, so the same
build works at localhost, the sandbox and `https://<user>.github.io/<repo>/raincloud/`.

## Core runtime pattern

```ts
await tableau.extensions.initializeAsync({ configure: openFormatDialog }); // configure only if <context-menu>
const ws = tableau.extensions.worksheetContent!.worksheet;

async function encodingMap() {                  // encoding id -> fields[]
  const spec = await ws.getVisualSpecificationAsync();
  if (spec.activeMarksSpecificationIndex < 0) return {};
  const map: Record<string, Field[]> = {};
  for (const e of spec.marksSpecifications[spec.activeMarksSpecificationIndex].encodings)
    (map[e.id] ??= []).push(e.field);
  return map;
}

async function readData() {
  // Read encodings first and skip this when required ones are empty.
  const reader = await ws.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    for (let i = 0, offset = 0; i < reader.pageCount; i++) {   // NOT getAllPagesAsync (see gotchas)
      const page = await reader.getPageAsync(i);
      page.data.forEach((cells, r) => use(cells, /* tupleId */ offset + r + 1));
      offset += page.data.length;
    }
  } finally { await reader.releaseAsync(); }        // always release
}

ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, rerender);
// also: WorksheetFormattingChanged (1.13+), SettingsChanged, FilterChanged, ParameterChanged, MarkSelectionChanged
```

- Columns: `table.columns[j].fieldName`, cell `table.data[i][col.index]` → `.value`, `.formattedValue`, `.nativeValue`.
- Encodings return `FieldInstance` (not `Field`); match `field.name === column.fieldName` (e.g. `SUM(Sales)`).
- **Tuple IDs = summary-data row index (across pages) + 1.** The 1.17 type docs claim `totalRows - index`; that's wrong. Verified in Tableau with the hello viz on 2026-10-29: the hover tooltip matches the bar. Tableau's production Sankey also uses offset + index + 1. Selection: `ws.selectTuplesAsync(ids, tableau.SelectOptions.Simple, { tooltipAnchorPoint: {x, y} })`; hover: `ws.hoverTupleAsync(id, { tooltipAnchorPoint })`. This gives native Tableau tooltips and actions (Keep Only/Exclude/View Data). See `Samples/Viz/Sankey/sankey.js`.
- Formatting: give the root SVG `class={tableau.ClassNameKey.Worksheet}`, read fonts/colours from `tableau.extensions.environment.workbookFormatting.formattingSheets` (`classNameKey === 'tableau-worksheet'`). Respect `worksheet.backgroundColor` (1.13+).
- Settings persist per instance: `tableau.extensions.settings.set(k, v)` then `await settings.saveAsync()`; values are strings (JSON-encode).
- Dialogs: `tableau.extensions.ui.displayDialogAsync(url, payload, { width, height, dialogStyle })`; the dialog page calls `initializeDialogAsync()` and `ui.closeDialog(result)`.
- Resize: re-render from cached data on `window.resize`; don't refetch.
- Export (1.17): when `environment.isExporting`, render then call `reportExtensionRenderComplete()`.

## Gotchas found in Tableau (hello viz, 2026-10-29)

- `reader.getAllPagesAsync()` throws `invalid-parameter: 0 is invalid value for range: [0..0)` when there are 0 rows (e.g. encodings empty). Loop `pageCount` instead.
- `hoverTupleAsync(-1, null)` to "clear hover" → `internal-error: ExecuteCommand failed … Error parsing command parameter value string`. Never send an invalid tuple; on mouse-out just drop local hover state (Tableau's Sankey does the same).
- Keyboard: listen on **`document`** for `keydown`. A listener on a focusable SVG never fires reliably: Tableau routes keys into the frame, and redraws replace the element. Tableau's Sankey uses `document.onkeydown`.
- Hello viz passed all checks in Tableau Desktop (2026-10-29), including keeping the selection across a filter-driven redraw.
- No `.trex` XSD is published (not in extensions-api or tableau-plugin). Manifest errors appear only in `My Tableau Repository` logs (`XSD Validation Failed`).
- Flow/Sankey mapping: when one drawn link aggregates several summary rows, select all of its tuples (`selectTuplesAsync` takes an array), but `hoverTupleAsync` takes one, so Tableau's Sankey hovers the first. In an edge-list model (one row = one edge), this problem disappears.
- Keyboard nav verified working with the document listener. Arrows move **focus** (outline + tooltip); Enter/Space changes **selection**. Users can confuse the two, so make the focus indicator clearly distinct from the selection styling (a thick ring, not a thin stroke).
- Wrap every `*Async` API call with a `.catch` that logs; otherwise failures surface only as `Uncaught (in promise)` from the minified lib.
- Throttle hover calls (~50 ms) and send them only when the hovered mark changes.
- `favicon.ico` 404 in the console is harmless.

## Record-level data (raincloud spike, Tableau 2026.3.0, 2026-10-31)

- **A row-ID dimension on Detail gives one summary row per record.** Verified: 373 rows, and the stats matched the source CSV exactly.
- **Turning off Analysis → Aggregate Measures also works** (verified with the same data, no row ID needed). The instructions screen should offer both options.
- The measure still arrives aggregated per mark (`SUM(Value)`), which equals the raw value when the ID is unique. Detect real aggregation by **row count ≤ category count**, not by the field name.
- Tableau renames CSV headers (`row_id` → `Row Id`, `value` → `Value`). Never hard-code field names; resolve them through the encodings.
- A numeric `row_id` column arrived as a dimension in this test (`Row Id (int)`), so no conversion was needed. Other sources may infer it as a measure; the instructions screen should cover that.
- Read time: 373 rows ≈ 47 ms (getVisualSpecificationAsync ≈ 23 ms).
- **Scale:** 100,000 records → 10 pages (10,000 rows per page by default), read in ≈ 956 ms. View build felt fast, and hover over 100k SVG circles was acceptable. ~1 s load at 100k is fine; drawing every record is a legibility problem before it's a performance one.
- **Null measure values reach the extension** as rows (verified with edge_cases.csv: 30 values + 20 nulls; an all-null category still appears with 0 values). Detect nulls via `value === null`, `'%null%'` or a NaN `Number(value)`, as `vizzes/raincloud/src/extension/main.ts` does, and report the missing count rather than dropping it silently. A null dimension member arrives as its own category.

## Target architecture ("feels native")

Modelled on how Tableau's own Sankey behaves:
- One state object; every event calls `update(state, reason)` with reason ∈ `data | size | selected-marks | highlighted-marks | hovered-marks | formatting | encodings | settings`, and each reason re-renders only its layer.
- Tag each row with `$tupleId` while reading the reader pages; bind it to the drawn element's datum.
- Selection goes to Tableau (`selectTuplesAsync`, Ctrl/Meta to add, empty click clears). Restore it from `getSelectedMarksAsync`/`getHighlightedMarksAsync`. Hover uses `hoverTupleAsync`, throttled, so you get native tooltips and actions instead of custom tooltip DOM.
- Keyboard: arrows/Enter/Space move the focused mark, which calls `hoverTupleAsync` anchored at that mark. Escape/Tab call `leaveMarkNavigationAsync()`. Write `getTooltipTextAsync(id)` into an `sr-only` `role="status" aria-live="assertive"` element.
- Format dialog: Modeless, 320 px wide, full height; writes to settings, and `SettingsChanged` triggers a re-render.
- Show a splash screen with instructions until the required encodings are filled.

## Build & runtime constraints

- Tableau Desktop embeds an old Chromium (Qt WebEngine; ~Chrome 108 for 2025.2+, ~87 for 2021.1–2025.1). Tableau's own Sankey ships with **Vite + `@vitejs/plugin-legacy`** for that reason — target `chrome87`/`es2019` unless min Tableau ≥ 2025.2.
- Use relative asset paths (`base: './'`) — Tableau-hosted (sandboxed) extensions are served under a sub-path and cannot make network calls; bundle everything, no CDNs.
- Ship `tableau.extensions.1.latest.min.js` (or pinned version) alongside the page and load it via `<script>` before your bundle; the global is `tableau`.
- `@tableau/tableau-ui` (3.15) requires React 16 — only adopt it if we accept that peer dep.

### Tableau-hosted sandbox rules (if we ever publish via Tableau hosting)
- No network or CDN access; nothing leaves the browser. Every reference must be **relative**, with resources in the page's folder or below it.
- The `.trex` URL must name the HTML file explicitly (an implied `index.html` fails). No hash routing (`page.html#/config`), so give each dialog its own HTML page.
- Test locally with the extensions-api repo: `npm run start-sandbox` plus `sandbox-config.json` (`{"port":8765,"extensions":{"name":{"path":"…"}}}`) → `http://localhost:8765/sandbox/<name>/<page>.html`. Restart after config changes.

- **Verified with `@tableau/tabextsandbox` 1.17.0 (2026-10-31):** content runs in `sandbox allow-scripts` without
  `allow-same-origin` (null origin) and files are served **without CORS headers**, so `<script type="module">` and any
  `crossorigin` script are refused. Build classic scripts: `@vitejs/plugin-legacy` with `renderModernChunks: false`
  and strip `crossorigin` from the HTML (Tableau's own Sankey ships this way). CSP allows inline scripts/styles and
  same-folder files only; no localStorage (null origin).
- tabextsandbox resolves an extension's `path` **relative to the config file**, not the working directory.

### Known platform limits
- Rows/Columns shelves can't be used with a viz extension (re-confirmed in Tableau 2026.3.0). Emulate them with
  custom Rows/Columns tiles that take several ordered fields. Detail and Tooltip tiles are always present.
- Background can't be transparent.
- Before API 1.17 / 2026.2, exports (PDF/image) render the extension blank.
- Not available on Tableau Public (per LaDataViz FAQ, 2025; re-check).
- Extensions see only the worksheet's aggregated summary data unless `full data` permission is declared and underlying-data APIs are used.

## Format dialog & settings (raincloud, 2026-10-31)

- Manifest: `<context-menu><configure-context-menu-item/></context-menu>` (after `<icon/>`). Changing a `.trex`
  means removing and re-adding the extension.
- **Where users find it:** the **Format Extension** button appears on the Marks card, **below the encoding tiles**
  (Value, Category, …). Verified in Tableau 2026.3.0.
- `initializeAsync({ configure })`: the 1.17 types declare callbacks as `() => {}`, i.e. returning an object. Write
  `configure: () => { void open(); return {}; }`.
- Open with `ui.displayDialogAsync('page.html', '', { width: 320, height: 620, dialogStyle: tableau.DialogStyle.Modeless })`.
  **Use a path relative to the `.trex` URL** (as Tableau's sandboxed sample does). An absolute URL from `location.href`
  works on a normal host but fails under sandbox hosting: the page runs from `/private-content/…`, not the registered URL. Closing via the window's X rejects with
  `ErrorCodes.DialogClosedByUser`: ignore it.
- The dialog page calls `initializeDialogAsync()` and can read and write `tableau.extensions.settings`. Saving from the
  dialog fires `SettingsChanged` in the extension, which gives a **live preview** (re-render on that event).
- **Closing a dialog from inside it (verified under sandbox hosting, Desktop 2026.3):** `closeDialog('')` was silently
  ignored. Do as Tableau's production Sankey does: in Desktop / PublicDesktop context call
  `closeDialog(payload, '<dialog page relative URL>')`, elsewhere `closeDialog(payload)`; wait for pending settings saves
  first; payload must be non-empty (`' '`). See `kit/ui/dialog.ts`.
- **Only one `settings.saveAsync()` at a time:** queue saves and let the latest win (`kit/tableau/settings.ts`).
- Store options as **one JSON string** and deep-merge over defaults on load, so old workbooks gain new options.
- Two dialog stacks prototyped (see `docs/PLAN.md`):
  - **Tableau UI** (`@tableau/tableau-ui` 3.15): Tableau's own Sankey and Table run it on **React 18.3.1**, despite its
    stale `react ^16.9.0` peer range. Install with an npm `overrides` entry. It can't move to React 19 (uses
    `findDOMNode`). Licence: "subject to Tableau EULA". Call `addDesignTokenStylesToDocument()` once. Useful components:
    range Slider, ColorGrid (Tableau palettes), SideTabs/Tabs, Accordion/Disclosure, Stepper, ToggleSwitch, Pill,
    Spinner. **No** free colour or font picker (Tableau's Sankey built its own). Dialog JS ≈ 110 KB gzipped.
  - **Lite** (plain TS + CSS): ≈ 1.7 KB gzipped, no dependencies, close but not identical look.
- **Dev-server gotcha:** Vite reloads the extension page whenever a source file is saved. In Tableau that looks like
  the viz "going blank" for a moment. Don't mistake it for a bug while testing during edits.
- Never leave a blank frame: wrap drawing in try/catch and show the error in the chart area; number each refresh so
  an older, slower `SummaryDataChanged` read can't overwrite a newer one; show a message when filters leave no rows.

## Debugging in Tableau Desktop (Windows)

- **Logs:** `Documents\My Tableau Repository\Logs\log.txt`. Look for `Registration Failed: XSD Validation Failed` (bad .trex) or `Multiple Extensions With ID`.
- **After editing the `.trex`**, remove the extension from the worksheet and add it again. Reload alone does not re-read the manifest.


```
"C:\Program Files\Tableau\Tableau <version>\bin\tableau.exe" --webEngineArgs --remote-debugging-port=8696
```
Open `http://localhost:8696` in Chrome/Edge, pick the extension page. **Reloading a viz extension:**
the Vite dev server reloads the page itself on save. Otherwise press Ctrl+R in the attached DevTools,
or switch the mark type away and back. ("More Options → Reload" in the docs exists only on dashboard-extension frames.) For load-time errors: Sources → Event Listener Breakpoints → Script →
*Script First Statement*, then reload. Load the .trex via **Show Me → Viz Extensions → Access Local Viz Extensions** (or Marks card → mark type → Viz Extensions → Add Extension).
Cloud/Server need `http://localhost:.*` safe-listed to load a localhost dev build.

## Checklist before calling something done

- Handles empty/incomplete encodings (show an instructional splash, not an error).
- Handles nulls, aliases (`aliasValue`), very large mark counts, and resize.
- Selection + hover + tooltip wired through tuple IDs; keyboard nav if feasible (`getTooltipTextAsync`, `leaveMarkNavigationAsync`).
- Follows workbook formatting and works in dark backgrounds.
- `.trex` localized strings, encoding tooltips, `min-api-version` matches what's used.
