import type { PairStats } from './stats';

// Plain-language reading of a correlation (user, 2026-11-02: "explain results in words, especially the corr
// numbers"). Strength bands follow common convention (|r| < .1 negligible, < .3 weak, < .5 moderate, < .7 strong,
// otherwise very strong). Caveats appear only when they apply. Correlation never implies cause; the full reading says so.

export type Strength = 'negligible' | 'weak' | 'moderate' | 'strong' | 'very strong';

export function strengthOf(r: number): Strength {
  const a = Math.abs(r);
  return a < 0.1 ? 'negligible' : a < 0.3 ? 'weak' : a < 0.5 ? 'moderate' : a < 0.7 ? 'strong' : 'very strong';
}

export interface Reading {
  /** One sentence: strength, direction and what it means for the two measures. */
  headline: string;
  /** "Income accounts for 58% of the variation in Spend (straight-line fit)." */
  explained: string | null;
  /** Only the caveats that apply: curved or outlier-driven, groups disagreeing, few records. */
  caveats: string[];
}

export interface GroupStat { label: string; r: number; n: number }

/** Reads a pair: x across, y up. `r` is the coefficient shown; `s` carries both. */
export function readPair(xName: string, yName: string, s: PairStats, coefficient: 'pearson' | 'spearman', groups: GroupStat[] = []): Reading {
  const r = coefficient === 'spearman' ? s.spearman : s.pearson;
  if (Number.isNaN(r)) {
    return { headline: 'No correlation can be computed: one measure has no variation, or there are fewer than 3 records with both values.', explained: null, caveats: [] };
  }
  const strength = strengthOf(r);
  const headline = strength === 'negligible'
    ? `Negligible: ${yName} shows no clear straight-line link with ${xName}.`
    : `${capital(strength)} ${r > 0 ? 'positive' : 'negative'}: as ${xName} rises, ${yName} tends to ${r > 0 ? 'rise' : 'fall'}.`;
  const explained = Number.isNaN(s.pearson) || Math.abs(s.pearson) < 0.1 ? null
    : `${xName} accounts for ${Math.round(s.pearson ** 2 * 100)}% of the variation in ${yName} (straight-line fit).`;

  const caveats: string[] = [];
  if (!Number.isNaN(s.spearman) && !Number.isNaN(s.pearson) && Math.abs(s.spearman) - Math.abs(s.pearson) >= 0.1) {
    caveats.push('Spearman ρ is clearly stronger than Pearson r: the relationship is consistent but curved, or pulled by outliers.');
  } else if (!Number.isNaN(s.spearman) && !Number.isNaN(s.pearson) && Math.abs(s.pearson) - Math.abs(s.spearman) >= 0.15) {
    caveats.push('Pearson r is clearly stronger than Spearman ρ: a few extreme records may be driving it.');
  }
  const signed = groups.filter((g) => !Number.isNaN(g.r) && Math.abs(g.r) >= 0.1 && g.n >= 10);
  if (signed.length >= 2 && Math.abs(r) >= 0.1 && signed.every((g) => Math.sign(g.r) !== Math.sign(r))) {
    caveats.push('Within every colour group the relationship runs the other way (Simpson\'s paradox): the overall number mixes groups.');
  } else if (signed.some((g) => g.r > 0) && signed.some((g) => g.r < 0)) {
    caveats.push('The colour groups disagree in direction: look at them separately.');
  }
  if (s.n < 30) caveats.push(`Only ${s.n} records: treat the number with care.`);
  return { headline, explained, caveats };
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The standing reminder for the fuller reading (focus view). */
export const NOT_CAUSE = 'Correlation shows that two measures move together, not that one causes the other.';
