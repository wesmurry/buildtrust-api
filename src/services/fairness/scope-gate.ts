// Scope-leveling gate.
//
// Most bid spread is scope difference, not price difference — so no fairness
// verdict may be rendered until the bid has been leveled against the scope
// sheet. This module decides whether a bid clears that bar.

import {
  SCOPE_COVERAGE_THRESHOLD,
  type ScopeGateBidLine,
  type ScopeGateResult,
} from './types.js';

export function evaluateScopeGate(
  scopeLines: { id: string; description: string }[],
  bidLines: ScopeGateBidLine[],
): ScopeGateResult {
  const reasons: string[] = [];

  const inclusionLines = bidLines.filter((l) => l.kind === 'INCLUSION' || l.kind === 'ALLOWANCE');
  if (bidLines.length === 0) {
    return {
      passed: false,
      coveragePct: 0,
      matchedScopeLineIds: [],
      unmatchedScopeLines: scopeLines,
      exclusionConflicts: [],
      unmatchedBidLines: [],
      reasons: ['Bid has not been leveled: no line items exist (lump-sum bids must be parsed or entered first).'],
    };
  }

  const matchedScopeLineIds = [
    ...new Set(
      inclusionLines
        .map((l) => l.scopeLineItemId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ].filter((id) => scopeLines.some((s) => s.id === id));

  const unmatchedScopeLines = scopeLines.filter((s) => !matchedScopeLineIds.includes(s.id));

  const coveragePct = scopeLines.length === 0 ? 0 : matchedScopeLineIds.length / scopeLines.length;

  // A bid EXCLUSION that points at a scope line is a direct leveling conflict:
  // the sub is explicitly not pricing something the scope requires.
  const exclusionConflicts = bidLines
    .filter((l) => l.kind === 'EXCLUSION' && l.scopeLineItemId)
    .filter((l) => scopeLines.some((s) => s.id === l.scopeLineItemId))
    .map((l) => ({
      bidLineId: l.id,
      description: l.description,
      scopeLineItemId: l.scopeLineItemId as string,
    }));

  const unmatchedBidLines = bidLines
    .filter((l) => l.kind === 'INCLUSION' && !l.scopeLineItemId)
    .map((l) => ({ bidLineId: l.id, description: l.description, totalCents: l.totalCents }));

  if (scopeLines.length === 0) {
    reasons.push('No scope sheet exists for this trade — define scope line items first.');
  }
  if (coveragePct < SCOPE_COVERAGE_THRESHOLD) {
    reasons.push(
      `Bid addresses ${(coveragePct * 100).toFixed(0)}% of scope lines (minimum ${SCOPE_COVERAGE_THRESHOLD * 100}%). ` +
        `Unaddressed: ${unmatchedScopeLines.map((s) => `"${s.description}"`).join(', ')}.`,
    );
  }
  for (const c of exclusionConflicts) {
    reasons.push(`Bid explicitly excludes in-scope work: "${c.description}". Resolve the exclusion before comparing prices.`);
  }

  const passed = scopeLines.length > 0 && coveragePct >= SCOPE_COVERAGE_THRESHOLD && exclusionConflicts.length === 0;

  return {
    passed,
    coveragePct,
    matchedScopeLineIds,
    unmatchedScopeLines,
    exclusionConflicts,
    unmatchedBidLines,
    reasons,
  };
}
