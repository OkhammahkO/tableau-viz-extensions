// Number formatting that follows the field's Tableau format. Viz extensions get no axis formatting of their own,
// but every summary-data value arrives with Tableau's formatted string, so the format can be inferred from samples:
// prefix/suffix ("$", "%", "K"), scale (0.123 shown as "12.3%"), thousands separators and decimals.

export interface NumberFormat {
  prefix: string;
  suffix: string;
  /** Multiply the raw value by this before display (100 for %, 0.001 for K units…). */
  scale: number;
  thousands: boolean;
  /** Decimals Tableau shows for this field. */
  decimals: number;
}

const SCALES = [1, 100, 1e-3, 1e-6, 1e-9];

interface Parsed {
  prefix: string;
  suffix: string;
  number: number;
  decimals: number;
  grouped: boolean;
}

/** Splits "$1,234.50", "12.3%", "(45)", "−7 K", "1.234,5 €" into prefix, number and suffix. */
export function parseFormatted(text: string): Parsed | null {
  const m = /^([^\d\-−(]*?)\s*(\()?\s*([-−])?\s*([\d][\d.,'\s  ]*)\s*(\))?\s*([^\d]*)$/.exec(text.trim());
  if (!m) return null;
  const [, prefix, openParen, minus, digitsRaw, closeParen, suffix] = m;
  const digits = digitsRaw.replace(/[\s  ']/g, (c) => (c === "'" ? ',' : ''));
  // The decimal separator is the last '.' or ',' unless it's followed by exactly three digits and is the only kind.
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  let decSep = '';
  if (lastDot >= 0 && lastComma >= 0) decSep = lastDot > lastComma ? '.' : ',';
  else if (lastDot >= 0) decSep = digits.length - lastDot - 1 === 3 && digits.indexOf('.') !== lastDot ? '' : '.';
  else if (lastComma >= 0) decSep = digits.length - lastComma - 1 === 3 ? '' : ',';
  const groupSep = decSep === '.' ? ',' : decSep === ',' ? '.' : lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '';
  const intPart = decSep ? digits.slice(0, digits.lastIndexOf(decSep)) : digits;
  const fracPart = decSep ? digits.slice(digits.lastIndexOf(decSep) + 1) : '';
  const grouped = !!groupSep && intPart.includes(groupSep);
  const n = Number(intPart.split(groupSep || '\u0000').join('') + (fracPart ? `.${fracPart}` : ''));
  if (!Number.isFinite(n)) return null;
  const negative = !!minus || (!!openParen && !!closeParen);
  return { prefix: prefix.trim(), suffix: suffix.trim(), number: negative ? -n : n, decimals: fracPart.length, grouped };
}

/**
 * Infers one format from (raw value, Tableau-formatted string) samples. Returns null when the samples disagree on
 * prefix/suffix/scale or can't be parsed, in which case callers fall back to plain numbers.
 */
export function inferFormat(samples: { value: number; formatted: string }[]): NumberFormat | null {
  const usable = samples.filter((s) => Number.isFinite(s.value) && s.value !== 0 && s.formatted);
  if (!usable.length) return null;
  let prefix: string | undefined;
  let suffix: string | undefined;
  let scale: number | undefined;
  let decimals = 0;
  let thousands = false;
  for (const s of usable) {
    const p = parseFormatted(s.formatted);
    if (!p) return null;
    // Which display scale makes the shown number match the raw value (allowing for rounding)?
    const tolerance = 0.5 * Math.pow(10, -p.decimals) + 1e-9;
    const k = SCALES.find((c) => Math.abs(s.value * c - p.number) <= tolerance);
    if (k === undefined) return null;
    if (prefix === undefined) { prefix = p.prefix; suffix = p.suffix; scale = k; }
    else if (prefix !== p.prefix || suffix !== p.suffix || scale !== k) return null;
    decimals = Math.max(decimals, p.decimals);
    thousands ||= p.grouped;
  }
  // Values below 1,000 never show a separator, so a big enough sample without one means none is used.
  if (!thousands && !usable.some((s) => Math.abs(s.value * (scale ?? 1)) >= 1000)) thousands = true;
  return { prefix: prefix ?? '', suffix: suffix ?? '', scale: scale ?? 1, thousands, decimals };
}

function withAffixes(v: number, fmt: NumberFormat | null | undefined, decimals: number): string {
  const scaled = fmt ? v * fmt.scale : v;
  const body = Math.abs(scaled).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: fmt ? fmt.thousands : true
  });
  const sign = scaled < 0 && Number(body.replace(/,/g, '')) !== 0 ? '−' : '';
  const sep = (s: string) => (s && /^[A-Za-z]/.test(s) ? ' ' : '');
  return fmt ? `${sign}${fmt.prefix}${body}${sep(fmt.suffix)}${fmt.suffix}` : `${sign}${body}`;
}

/** Summary values (marker labels, box tooltip): the field's affixes and scale, the user's decimals. */
export function formatSummary(v: number, fmt: NumberFormat | null | undefined, decimals: number): string {
  return withAffixes(v, fmt, Math.max(0, Math.min(6, Math.round(decimals))));
}

/** Axis ticks: the field's affixes and scale, with just enough decimals for the tick step. */
export function formatTick(v: number, fmt: NumberFormat | null | undefined, step: number): string {
  const shownStep = Math.abs(step * (fmt?.scale ?? 1));
  const decimals = shownStep > 0 ? Math.max(0, Math.min(6, Math.ceil(-Math.log10(shownStep) - 1e-9))) : 0;
  return withAffixes(v, fmt, decimals);
}

/** Axis title from Tableau's field name: "SUM(Response Ms)" → "Response Ms" (SUM/AGG/ATTR wrappers only). */
export function axisTitle(fieldName: string): string {
  const m = /^(?:SUM|AGG|ATTR)\((.*)\)$/i.exec(fieldName.trim());
  return m ? m[1] : fieldName;
}
