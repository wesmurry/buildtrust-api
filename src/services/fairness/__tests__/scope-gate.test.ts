// Unit tests for the scope-leveling gate.
//
// Coverage percentages are hand-derived (shown in comments); none were
// produced by running the function under test.

import { describe, expect, it } from 'vitest';
import { evaluateScopeGate } from '../scope-gate.js';
import type { ScopeGateBidLine } from '../types.js';

function scope(id: string, description = `Scope ${id}`): { id: string; description: string } {
  return { id, description };
}

function bid(overrides: Partial<ScopeGateBidLine> & { id: string }): ScopeGateBidLine {
  return {
    scopeLineItemId: null,
    kind: 'INCLUSION',
    description: `Bid line ${overrides.id}`,
    totalCents: 10000,
    ...overrides,
  };
}

describe('evaluateScopeGate — no bid lines', () => {
  it('fails immediately with a lump-sum/parsing reason and zero coverage', () => {
    const scopeLines = [scope('s1', 'Tear off'), scope('s2', 'Install underlayment')];
    const result = evaluateScopeGate(scopeLines, []);

    expect(result.passed).toBe(false);
    expect(result.coveragePct).toBe(0);
    expect(result.matchedScopeLineIds).toEqual([]);
    expect(result.unmatchedScopeLines).toEqual(scopeLines);
    expect(result.exclusionConflicts).toEqual([]);
    expect(result.unmatchedBidLines).toEqual([]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('lump-sum');
    expect(result.reasons[0]).toContain('no line items');
  });
});

describe('evaluateScopeGate — coverage threshold (0.8, inclusive)', () => {
  const fiveScopeLines = [
    scope('s1', 'Tear off existing roof'),
    scope('s2', 'Install ice & water shield'),
    scope('s3', 'Install architectural shingles'),
    scope('s4', 'Replace flashing'),
    scope('s5', 'Install drip edge'),
  ];

  it('passes at exactly the threshold: 4 of 5 matched = 0.8 >= 0.8', () => {
    const result = evaluateScopeGate(fiveScopeLines, [
      bid({ id: 'b1', scopeLineItemId: 's1' }),
      bid({ id: 'b2', scopeLineItemId: 's2' }),
      bid({ id: 'b3', scopeLineItemId: 's3' }),
      bid({ id: 'b4', scopeLineItemId: 's4' }),
    ]);

    expect(result.coveragePct).toBe(0.8); // 4 / 5
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.matchedScopeLineIds).toEqual(['s1', 's2', 's3', 's4']);
    expect(result.unmatchedScopeLines).toEqual([scope('s5', 'Install drip edge')]);
  });

  it('fails below the threshold: 3 of 5 = 0.6, reason lists unmatched descriptions', () => {
    const result = evaluateScopeGate(fiveScopeLines, [
      bid({ id: 'b1', scopeLineItemId: 's1' }),
      bid({ id: 'b2', scopeLineItemId: 's2' }),
      bid({ id: 'b3', scopeLineItemId: 's3' }),
    ]);

    expect(result.coveragePct).toBe(0.6); // 3 / 5
    expect(result.passed).toBe(false);
    const coverageReason = result.reasons.find((r) => r.includes('60%'));
    expect(coverageReason).toBeDefined();
    expect(coverageReason).toContain('"Replace flashing"');
    expect(coverageReason).toContain('"Install drip edge"');
  });
});

describe('evaluateScopeGate — matching rules', () => {
  it('counts duplicate matches to the same scope line only once', () => {
    const result = evaluateScopeGate(
      [scope('s1'), scope('s2')],
      [
        bid({ id: 'b1', scopeLineItemId: 's1' }),
        bid({ id: 'b2', scopeLineItemId: 's1' }), // duplicate — must not double-count
      ],
    );

    expect(result.matchedScopeLineIds).toEqual(['s1']);
    expect(result.coveragePct).toBe(0.5); // 1 / 2, NOT 2 / 2
    expect(result.passed).toBe(false);
  });

  it('ignores bid lines pointing at scope ids that are not in the scope set', () => {
    const result = evaluateScopeGate(
      [scope('s1'), scope('s2')],
      [
        bid({ id: 'b1', scopeLineItemId: 's1' }),
        bid({ id: 'b2', scopeLineItemId: 'ghost-id' }), // not a real scope line
      ],
    );

    expect(result.matchedScopeLineIds).toEqual(['s1']);
    expect(result.coveragePct).toBe(0.5); // ghost match contributes nothing
    expect(result.passed).toBe(false);
    // Documented actual behavior: a ghost-matched INCLUSION has a (stale) id set,
    // so it does NOT appear in unmatchedBidLines (that list is only for null-id inclusions).
    expect(result.unmatchedBidLines).toEqual([]);
  });
});

describe('evaluateScopeGate — exclusions', () => {
  it('fails on an EXCLUSION targeting an in-scope line, even at 100% coverage', () => {
    const result = evaluateScopeGate(
      [scope('s1', 'Replace step flashing')],
      [
        bid({ id: 'b1', scopeLineItemId: 's1' }), // coverage = 1/1 = 1.0
        bid({ id: 'b2', kind: 'EXCLUSION', scopeLineItemId: 's1', description: 'Flashing excluded — reuse existing' }),
      ],
    );

    expect(result.coveragePct).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.exclusionConflicts).toEqual([
      { bidLineId: 'b2', description: 'Flashing excluded — reuse existing', scopeLineItemId: 's1' },
    ]);
    expect(result.reasons.some((r) => r.includes('Flashing excluded — reuse existing'))).toBe(true);
  });

  it('treats an EXCLUSION with null scopeLineItemId as informational, not a conflict', () => {
    const result = evaluateScopeGate(
      [scope('s1')],
      [
        bid({ id: 'b1', scopeLineItemId: 's1' }),
        bid({ id: 'b2', kind: 'EXCLUSION', scopeLineItemId: null, description: 'Permits by others' }),
      ],
    );

    expect(result.exclusionConflicts).toEqual([]);
    expect(result.passed).toBe(true); // coverage 1/1, no conflicts
    expect(result.reasons).toEqual([]);
  });
});

describe('evaluateScopeGate — unmatched bid lines and allowances', () => {
  it('reports an INCLUSION with null scopeLineItemId as an unmatched (extra) bid line', () => {
    const result = evaluateScopeGate(
      [scope('s1')],
      [
        bid({ id: 'b1', scopeLineItemId: 's1' }),
        bid({ id: 'b2', scopeLineItemId: null, description: 'Dumpster rental', totalCents: 45000 }),
      ],
    );

    expect(result.unmatchedBidLines).toEqual([
      { bidLineId: 'b2', description: 'Dumpster rental', totalCents: 45000 },
    ]);
    // Extras are informational — they do not block passing.
    expect(result.coveragePct).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('counts ALLOWANCE lines toward coverage, but not ALTERNATE lines', () => {
    const result = evaluateScopeGate(
      [scope('s1'), scope('s2')],
      [
        bid({ id: 'b1', kind: 'ALLOWANCE', scopeLineItemId: 's1' }),
        bid({ id: 'b2', kind: 'ALLOWANCE', scopeLineItemId: 's2' }),
      ],
    );
    expect(result.coveragePct).toBe(1); // 2 / 2 — allowances count
    expect(result.passed).toBe(true);

    const alt = evaluateScopeGate(
      [scope('s1'), scope('s2')],
      [
        bid({ id: 'b1', kind: 'INCLUSION', scopeLineItemId: 's1' }),
        bid({ id: 'b2', kind: 'ALTERNATE', scopeLineItemId: 's2' }), // alternates are not base-bid coverage
      ],
    );
    expect(alt.coveragePct).toBe(0.5); // 1 / 2
    expect(alt.passed).toBe(false);
  });
});

describe('evaluateScopeGate — empty scope sheet', () => {
  it('fails with a "No scope sheet" reason when scope is empty but bid lines exist', () => {
    const result = evaluateScopeGate([], [bid({ id: 'b1', scopeLineItemId: null })]);

    expect(result.passed).toBe(false);
    expect(result.coveragePct).toBe(0);
    expect(result.matchedScopeLineIds).toEqual([]);
    expect(result.unmatchedScopeLines).toEqual([]);
    expect(result.reasons.some((r) => r.includes('No scope sheet'))).toBe(true);
  });
});
