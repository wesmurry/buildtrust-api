// Unit tests for verdict classification and narrative.
//
// All percentages and dollar strings are hand-derived (arithmetic in
// comments); none were produced by running the function under test.

import { describe, expect, it } from 'vitest';
import { classifyVerdict, verdictNarrative } from '../verdict.js';

describe('classifyVerdict — three zones, inclusive boundaries', () => {
  const LOW = 900000; // $9,000
  const HIGH = 1000000; // $10,000

  it('classifies strictly above the high edge as ABOVE_RANGE', () => {
    expect(classifyVerdict(HIGH + 1, LOW, HIGH)).toBe('ABOVE_RANGE'); // 1000001 > 1000000
  });

  it('classifies strictly below the low edge as BELOW_RANGE', () => {
    expect(classifyVerdict(LOW - 1, LOW, HIGH)).toBe('BELOW_RANGE'); // 899999 < 900000
  });

  it('classifies a bid exactly at the low edge as WITHIN_RANGE (boundary inclusive)', () => {
    expect(classifyVerdict(LOW, LOW, HIGH)).toBe('WITHIN_RANGE');
  });

  it('classifies a bid exactly at the high edge as WITHIN_RANGE (boundary inclusive)', () => {
    expect(classifyVerdict(HIGH, LOW, HIGH)).toBe('WITHIN_RANGE');
  });

  it('classifies a mid-band bid as WITHIN_RANGE', () => {
    expect(classifyVerdict(950000, LOW, HIGH)).toBe('WITHIN_RANGE');
  });
});

describe('verdictNarrative — WITHIN_RANGE', () => {
  it('formats cents as whole dollars and includes both band figures', () => {
    // 4200000 cents = $42,000; 5800000 cents = $58,000; 5000000 cents = $50,000
    const text = verdictNarrative('WITHIN_RANGE', 5000000, 4200000, 5800000);

    expect(text).toContain('$50,000');
    expect(text).toContain('$42,000');
    expect(text).toContain('$58,000');
    expect(text).toContain('within the expected range');
    // No decimal places on money anywhere in the narrative.
    expect(text).not.toMatch(/\$[\d,]+\.\d/);
  });
});

describe('verdictNarrative — ABOVE_RANGE', () => {
  it('includes the percent over the top of the band', () => {
    // bid 11500 cents ($115) vs high 10000 cents ($100):
    //   overPct = (11500 - 10000) / 10000 x 100 = 15 -> "15%"
    const text = verdictNarrative('ABOVE_RANGE', 11500, 8500, 10000);

    expect(text).toContain('15% above the top');
    expect(text).toContain('$115');
    expect(text).toContain('$85');
    expect(text).toContain('$100');
    // Tone guard: above-range is a conversation, not an accusation.
    expect(text).toContain('not proof of overcharging');
  });

  it('rounds the over-percentage to whole percent', () => {
    // bid 1093000 vs high 1000000: over = 93000/1000000 = 9.3% -> "9%"
    const text = verdictNarrative('ABOVE_RANGE', 1093000, 850000, 1000000);
    expect(text).toContain('9% above the top');
  });
});

describe('verdictNarrative — BELOW_RANGE', () => {
  it('includes the percent under the bottom and the scope-gap caution', () => {
    // bid 8000 cents ($80) vs low 10000 cents ($100):
    //   underPct = (10000 - 8000) / 10000 x 100 = 20 -> "20%"
    const text = verdictNarrative('BELOW_RANGE', 8000, 10000, 12000);

    expect(text).toContain('20% below the bottom');
    expect(text).toContain('$80');
    expect(text).toContain('$100');
    expect(text).toContain('$120');
    // BELOW_RANGE is a warning, not a win.
    expect(text).toContain('verify coverage');
    expect(text).toContain('missing scope');
  });

  it('computes the under-percentage against the LOW edge', () => {
    // bid 4500000 vs low 5000000: under = 500000/5000000 = 10% -> "10%"
    const text = verdictNarrative('BELOW_RANGE', 4500000, 5000000, 6000000);
    expect(text).toContain('10% below the bottom');
    expect(text).toContain('$45,000');
    expect(text).toContain('$50,000');
  });
});
