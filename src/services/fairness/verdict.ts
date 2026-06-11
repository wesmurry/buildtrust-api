// Verdict classification — deliberately three coarse zones, never a score.
//
// BELOW_RANGE is not "great deal": it is a scope-coverage warning for the
// homeowner. ABOVE_RANGE is not "overcharging": it is a conversation with the
// drivers attached. The language matters as much as the math.

import type { VerdictZone } from './types.js';

export function classifyVerdict(
  bidTotalCents: number,
  bandLowCents: number,
  bandHighCents: number,
): VerdictZone {
  if (bidTotalCents > bandHighCents) return 'ABOVE_RANGE';
  if (bidTotalCents < bandLowCents) return 'BELOW_RANGE';
  return 'WITHIN_RANGE';
}

export function verdictNarrative(
  verdict: VerdictZone,
  bidTotalCents: number,
  bandLowCents: number,
  bandHighCents: number,
): string {
  const fmt = (c: number) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  switch (verdict) {
    case 'WITHIN_RANGE':
      return `This bid (${fmt(bidTotalCents)}) is within the expected range of ${fmt(bandLowCents)}–${fmt(bandHighCents)} for this scope in your market.`;
    case 'ABOVE_RANGE': {
      const overPct = ((bidTotalCents - bandHighCents) / bandHighCents) * 100;
      return `This bid (${fmt(bidTotalCents)}) is ${overPct.toFixed(0)}% above the top of the expected range (${fmt(bandLowCents)}–${fmt(bandHighCents)}). That is not proof of overcharging — review the line items driving the difference with your builder.`;
    }
    case 'BELOW_RANGE': {
      const underPct = ((bandLowCents - bidTotalCents) / bandLowCents) * 100;
      return `This bid (${fmt(bidTotalCents)}) is ${underPct.toFixed(0)}% below the bottom of the expected range (${fmt(bandLowCents)}–${fmt(bandHighCents)}). A low bid can signal missing scope — verify coverage before treating it as savings.`;
    }
  }
}
