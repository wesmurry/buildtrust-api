// Unit tests for the bottom-up should-cost computation.
//
// MONEY DISCIPLINE: every expected value below is HAND-DERIVED — the
// arithmetic is shown in comments next to each assertion. No expected value
// was produced by running the function under test.

import { describe, expect, it } from 'vitest';
import { computeShouldCost } from '../should-cost.js';
import type {
  BurdenInput,
  LaborUnitInput,
  MarginInput,
  MaterialPriceInput,
  ScopeLineInput,
  ShouldCostInputs,
  WageInput,
} from '../types.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const AS_OF = new Date('2026-01-15T00:00:00.000Z');

function makeInputs(overrides: Partial<ShouldCostInputs> = {}): ShouldCostInputs {
  return {
    tradeCategory: 'framing',
    scopeLines: [],
    laborUnits: new Map<string, LaborUnitInput>(),
    wage: null,
    burden: null,
    materialPrices: new Map<string, MaterialPriceInput>(),
    margin: null,
    marketHeat: null,
    ...overrides,
  };
}

function makeWage(overrides: Partial<WageInput> = {}): WageInput {
  return {
    socCode: '47-2031',
    occupation: 'Carpenters',
    msaCode: '19100',
    msaName: 'Dallas-Fort Worth-Arlington, TX',
    hourlyMedianCents: 2400,
    hourlyP75Cents: 2782,
    source: 'BLS_OEWS',
    sourceRef: 'OEWS May 2025',
    asOf: AS_OF,
    ...overrides,
  };
}

function makeBurden(overrides: Partial<BurdenInput> = {}): BurdenInput {
  return {
    state: 'TX',
    payrollTaxPct: 0.0765,
    workersCompPct: 0.12,
    otherPct: 0.05,
    multiplier: 1.27,
    source: 'NCCI',
    sourceRef: null,
    ...overrides,
  };
}

function makeMargin(overrides: Partial<MarginInput> = {}): MarginInput {
  return {
    tradeCategory: 'framing',
    overheadPctLow: 0.2,
    overheadPctHigh: 0.3,
    netMarginPctLow: 0.05,
    netMarginPctHigh: 0.1,
    basis: null,
    source: 'NAHB_COST_OF_DOING_BUSINESS',
    sourceRef: null,
    ...overrides,
  };
}

function laborLine(overrides: Partial<ScopeLineInput> = {}): ScopeLineInput {
  return {
    id: 'sl-labor-1',
    description: 'Frame exterior walls',
    category: 'LABOR',
    quantity: 480,
    unit: 'LF',
    laborTaskCode: 'FRM-WALL-EXT',
    materialCode: null,
    ...overrides,
  };
}

function materialLine(overrides: Partial<ScopeLineInput> = {}): ScopeLineInput {
  return {
    id: 'sl-mat-1',
    description: 'Framing lumber package',
    category: 'MATERIAL',
    quantity: 38,
    unit: 'MBF',
    laborTaskCode: null,
    materialCode: 'LUM-SPF-2X',
    ...overrides,
  };
}

function laborUnit(overrides: Partial<LaborUnitInput> = {}): LaborUnitInput {
  return {
    taskCode: 'FRM-WALL-EXT',
    description: 'Frame exterior wall, 2x6 @ 16" OC',
    unit: 'LF',
    hoursPerUnit: 0.45,
    source: 'CRAFTSMAN_NCE',
    sourceRef: null,
    ...overrides,
  };
}

function materialPrice(overrides: Partial<MaterialPriceInput> = {}): MaterialPriceInput {
  return {
    itemCode: 'LUM-SPF-2X',
    description: 'SPF dimensional lumber',
    unit: 'MBF',
    unitPriceCents: 16500,
    region: 'TX-N',
    source: 'RANDOM_LENGTHS',
    sourceRef: null,
    asOf: AS_OF,
    ...overrides,
  };
}

/** The fully-priced happy-path inputs used (and perturbed) by several tests. */
function happyPathInputs(overrides: Partial<ShouldCostInputs> = {}): ShouldCostInputs {
  return makeInputs({
    scopeLines: [laborLine(), materialLine()],
    laborUnits: new Map([['FRM-WALL-EXT', laborUnit()]]),
    wage: makeWage(),
    burden: makeBurden(),
    materialPrices: new Map([['LUM-SPF-2X', materialPrice()]]),
    margin: makeMargin(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeShouldCost — happy path (every intermediate hand-derived)', () => {
  // Hand derivation:
  //   hours          = 480 LF x 0.45 hr/LF                    = 216 hr (exact in IEEE-754)
  //   burdenedRate   = round(2782 x 1.27) = round(3533.14)    = 3533 cents/hr
  //   labor cost     = round(216 x 3533)                      = 763128 cents
  //   material cost  = round(38 x 16500)                      = 627000 cents
  //   direct         = 763128 + 627000                        = 1390128 cents
  //   appliedOh      = (0.20 + 0.30) / 2                      = 0.25
  //   appliedNet     = (0.05 + 0.10) / 2                      = 0.075
  //   divisor        = 1 - 0.25 - 0.075                       = 0.675
  //   point          = round(1390128 / 0.675)
  //                  = round(2059448.888...)                  = 2059449 cents
  //   no market heat => x1
  //   band (default ±15%):
  //     low          = round(2059449 x 0.85) = round(1750531.65) = 1750532 cents
  //     high         = round(2059449 x 1.15) = round(2368366.35) = 2368366 cents
  const result = computeShouldCost(happyPathInputs());

  it('is ok with nothing missing', () => {
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('computes the labor layer item exactly', () => {
    expect(result.layers.labor.items).toHaveLength(1);
    const item = result.layers.labor.items[0]!;
    expect(item.scopeLineItemId).toBe('sl-labor-1');
    expect(item.taskCode).toBe('FRM-WALL-EXT');
    expect(item.quantity).toBe(480);
    expect(item.unit).toBe('LF');
    expect(item.hoursPerUnit).toBe(0.45);
    expect(item.hours).toBe(216); // 480 x 0.45
    expect(item.burdenedRateCents).toBe(3533); // round(2782 x 1.27) = round(3533.14)
    expect(item.costCents).toBe(763128); // round(216 x 3533)
  });

  it('computes labor layer totals exactly', () => {
    expect(result.layers.labor.totalHours).toBe(216);
    expect(result.layers.labor.totalCents).toBe(763128);
    expect(result.layers.labor.wage?.hourlyP75Cents).toBe(2782);
    expect(result.layers.labor.burden?.multiplier).toBe(1.27);
  });

  it('computes the material layer exactly', () => {
    expect(result.layers.materials.items).toHaveLength(1);
    const item = result.layers.materials.items[0]!;
    expect(item.scopeLineItemId).toBe('sl-mat-1');
    expect(item.unitPriceCents).toBe(16500);
    expect(item.costCents).toBe(627000); // 38 x 16500
    expect(result.layers.materials.totalCents).toBe(627000);
    expect(result.layers.materials.unpriced).toEqual([]);
  });

  it('computes direct cost = labor + materials', () => {
    expect(result.directCostCents).toBe(1390128); // 763128 + 627000
    expect(result.layers.directCostCents).toBe(1390128);
  });

  it('applies midpoint overhead and net margin', () => {
    expect(result.layers.overheadProfit?.appliedOverheadPct).toBe(0.25); // (0.20+0.30)/2
    // (0.05+0.10)/2 — FP gives 0.07500000000000001, mathematically 0.075
    expect(result.layers.overheadProfit?.appliedNetMarginPct).toBeCloseTo(0.075, 12);
  });

  it('computes the point estimate via the margin divisor', () => {
    expect(result.pointEstimateCents).toBe(2059449); // round(1390128 / 0.675)
  });

  it('computes the default ±15% band exactly', () => {
    expect(result.bandPct).toBe(0.15);
    expect(result.bandLowCents).toBe(1750532); // round(2059449 x 0.85)
    expect(result.bandHighCents).toBe(2368366); // round(2059449 x 1.15)
  });

  it('explains P75 wage choice and band width in assumptions', () => {
    expect(result.assumptions.some((a) => a.includes('75th-percentile'))).toBe(true);
    expect(result.assumptions.some((a) => a.includes('Carpenters'))).toBe(true);
    expect(result.assumptions.some((a) => a.includes('Band width ±15%'))).toBe(true);
    expect(result.assumptions.some((a) => a.includes('AACE 18R-97'))).toBe(true);
  });
});

describe('computeShouldCost — band width selection', () => {
  it('uses the tighter ±10% band for commodity categories (roofing)', () => {
    // Material-only roofing job, margins chosen for round numbers:
    //   direct  = 1 x 80000                                  = 80000 cents
    //   divisor = 1 - 0.10 - 0.10                            = 0.80
    //   point   = round(80000 / 0.80)                        = 100000 cents
    //   low     = round(100000 x 0.90)                       = 90000 cents
    //   high    = round(100000 x 1.10)                       = 110000 cents
    const result = computeShouldCost(
      makeInputs({
        tradeCategory: 'roofing',
        scopeLines: [
          materialLine({ id: 'sl-r1', description: 'Architectural shingles', quantity: 1, unit: 'JOB', materialCode: 'SHINGLE-ARCH' }),
        ],
        materialPrices: new Map([
          ['SHINGLE-ARCH', materialPrice({ itemCode: 'SHINGLE-ARCH', unitPriceCents: 80000 })],
        ]),
        margin: makeMargin({
          tradeCategory: 'roofing',
          overheadPctLow: 0.1,
          overheadPctHigh: 0.1,
          netMarginPctLow: 0.1,
          netMarginPctHigh: 0.1,
        }),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.bandPct).toBe(0.1);
    expect(result.pointEstimateCents).toBe(100000);
    expect(result.bandLowCents).toBe(90000);
    expect(result.bandHighCents).toBe(110000);
    expect(result.assumptions.some((a) => a.includes('Band width ±10%'))).toBe(true);
  });
});

describe('computeShouldCost — market heat', () => {
  it('rounds the point estimate BEFORE applying heat, then bands the heated point', () => {
    // Constructed so the two rounding orders diverge:
    //   direct          = 1 x 62504                          = 62504 cents
    //   divisor         = 1 - 0.25 - 0.125                   = 0.625
    //   unrounded point = 62504 / 0.625                      = 100006.4
    //   rounded point   = round(100006.4)                    = 100006
    //   heated          = round(100006 x 1.08)
    //                   = round(108006.48)                   = 108006   <- code's order
    //   (counterfactual heat-before-round:
    //      round(100006.4 x 1.08) = round(108006.912)        = 108007 — must NOT be this)
    //   band (default ±15%) on the HEATED point:
    //     low  = round(108006 x 0.85) = round(91805.1)       = 91805
    //     high = round(108006 x 1.15) = round(124206.9)      = 124207
    const result = computeShouldCost(
      makeInputs({
        scopeLines: [
          materialLine({ id: 'sl-h1', quantity: 1, unit: 'JOB', materialCode: 'PKG' }),
        ],
        materialPrices: new Map([['PKG', materialPrice({ itemCode: 'PKG', unitPriceCents: 62504 })]]),
        margin: makeMargin({
          overheadPctLow: 0.25,
          overheadPctHigh: 0.25,
          netMarginPctLow: 0.125,
          netMarginPctHigh: 0.125,
        }),
        marketHeat: {
          factor: 1.08,
          basis: 'Sub backlog at 9 weeks vs 5-week norm',
          source: 'ABC_BACKLOG_INDICATOR',
          asOf: AS_OF,
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.pointEstimateCents).toBe(108006); // proves round-then-heat (108007 would mean heat-then-round)
    expect(result.bandLowCents).toBe(91805);
    expect(result.bandHighCents).toBe(124207);
    expect(result.layers.marketHeat?.factor).toBe(1.08);
    expect(result.assumptions.some((a) => a.includes('Market conditions adjustment x1.08'))).toBe(true);
  });
});

describe('computeShouldCost — hard blockers (missing inputs)', () => {
  it('flags missing wage when LABOR lines exist', () => {
    const result = computeShouldCost(happyPathInputs({ wage: null }));
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('wage'))).toBe(true);
    expect(result.layers.labor.wage).toBeNull();
  });

  it('does not flag missing wage when there are no LABOR lines', () => {
    const result = computeShouldCost(
      makeInputs({
        scopeLines: [materialLine()],
        materialPrices: new Map([['LUM-SPF-2X', materialPrice()]]),
        margin: makeMargin(),
        wage: null,
      }),
    );
    expect(result.missing.some((m) => m.includes('wage'))).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('flags missing margin and yields a zero band', () => {
    const result = computeShouldCost(happyPathInputs({ margin: null }));
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('overhead/profit'))).toBe(true);
    expect(result.layers.overheadProfit).toBeNull();
    // With no margin the point estimate is never computed: 0, band edges 0.
    expect(result.pointEstimateCents).toBe(0);
    expect(result.bandLowCents).toBe(0);
    expect(result.bandHighCents).toBe(0);
  });

  it('flags an empty scope sheet', () => {
    const result = computeShouldCost(makeInputs({ margin: makeMargin() }));
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('No scope line items'))).toBe(true);
    expect(result.directCostCents).toBe(0);
  });

  it('rejects margin norms summing to >= 100% as invalid reference data', () => {
    // appliedOh = (0.6+0.6)/2 = 0.6; appliedNet = (0.5+0.5)/2 = 0.5
    // divisor = 1 - 0.6 - 0.5 = -0.1 <= 0 -> invalid, no point estimate
    const result = computeShouldCost(
      happyPathInputs({
        margin: makeMargin({
          overheadPctLow: 0.6,
          overheadPctHigh: 0.6,
          netMarginPctLow: 0.5,
          netMarginPctHigh: 0.5,
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('invalid'))).toBe(true);
    expect(result.pointEstimateCents).toBe(0);
    expect(result.bandLowCents).toBe(0);
    expect(result.bandHighCents).toBe(0);
    // Direct cost is still reported — only the markup layer is refused.
    expect(result.directCostCents).toBe(1390128);
  });
});

describe('computeShouldCost — burden fallback', () => {
  it('applies a generic 1.40x multiplier when burden is null, with an assumption', () => {
    // burdenedRate = round(2500 x 1.40) = round(3500) = 3500 cents/hr
    // hours        = 10 x 1.0           = 10 hr
    // labor cost   = round(10 x 3500)   = 35000 cents
    const result = computeShouldCost(
      makeInputs({
        scopeLines: [laborLine({ quantity: 10, laborTaskCode: 'T1' })],
        laborUnits: new Map([['T1', laborUnit({ taskCode: 'T1', hoursPerUnit: 1.0 })]]),
        wage: makeWage({ hourlyP75Cents: 2500 }),
        burden: null,
        margin: makeMargin(),
      }),
    );

    expect(result.layers.labor.items[0]?.burdenedRateCents).toBe(3500);
    expect(result.layers.labor.items[0]?.costCents).toBe(35000);
    expect(result.layers.labor.burden).toBeNull();
    expect(result.assumptions.some((a) => a.includes('generic 1.40x labor burden'))).toBe(true);
  });
});

describe('computeShouldCost — unpriced materials', () => {
  it('excludes unpriced lines from totals, surfaces them, and notes the assumption', () => {
    const result = computeShouldCost(
      makeInputs({
        scopeLines: [
          materialLine(), // priced: 38 x 16500 = 627000
          materialLine({ id: 'sl-mat-2', description: 'Custom steel brackets', materialCode: 'STL-BRKT' }), // code with no price entry
          materialLine({ id: 'sl-mat-3', description: 'Misc fasteners', materialCode: null }), // null code
        ],
        materialPrices: new Map([['LUM-SPF-2X', materialPrice()]]),
        margin: makeMargin(),
      }),
    );

    // Only the priced line contributes.
    expect(result.layers.materials.items).toHaveLength(1);
    expect(result.layers.materials.totalCents).toBe(627000);
    expect(result.layers.materials.unpriced).toEqual([
      { scopeLineItemId: 'sl-mat-2', description: 'Custom steel brackets' },
      { scopeLineItemId: 'sl-mat-3', description: 'Misc fasteners' },
    ]);
    const note = result.assumptions.find((a) => a.includes('could not be priced'));
    expect(note).toBeDefined();
    expect(note).toContain('EXCLUDED');
    expect(note).toContain('"Custom steel brackets"');
    expect(note).toContain('"Misc fasteners"');
    // Unpriced materials are an assumption, not a hard blocker: still ok.
    expect(result.ok).toBe(true);
  });
});

describe('computeShouldCost — labor task code problems', () => {
  it('skips a labor line with an unknown task code and records it as missing', () => {
    const result = computeShouldCost(
      happyPathInputs({
        scopeLines: [
          laborLine(), // valid: FRM-WALL-EXT
          laborLine({ id: 'sl-labor-2', description: 'Set trusses', laborTaskCode: 'NOPE-404' }),
          materialLine(),
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('No labor unit data for task NOPE-404'))).toBe(true);
    // Only the valid line is priced; the unknown one contributes nothing.
    expect(result.layers.labor.items).toHaveLength(1);
    expect(result.layers.labor.items[0]?.scopeLineItemId).toBe('sl-labor-1');
    expect(result.layers.labor.totalHours).toBe(216);
    expect(result.layers.labor.totalCents).toBe(763128);
  });

  it('flags a labor line with no task code at all', () => {
    const result = computeShouldCost(
      happyPathInputs({
        scopeLines: [laborLine({ laborTaskCode: null }), materialLine()],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('has no labor task code'))).toBe(true);
    expect(result.layers.labor.items).toHaveLength(0);
  });
});

describe('computeShouldCost — Math.round (round-half-up) semantics on money boundaries', () => {
  it('rounds exact .5 cent values up at the rate and line boundaries (not banker’s rounding)', () => {
    // All factors chosen to be exact in binary floating point so the .5 is exact:
    //   burdenedRate = round(2002 x 1.25) = round(2502.5)  = 2503  (banker's would give 2502)
    //   hours        = 7 x 0.5            = 3.5             (0.5 is exact in binary)
    //   labor cost   = round(3.5 x 2503)  = round(8760.5)  = 8761  (banker's would give 8760)
    //   material     = round(2.5 x 101)   = round(252.5)   = 253   (banker's would give 252)
    //   direct       = 8761 + 253                          = 9014
    //   divisor      = 1 - 0 - 0 = 1 -> point = 9014
    //   band ±15%: low = round(9014 x 0.85) = round(7661.9)  = 7662
    //              high = round(9014 x 1.15) = round(10366.1) = 10366
    const result = computeShouldCost(
      makeInputs({
        scopeLines: [
          laborLine({ quantity: 7, laborTaskCode: 'T-HALF' }),
          materialLine({ id: 'sl-m-half', quantity: 2.5, materialCode: 'M-HALF' }),
        ],
        laborUnits: new Map([['T-HALF', laborUnit({ taskCode: 'T-HALF', hoursPerUnit: 0.5 })]]),
        wage: makeWage({ hourlyP75Cents: 2002 }),
        burden: makeBurden({ multiplier: 1.25 }),
        materialPrices: new Map([['M-HALF', materialPrice({ itemCode: 'M-HALF', unitPriceCents: 101 })]]),
        margin: makeMargin({
          overheadPctLow: 0,
          overheadPctHigh: 0,
          netMarginPctLow: 0,
          netMarginPctHigh: 0,
        }),
      }),
    );

    expect(result.layers.labor.items[0]?.burdenedRateCents).toBe(2503); // 2502.5 rounds UP
    expect(result.layers.labor.items[0]?.hours).toBe(3.5);
    expect(result.layers.labor.items[0]?.costCents).toBe(8761); // 8760.5 rounds UP
    expect(result.layers.materials.items[0]?.costCents).toBe(253); // 252.5 rounds UP
    expect(result.directCostCents).toBe(9014);
    expect(result.pointEstimateCents).toBe(9014);
    expect(result.bandLowCents).toBe(7662);
    expect(result.bandHighCents).toBe(10366);
  });
});
