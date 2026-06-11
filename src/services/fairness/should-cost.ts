// Bottom-up should-cost computation.
//
// price = directCost / (1 - overhead% - netMargin%)  ... then x market heat,
// then banded. The point estimate is internal; the BAND is the product.
//
// All money is integer cents. Rounding happens once per boundary:
//   - burdened hourly rate -> cents
//   - each labor/material line -> cents
//   - point estimate and band edges -> cents

import {
  BAND_PCT_COMMODITY,
  BAND_PCT_DEFAULT,
  COMMODITY_CATEGORIES,
  type LaborLayerItem,
  type MaterialLayerItem,
  type ShouldCostInputs,
  type ShouldCostResult,
} from './types.js';

export function computeShouldCost(inputs: ShouldCostInputs): ShouldCostResult {
  const missing: string[] = [];
  const assumptions: string[] = [];

  const laborScopeLines = inputs.scopeLines.filter((l) => l.category === 'LABOR');
  const materialScopeLines = inputs.scopeLines.filter((l) => l.category === 'MATERIAL');

  if (inputs.scopeLines.length === 0) missing.push('No scope line items defined for this trade');
  if (laborScopeLines.length > 0 && !inputs.wage) {
    missing.push('No local wage data for this trade occupation');
  }
  if (!inputs.margin) missing.push('No overhead/profit norms for this trade category');

  // --- Labor layer ---
  const laborItems: LaborLayerItem[] = [];
  let totalHours = 0;
  let laborTotalCents = 0;

  let burdenedRateCents = 0;
  if (inputs.wage) {
    const multiplier = inputs.burden?.multiplier ?? 1.4;
    if (!inputs.burden) {
      assumptions.push(
        'No state/trade burden factor on file — applied a generic 1.40x labor burden (payroll taxes + workers comp). Replace with carrier-quoted rates.',
      );
    }
    burdenedRateCents = Math.round(inputs.wage.hourlyP75Cents * multiplier);
    assumptions.push(
      `Labor priced at the 75th-percentile ${inputs.wage.occupation} wage for ${inputs.wage.msaName} ` +
        `($${(inputs.wage.hourlyP75Cents / 100).toFixed(2)}/hr, ${inputs.wage.source}) x ${multiplier.toFixed(2)} burden. ` +
        `P75 is used deliberately: residential subs field above-median crews and OEWS misses owner-operator economics — this biases the band slightly high, the safe direction.`,
    );
    if (inputs.wage.fallbackNote) assumptions.push(inputs.wage.fallbackNote);
  }

  for (const line of laborScopeLines) {
    if (!line.laborTaskCode) {
      missing.push(`Labor scope line "${line.description}" has no labor task code`);
      continue;
    }
    const lu = inputs.laborUnits.get(line.laborTaskCode);
    if (!lu) {
      missing.push(`No labor unit data for task ${line.laborTaskCode} ("${line.description}")`);
      continue;
    }
    const hours = line.quantity * lu.hoursPerUnit;
    const costCents = Math.round(hours * burdenedRateCents);
    totalHours += hours;
    laborTotalCents += costCents;
    laborItems.push({
      scopeLineItemId: line.id,
      description: line.description,
      taskCode: lu.taskCode,
      quantity: line.quantity,
      unit: line.unit,
      hoursPerUnit: lu.hoursPerUnit,
      hours,
      burdenedRateCents,
      costCents,
      source: lu.source,
      sourceRef: lu.sourceRef,
    });
    if (lu.source === 'PUBLISHED_ESTIMATE') {
      assumptions.push(
        `Productivity for "${line.description}" (${lu.hoursPerUnit} hr/${line.unit}) is a published rule-of-thumb pending licensed labor-unit data${lu.sourceRef ? ` (${lu.sourceRef})` : ''}.`,
      );
    }
  }

  // --- Material layer ---
  const materialItems: MaterialLayerItem[] = [];
  const unpriced: { scopeLineItemId: string; description: string }[] = [];
  let materialTotalCents = 0;

  for (const line of materialScopeLines) {
    const price = line.materialCode ? inputs.materialPrices.get(line.materialCode) : undefined;
    if (!price) {
      unpriced.push({ scopeLineItemId: line.id, description: line.description });
      continue;
    }
    const costCents = Math.round(line.quantity * price.unitPriceCents);
    materialTotalCents += costCents;
    materialItems.push({
      scopeLineItemId: line.id,
      description: line.description,
      itemCode: price.itemCode,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceCents: price.unitPriceCents,
      costCents,
      source: price.source,
      sourceRef: price.sourceRef,
      asOf: price.asOf.toISOString(),
    });
  }
  if (unpriced.length > 0) {
    assumptions.push(
      `${unpriced.length} material scope line(s) could not be priced and are EXCLUDED from the band: ` +
        unpriced.map((u) => `"${u.description}"`).join(', ') +
        '. The true fair price is higher by their cost.',
    );
  }

  const directCostCents = laborTotalCents + materialTotalCents;

  // --- Overhead & profit layer ---
  let pointEstimateCents = 0;
  let appliedOverheadPct = 0;
  let appliedNetMarginPct = 0;
  if (inputs.margin) {
    appliedOverheadPct = (inputs.margin.overheadPctLow + inputs.margin.overheadPctHigh) / 2;
    appliedNetMarginPct = (inputs.margin.netMarginPctLow + inputs.margin.netMarginPctHigh) / 2;
    const divisor = 1 - appliedOverheadPct - appliedNetMarginPct;
    if (divisor <= 0) {
      missing.push('Overhead + margin norms exceed 100% — reference data is invalid');
    } else {
      pointEstimateCents = Math.round(directCostCents / divisor);
      assumptions.push(
        `Overhead ${(appliedOverheadPct * 100).toFixed(1)}% and net margin ${(appliedNetMarginPct * 100).toFixed(1)}% applied ` +
          `(midpoints of published ${inputs.margin.basis ?? 'residential install'} ranges: ` +
          `overhead ${(inputs.margin.overheadPctLow * 100).toFixed(0)}-${(inputs.margin.overheadPctHigh * 100).toFixed(0)}%, ` +
          `net ${(inputs.margin.netMarginPctLow * 100).toFixed(0)}-${(inputs.margin.netMarginPctHigh * 100).toFixed(0)}%${inputs.margin.sourceRef ? `; ${inputs.margin.sourceRef}` : ''}). ` +
          `A healthy sub earning a fair margin is the baseline — this engine does not assume margin is waste.`,
      );
    }
  }

  // --- Market heat ---
  const heatFactor = inputs.marketHeat?.factor ?? 1;
  if (inputs.marketHeat && inputs.marketHeat.factor !== 1) {
    assumptions.push(
      `Market conditions adjustment x${inputs.marketHeat.factor.toFixed(2)}: ${inputs.marketHeat.basis}. ` +
        'Subs at high utilization price by backlog, not cost — a correct cost model without this layer would mislabel hot-market bids.',
    );
  }
  pointEstimateCents = Math.round(pointEstimateCents * heatFactor);

  // --- Band ---
  const bandPct = COMMODITY_CATEGORIES.has(inputs.tradeCategory)
    ? BAND_PCT_COMMODITY
    : BAND_PCT_DEFAULT;
  const bandLowCents = Math.round(pointEstimateCents * (1 - bandPct));
  const bandHighCents = Math.round(pointEstimateCents * (1 + bandPct));
  assumptions.push(
    `Band width ±${(bandPct * 100).toFixed(0)}%: estimate-class accuracy limits mean a tighter band would be dishonest ` +
      `(AACE 18R-97 puts even full-design estimates at -10%/+15% at 80% confidence; custom work is wider).`,
  );

  const ok = missing.length === 0 && pointEstimateCents > 0;

  return {
    ok,
    missing,
    layers: {
      labor: {
        items: laborItems,
        totalHours,
        totalCents: laborTotalCents,
        wage: inputs.wage
          ? {
              socCode: inputs.wage.socCode,
              occupation: inputs.wage.occupation,
              msaName: inputs.wage.msaName,
              hourlyP75Cents: inputs.wage.hourlyP75Cents,
              source: inputs.wage.source,
              sourceRef: inputs.wage.sourceRef,
              asOf: inputs.wage.asOf.toISOString(),
              fallbackNote: inputs.wage.fallbackNote,
            }
          : null,
        burden: inputs.burden
          ? {
              multiplier: inputs.burden.multiplier,
              payrollTaxPct: inputs.burden.payrollTaxPct,
              workersCompPct: inputs.burden.workersCompPct,
              source: inputs.burden.source,
              sourceRef: inputs.burden.sourceRef,
            }
          : null,
      },
      materials: { items: materialItems, totalCents: materialTotalCents, unpriced },
      directCostCents,
      overheadProfit: inputs.margin
        ? {
            overheadPctLow: inputs.margin.overheadPctLow,
            overheadPctHigh: inputs.margin.overheadPctHigh,
            netMarginPctLow: inputs.margin.netMarginPctLow,
            netMarginPctHigh: inputs.margin.netMarginPctHigh,
            appliedOverheadPct,
            appliedNetMarginPct,
            basis: inputs.margin.basis,
            source: inputs.margin.source,
            sourceRef: inputs.margin.sourceRef,
          }
        : null,
      marketHeat: inputs.marketHeat
        ? {
            factor: inputs.marketHeat.factor,
            basis: inputs.marketHeat.basis,
            source: inputs.marketHeat.source,
            asOf: inputs.marketHeat.asOf.toISOString(),
          }
        : null,
    },
    directCostCents,
    pointEstimateCents,
    bandLowCents,
    bandHighCents,
    bandPct,
    assumptions,
  };
}
