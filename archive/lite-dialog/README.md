# Frozen: Lite Format dialog

Plain TypeScript + CSS prototype of the Format dialog (≈1.7 KB), kept as the fallback in case bundling
`@tableau/tableau-ui` isn't allowed. Not built, not maintained; it targets the v1.0 options.

To restore: move `raincloud-format-lite.html` to `app/` and `lite.ts`/`lite.css` to `vizzes/raincloud/src/dialog/`
(fix the import paths: the chart is now `vizzes/raincloud/src/chart/`, settings `vizzes/raincloud/src/extension/settings.ts`), add the page to `vite.config.ts` inputs, and point `openFormatDialog` in
`vizzes/raincloud/src/extension/main.ts` at `raincloud-format-lite.html`. Add any options added since v1.0.
