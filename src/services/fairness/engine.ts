// Fairness engine orchestration: load inputs, run the pure modules, persist
// an auditable FairPriceAssessment row.
//
// Layer separation rule: this module only ever reads bottom-up reference
// tables (LaborUnit, WageRate, BurdenFactor, TradeMarginNorm,
// MaterialPriceRef, MarketHeatFactor). PLATFORM_OBSERVED data must never be
// joined into these inputs — when platform benchmarks ship, they get their own
// layer displayed alongside, not blended in.

import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { computeShouldCost } from './should-cost.js';
import { evaluateScopeGate } from './scope-gate.js';
import { classifyVerdict, verdictNarrative } from './verdict.js';
import {
  CATEGORY_TO_SOC,
  ENGINE_VERSION,
  FALLBACK_SOC,
  type LaborUnitInput,
  type MaterialPriceInput,
  type ScopeGateBidLine,
  type ShouldCostInputs,
  type WageInput,
} from './types.js';

interface Locale {
  msaCode: string;
  msaName: string;
  state: string;
  assumption?: string;
}

/**
 * Resolve a project's metro + state from its address.
 * v1: pattern matching on the address string with an explicit assumption when
 * we fall back. A proper geocoding step replaces this later.
 */
export function resolveLocale(address: string): Locale {
  const a = address.toLowerCase();
  if (a.includes('austin') || (a.includes(' tx') && a.includes('787'))) {
    return { msaCode: '12420', msaName: 'Austin-Round Rock-San Marcos, TX', state: 'TX' };
  }
  return {
    msaCode: '12420',
    msaName: 'Austin-Round Rock-San Marcos, TX',
    state: 'TX',
    assumption:
      'Project metro could not be resolved from the address — defaulted to Austin-Round Rock, TX. Verify before relying on local wage data.',
  };
}

async function loadWage(tradeCategory: string, locale: Locale): Promise<WageInput | null> {
  const mapped = CATEGORY_TO_SOC[tradeCategory] ?? FALLBACK_SOC;

  const findLatest = (socCode: string) =>
    prisma.wageRate.findFirst({
      where: { msaCode: locale.msaCode, socCode },
      orderBy: { asOf: 'desc' },
    });

  let row = await findLatest(mapped.socCode);
  let fallbackNote: string | undefined;

  if (!row && mapped.socCode !== FALLBACK_SOC.socCode) {
    row = await findLatest(FALLBACK_SOC.socCode);
    if (row) {
      fallbackNote =
        `No local wage series exists for ${mapped.occupation} (${mapped.socCode}) in ${locale.msaName} — ` +
        `fell back to ${FALLBACK_SOC.occupation} (${FALLBACK_SOC.socCode}). This likely understates the rate.`;
    }
  }
  if (!row) return null;

  return {
    socCode: row.socCode,
    occupation: row.occupation,
    msaCode: row.msaCode,
    msaName: row.msaName,
    hourlyMedianCents: row.hourlyMedianCents,
    hourlyP75Cents: row.hourlyP75Cents,
    source: row.source,
    sourceRef: row.sourceRef,
    asOf: row.asOf,
    fallbackNote,
  };
}

export async function buildShouldCostInputs(tradeId: string): Promise<{
  inputs: ShouldCostInputs;
  localeAssumption?: string;
}> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { project: true, scopeLineItems: { orderBy: { displayOrder: 'asc' } } },
  });
  if (!trade) throw new NotFoundError('Trade', tradeId);

  const locale = resolveLocale(trade.project.address);

  const taskCodes = trade.scopeLineItems
    .map((l) => l.laborTaskCode)
    .filter((c): c is string => !!c);
  const materialCodes = trade.scopeLineItems
    .map((l) => l.materialCode)
    .filter((c): c is string => !!c);

  const [laborUnitRows, materialRows, burdenRow, marginRow, heatRow, wage] = await Promise.all([
    prisma.laborUnit.findMany({ where: { taskCode: { in: taskCodes } } }),
    prisma.materialPriceRef.findMany({
      where: { itemCode: { in: materialCodes }, region: { in: [locale.msaCode, 'US'] } },
      orderBy: { asOf: 'desc' },
    }),
    prisma.burdenFactor.findUnique({
      where: { state_tradeCategory: { state: locale.state, tradeCategory: trade.category } },
    }),
    prisma.tradeMarginNorm.findUnique({ where: { tradeCategory: trade.category } }),
    prisma.marketHeatFactor.findFirst({
      where: { msaCode: locale.msaCode, tradeCategory: trade.category },
      orderBy: { asOf: 'desc' },
    }),
    loadWage(trade.category, locale),
  ]);

  const laborUnits = new Map<string, LaborUnitInput>(
    laborUnitRows.map((r) => [
      r.taskCode,
      {
        taskCode: r.taskCode,
        description: r.description,
        unit: r.unit,
        hoursPerUnit: r.hoursPerUnit,
        source: r.source,
        sourceRef: r.sourceRef,
        conditions: r.conditions,
      },
    ]),
  );

  // Prefer metro-priced rows over national; rows are sorted newest-first.
  const materialPrices = new Map<string, MaterialPriceInput>();
  for (const r of materialRows) {
    const existing = materialPrices.get(r.itemCode);
    if (existing && existing.region === locale.msaCode) continue;
    if (!existing || r.region === locale.msaCode) {
      materialPrices.set(r.itemCode, {
        itemCode: r.itemCode,
        description: r.description,
        unit: r.unit,
        unitPriceCents: r.unitPriceCents,
        region: r.region,
        source: r.source,
        sourceRef: r.sourceRef,
        asOf: r.asOf,
      });
    }
  }

  return {
    inputs: {
      tradeCategory: trade.category,
      scopeLines: trade.scopeLineItems.map((l) => ({
        id: l.id,
        description: l.description,
        category: l.category,
        quantity: l.quantity,
        unit: l.unit,
        laborTaskCode: l.laborTaskCode,
        materialCode: l.materialCode,
      })),
      laborUnits,
      wage,
      burden: burdenRow
        ? {
            state: burdenRow.state,
            payrollTaxPct: burdenRow.payrollTaxPct,
            workersCompPct: burdenRow.workersCompPct,
            otherPct: burdenRow.otherPct,
            multiplier: burdenRow.multiplier,
            source: burdenRow.source,
            sourceRef: burdenRow.sourceRef,
          }
        : null,
      materialPrices,
      margin: marginRow
        ? {
            tradeCategory: marginRow.tradeCategory,
            overheadPctLow: marginRow.overheadPctLow,
            overheadPctHigh: marginRow.overheadPctHigh,
            netMarginPctLow: marginRow.netMarginPctLow,
            netMarginPctHigh: marginRow.netMarginPctHigh,
            basis: marginRow.basis,
            source: marginRow.source,
            sourceRef: marginRow.sourceRef,
          }
        : null,
      marketHeat: heatRow
        ? { factor: heatRow.factor, basis: heatRow.basis, source: heatRow.source, asOf: heatRow.asOf }
        : null,
    },
    localeAssumption: locale.assumption,
  };
}

/**
 * Compute and persist a fair-price assessment for a trade, optionally judged
 * against a specific bid. Always creates a new row — assessments are an audit
 * trail, not mutable state.
 */
export async function computeAssessment(tradeId: string, bidId?: string) {
  const { inputs, localeAssumption } = await buildShouldCostInputs(tradeId);
  const result = computeShouldCost(inputs);

  const assumptions = [...result.assumptions];
  if (localeAssumption) assumptions.unshift(localeAssumption);

  let gate: ReturnType<typeof evaluateScopeGate> | null = null;
  let verdict: ReturnType<typeof classifyVerdict> | null = null;
  let narrative: string | null = null;
  let bidTotalCents: number | null = null;

  if (bidId) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { lineItems: true },
    });
    if (!bid) throw new NotFoundError('Bid', bidId);
    if (bid.tradeId !== tradeId) {
      throw new NotFoundError('Bid for this trade', bidId);
    }

    const gateBidLines: ScopeGateBidLine[] = bid.lineItems.map((l) => ({
      id: l.id,
      scopeLineItemId: l.scopeLineItemId,
      kind: l.kind,
      description: l.description,
      totalCents: l.totalCents,
    }));
    gate = evaluateScopeGate(
      inputs.scopeLines.map((s) => ({ id: s.id, description: s.description })),
      gateBidLines,
    );

    // Legacy Bid.totalAmount is Float dollars; convert once, at the boundary.
    bidTotalCents = Math.round((bid.totalAmount ?? 0) * 100);

    if (gate.passed && result.ok && bidTotalCents > 0) {
      verdict = classifyVerdict(bidTotalCents, result.bandLowCents, result.bandHighCents);
      narrative = verdictNarrative(verdict, bidTotalCents, result.bandLowCents, result.bandHighCents);
    }
  }

  const status = bidId && gate && !gate.passed ? 'BLOCKED_SCOPE_GATE' : 'DRAFT';

  const assessment = await prisma.fairPriceAssessment.create({
    data: {
      tradeId,
      bidId: bidId ?? null,
      status,
      scopeGate: gate ? JSON.parse(JSON.stringify(gate)) : { passed: true, reasons: [], note: 'Trade-level band; no bid attached.' },
      bandLowCents: result.bandLowCents,
      bandHighCents: result.bandHighCents,
      pointEstimateCents: result.pointEstimateCents,
      bandPct: result.bandPct,
      verdict,
      layers: JSON.parse(
        JSON.stringify({
          ...result.layers,
          bidTotalCents,
          narrative,
          missing: result.missing,
        }),
      ),
      assumptions,
      marketHeatFactor: inputs.marketHeat?.factor ?? 1,
      engineVersion: ENGINE_VERSION,
      computedAt: new Date(),
    },
  });

  return assessment;
}
