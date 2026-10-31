// Colours and font for chart text and lines (workbook formatting overrides font and text colour).

export interface RenderTheme {
  fontFamily: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

export const DEFAULT_THEME: RenderTheme = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  text: '#333333',
  muted: '#767676',
  grid: '#e6e6e6',
  surface: '#ffffff'
};
