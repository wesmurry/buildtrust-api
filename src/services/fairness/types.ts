// Fairness engine — shared types.
//
// Money discipline: every monetary value in this module is integer CENTS.
// Floats are permitted only for quantities, hours, and percentages.

export interface ScopeLineInput {
  id: string;
  description: string;
  category: 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'ALLOWANCE' | 'GENERAL';
  quantity: number;
  unit: string;
  laborTaskCode?: string | null;
  materialCode?: string | null;
}

export interface LaborUnitInput {
  taskCode: string;
  description: string;
  unit: string;
  hoursPerUnit: number;
  source: string;
  sourceRef?: string | null;
  conditions?: string | null;
}

export interface WageInput {
  socCode: string;
  occupation: string;
  msaCode: string;
  msaName: string;
  hourlyMedianCents: number;
  hourlyP75Cents: number;
  source: string;
  sourceRef?: string | null;
  asOf: Date;
  /** Set when the trade's mapped occupation had no local data and a fallback SOC was used. */
  fallbackNote?: string;
}

export interface BurdenInput {
  state: string;
  payrollTaxPct: number;
  workersCompPct: number;
  otherPct: number;
  multiplier: number;
  source: string;
  sourceRef?: string | null;
}

export interface MaterialPriceInput {
  itemCode: string;
  description: string;
  unit: string;
  unitPriceCents: number;
  region: string;
  source: string;
  sourceRef?: string | null;
  asOf: Date;
}

export interface MarginInput {
  tradeCategory: string;
  overheadPctLow: number;
  overheadPctHigh: number;
  netMarginPctLow: number;
  netMarginPctHigh: number;
  basis?: string | null;
  source: string;
  sourceRef?: string | null;
}

export interface MarketHeatInput {
  factor: number;
  basis: string;
  source: string;
  asOf: Date;
}

export interface ShouldCostInputs {
  tradeCategory: string;
  scopeLines: ScopeLineInput[];
  laborUnits: Map<string, LaborUnitInput>;
  wage: WageInput | null;
  burden: BurdenInput | null;
  materialPrices: Map<string, MaterialPriceInput>;
  margin: MarginInput | null;
  marketHeat: MarketHeatInput | null;
}

export interface LaborLayerItem {
  scopeLineItemId: string;
  description: string;
  taskCode: string;
  quantity: number;
  unit: string;
  hoursPerUnit: number;
  hours: number;
  burdenedRateCents: number;
  costCents: number;
  source: string;
  sourceRef?: string | null;
}

export interface MaterialLayerItem {
  scopeLineItemId: string;
  description: string;
  itemCode: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  costCents: number;
  source: string;
  sourceRef?: string | null;
  asOf: string;
}

export interface ShouldCostLayers {
  labor: {
    items: LaborLayerItem[];
    totalHours: number;
    totalCents: number;
    wage: {
      socCode: string;
      occupation: string;
      msaName: string;
      hourlyP75Cents: number;
      source: string;
      sourceRef?: string | null;
      asOf: string;
      fallbackNote?: string;
    } | null;
    burden: {
      multiplier: number;
      payrollTaxPct: number;
      workersCompPct: number;
      source: string;
      sourceRef?: string | null;
    } | null;
  };
  materials: {
    items: MaterialLayerItem[];
    totalCents: number;
    /** Scope material lines we could not price — these widen uncertainty and are surfaced, never hidden. */
    unpriced: { scopeLineItemId: string; description: string }[];
  };
  directCostCents: number;
  overheadProfit: {
    overheadPctLow: number;
    overheadPctHigh: number;
    netMarginPctLow: number;
    netMarginPctHigh: number;
    appliedOverheadPct: number;
    appliedNetMarginPct: number;
    basis?: string | null;
    source: string;
    sourceRef?: string | null;
  } | null;
  marketHeat: { factor: number; basis: string; source: string; asOf: string } | null;
}

export interface ShouldCostResult {
  ok: boolean;
  /** Hard blockers — inputs without which no band can honestly be computed. */
  missing: string[];
  layers: ShouldCostLayers;
  directCostCents: number;
  pointEstimateCents: number;
  bandLowCents: number;
  bandHighCents: number;
  bandPct: number;
  assumptions: string[];
}

export interface ScopeGateBidLine {
  id: string;
  scopeLineItemId?: string | null;
  kind: 'INCLUSION' | 'EXCLUSION' | 'ALLOWANCE' | 'ALTERNATE';
  description: string;
  totalCents: number;
}

export interface ScopeGateResult {
  passed: boolean;
  coveragePct: number;
  matchedScopeLineIds: string[];
  unmatchedScopeLines: { id: string; description: string }[];
  /** Bid EXCLUSION lines that point at a line that IS in scope — a leveling conflict. */
  exclusionConflicts: { bidLineId: string; description: string; scopeLineItemId: string }[];
  /** Bid lines that matched nothing in scope (extras) — informational. */
  unmatchedBidLines: { bidLineId: string; description: string; totalCents: number }[];
  reasons: string[];
}

export type VerdictZone = 'WITHIN_RANGE' | 'ABOVE_RANGE' | 'BELOW_RANGE';

export const ENGINE_VERSION = '0.1.0';

/** Minimum share of scope lines a bid must address before a verdict may be rendered. */
export const SCOPE_COVERAGE_THRESHOLD = 0.8;

/** Trades whose output is commodity-unit-priced support a tighter honest band. */
export const COMMODITY_CATEGORIES = new Set(['roofing', 'drywall']);

export const BAND_PCT_COMMODITY = 0.1;
export const BAND_PCT_DEFAULT = 0.15;

/** Trade.category -> BLS SOC occupation code. */
export const CATEGORY_TO_SOC: Record<string, { socCode: string; occupation: string }> = {
  sitework: { socCode: '47-2073', occupation: 'Operating Engineers' },
  foundation: { socCode: '47-2051', occupation: 'Cement Masons & Concrete Finishers' },
  framing: { socCode: '47-2031', occupation: 'Carpenters' },
  roofing: { socCode: '47-2181', occupation: 'Roofers' },
  exterior: { socCode: '47-2031', occupation: 'Carpenters' },
  windows: { socCode: '47-2031', occupation: 'Carpenters' },
  plumbing: { socCode: '47-2152', occupation: 'Plumbers, Pipefitters & Steamfitters' },
  'plumbing-finish': { socCode: '47-2152', occupation: 'Plumbers, Pipefitters & Steamfitters' },
  electrical: { socCode: '47-2111', occupation: 'Electricians' },
  'electrical-finish': { socCode: '47-2111', occupation: 'Electricians' },
  hvac: { socCode: '49-9021', occupation: 'HVAC Mechanics & Installers' },
  insulation: { socCode: '47-2131', occupation: 'Insulation Workers' },
  drywall: { socCode: '47-2081', occupation: 'Drywall & Ceiling Tile Installers' },
  trim: { socCode: '47-2031', occupation: 'Carpenters' },
  painting: { socCode: '47-2141', occupation: 'Painters, Construction & Maintenance' },
  flooring: { socCode: '47-2031', occupation: 'Carpenters' },
  tile: { socCode: '47-2044', occupation: 'Tile & Stone Setters' },
  cabinets: { socCode: '47-2031', occupation: 'Carpenters' },
  landscaping: { socCode: '47-2061', occupation: 'Construction Laborers' },
  cleanup: { socCode: '47-2061', occupation: 'Construction Laborers' },
};

export const FALLBACK_SOC = { socCode: '47-2061', occupation: 'Construction Laborers' };
