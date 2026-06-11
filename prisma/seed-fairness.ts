// Fairness-engine reference data + leveled scope/bid lines for the demo project.
//
// Provenance discipline:
//   - WageRate rows are REAL data: BLS OEWS May 2025, Austin-Round Rock-San
//     Marcos MSA (12420), fetched 2026-06-10 from the BLS public API. Each row
//     carries its series ID.
//   - LaborUnit and several MaterialPriceRef rows are published rules of thumb
//     (source PUBLISHED_ESTIMATE) standing in until PHCC/NECA/MCAA/Craftsman
//     licenses are in place. They are demo-grade and say so.
//   - Margin norms cite the strongest available source per trade; the HVAC row
//     notes its figure is single-sourced pending purchase of the ACCA study.

import type { PrismaClient } from '@prisma/client';
import { computeAssessment } from '../src/services/fairness/engine.js';

const AUSTIN = { msaCode: '12420', msaName: 'Austin-Round Rock-San Marcos, TX' };
const OEWS_ASOF = new Date('2025-05-01'); // OEWS May 2025 reference period
const REF_ASOF = new Date('2026-06-01');

export async function seedFairness(prisma: PrismaClient) {
  console.log('Seeding fairness engine data...');

  // --- Wage rates (REAL BLS OEWS data, fetched 2026-06-10) ---
  const wages = [
    { socCode: '47-2051', occupation: 'Cement Masons & Concrete Finishers', median: 2376, p75: 2782 },
    { socCode: '47-2031', occupation: 'Carpenters', median: 2416, p75: 2801 },
    { socCode: '47-2181', occupation: 'Roofers', median: 2276, p75: 2731 },
    { socCode: '47-2111', occupation: 'Electricians', median: 2903, p75: 3525 },
    { socCode: '47-2152', occupation: 'Plumbers, Pipefitters & Steamfitters', median: 3020, p75: 3832 },
    { socCode: '49-9021', occupation: 'HVAC Mechanics & Installers', median: 2924, p75: 3597 },
    { socCode: '47-2081', occupation: 'Drywall & Ceiling Tile Installers', median: 2428, p75: 2958 },
    { socCode: '47-2141', occupation: 'Painters, Construction & Maintenance', median: 2238, p75: 2359 },
    { socCode: '47-2073', occupation: 'Operating Engineers', median: 2450, p75: 2938 },
    { socCode: '47-2061', occupation: 'Construction Laborers', median: 2116, p75: 2312 },
  ];
  for (const w of wages) {
    const series = `OEUM00${AUSTIN.msaCode}000000${w.socCode.replace('-', '')}`;
    await prisma.wageRate.create({
      data: {
        msaCode: AUSTIN.msaCode,
        msaName: AUSTIN.msaName,
        socCode: w.socCode,
        occupation: w.occupation,
        hourlyMedianCents: w.median,
        hourlyP75Cents: w.p75,
        source: 'BLS_OEWS',
        sourceRef: `BLS series ${series}08/09, May 2025 OEWS`,
        asOf: OEWS_ASOF,
      },
    });
  }

  // --- Burden factors (TX; workers comp is the dominant per-trade variable) ---
  const burdens: Array<[string, number]> = [
    ['foundation', 0.18],
    ['framing', 0.15],
    ['roofing', 0.35],
    ['plumbing', 0.08],
    ['electrical', 0.06],
    ['hvac', 0.08],
    ['drywall', 0.12],
    ['painting', 0.1],
    ['sitework', 0.12],
    ['tile', 0.1],
  ];
  for (const [tradeCategory, wc] of burdens) {
    await prisma.burdenFactor.create({
      data: {
        state: 'TX',
        tradeCategory,
        payrollTaxPct: 0.09,
        workersCompPct: wc,
        otherPct: 0,
        multiplier: 1 + 0.09 + wc,
        source: 'PUBLISHED_ESTIMATE',
        sourceRef: 'NCCI class-code rate ranges + payroll taxes — verify against carrier quotes',
      },
    });
  }

  // --- Trade margin norms (overhead + net, residential INSTALL basis) ---
  const margins = [
    { c: 'foundation', ohL: 0.2, ohH: 0.3, nmL: 0.05, nmH: 0.1, ref: 'Industry trade-margin surveys (Projul et al.)' },
    { c: 'framing', ohL: 0.2, ohH: 0.3, nmL: 0.05, nmH: 0.08, ref: 'Projul construction profit margins by trade — framing is the thinnest-margin trade' },
    { c: 'roofing', ohL: 0.2, ohH: 0.3, nmL: 0.06, nmH: 0.12, ref: 'ProfitabilityPartners roofing margin analysis' },
    { c: 'plumbing', ohL: 0.25, ohH: 0.4, nmL: 0.05, nmH: 0.12, ref: 'ProfitabilityPartners / BTAcademy plumbing margins (install, not service)' },
    { c: 'electrical', ohL: 0.25, ohH: 0.4, nmL: 0.05, nmH: 0.12, ref: 'NECA Financial Performance Report sales-dollar split via EC Magazine (verified)' },
    { c: 'hvac', ohL: 0.25, ohH: 0.4, nmL: 0.05, nmH: 0.13, ref: 'ACCA 2024 Financial Benchmarking Study — SINGLE-SOURCED; purchase the report before client-facing use' },
    { c: 'drywall', ohL: 0.2, ohH: 0.3, nmL: 0.08, nmH: 0.15, ref: 'Industry markup surveys' },
    { c: 'painting', ohL: 0.2, ohH: 0.3, nmL: 0.05, nmH: 0.1, ref: 'Industry markup surveys' },
  ];
  for (const m of margins) {
    await prisma.tradeMarginNorm.create({
      data: {
        tradeCategory: m.c,
        overheadPctLow: m.ohL,
        overheadPctHigh: m.ohH,
        netMarginPctLow: m.nmL,
        netMarginPctHigh: m.nmH,
        basis: 'residential install margins',
        source: 'PUBLISHED_ESTIMATE',
        sourceRef: m.ref,
        asOf: new Date('2026-01-01'),
      },
    });
  }

  // --- Labor units (rules of thumb pending licensed data — flagged) ---
  const laborUnits = [
    { c: 'foundation', t: 'FND-FORM-GRADEBEAM', d: 'Excavate, form & strip grade beams', u: 'LF', h: 0.45 },
    { c: 'foundation', t: 'FND-PT-CABLE', d: 'Post-tension cable & rebar install', u: 'SF', h: 0.045 },
    { c: 'foundation', t: 'FND-PREP-VAPOR', d: 'Vapor barrier & sub-slab prep', u: 'SF', h: 0.025 },
    { c: 'foundation', t: 'FND-POUR-FINISH', d: 'Place & finish concrete slab', u: 'SF', h: 0.075 },
    { c: 'framing', t: 'FRM-STRUCT', d: 'Structural framing incl. sheathing & roof deck (custom 2-story)', u: 'SF', h: 0.16 },
    { c: 'framing', t: 'FRM-BEAM-SET', d: 'Set engineered LVL beam, crane-assisted', u: 'EA', h: 6.0 },
    { c: 'roofing', t: 'RF-SS-METAL', d: 'Standing-seam metal panel install (2-4x asphalt labor)', u: 'SQ', h: 9.0 },
    { c: 'roofing', t: 'RF-UNDERLAY', d: 'Synthetic underlayment install', u: 'SQ', h: 0.35 },
    { c: 'plumbing', t: 'PLB-RI-FIXTURE', d: 'Rough-in per plumbing fixture', u: 'EA', h: 9.5, ref: 'PHCC-class placeholder — replace under PHCC Labor Unit Database license ($349)' },
    { c: 'electrical', t: 'ELE-RI-OPENING', d: 'Rough-in per electrical opening', u: 'EA', h: 0.75, ref: 'NECA MLU-class placeholder — replace under NECA vendor license' },
    { c: 'hvac', t: 'HVAC-SPLIT-TON', d: 'Ducted split system install per ton', u: 'TON', h: 5.5, ref: 'MCAA WebLEM-class placeholder — replace under MCAA vendor license' },
  ];
  for (const lu of laborUnits) {
    await prisma.laborUnit.create({
      data: {
        tradeCategory: lu.c,
        taskCode: lu.t,
        description: lu.d,
        unit: lu.u,
        hoursPerUnit: lu.h,
        conditions: 'Standard conditions, custom residential. Adjust for access, complexity, weather.',
        source: 'PUBLISHED_ESTIMATE',
        sourceRef: (lu as { ref?: string }).ref ?? 'Published installer guidance — replace under Craftsman data license',
        effectiveDate: REF_ASOF,
      },
    });
  }

  // --- Material price references ---
  const materials = [
    { code: 'CONC-RM-3000PSI', d: 'Ready-mix concrete 3000 PSI, delivered', u: 'CY', p: 16500, src: 'SUPPLIER_FEED', ref: 'Austin ready-mix quote ballpark, Jun 2026' },
    { code: 'PT-CABLE-KIT', d: 'PT cables, anchors & rebar per slab SF', u: 'SF', p: 95, src: 'PUBLISHED_ESTIMATE', ref: 'PT supplier guidance' },
    { code: 'FORM-MAT', d: 'Grade-beam form materials', u: 'LF', p: 350, src: 'PUBLISHED_ESTIMATE', ref: null },
    { code: 'FRM-LUMBER-PKG', d: 'Framing lumber package, SPF #2 mixed dimensions', u: 'LS', p: 1800000, src: 'MANUAL', ref: '84 Lumber quote — project material record m9' },
    { code: 'FRM-HARDWARE', d: 'Connectors, fasteners & structural hardware', u: 'LS', p: 120000, src: 'PUBLISHED_ESTIMATE', ref: null },
    { code: 'RF-UNDERLAY-MAT', d: 'Synthetic roofing underlayment', u: 'SQ', p: 4500, src: 'SUPPLIER_FEED', ref: 'Big-box pro pricing, Jun 2026' },
    { code: 'RF-TRIM-FLASH', d: 'Trim, flashing & fasteners — standing seam', u: 'LS', p: 150000, src: 'PUBLISHED_ESTIMATE', ref: null },
  ];
  for (const m of materials) {
    await prisma.materialPriceRef.create({
      data: {
        itemCode: m.code,
        description: m.d,
        unit: m.u,
        unitPriceCents: m.p,
        region: AUSTIN.msaCode,
        source: m.src as 'SUPPLIER_FEED' | 'PUBLISHED_ESTIMATE' | 'MANUAL',
        sourceRef: m.ref,
        asOf: REF_ASOF,
      },
    });
  }

  // --- Market heat (neutral until calibrated) ---
  for (const c of ['foundation', 'framing', 'roofing']) {
    await prisma.marketHeatFactor.create({
      data: {
        msaCode: AUSTIN.msaCode,
        tradeCategory: c,
        factor: 1.0,
        basis: 'Neutral default — calibrate from permit volume, OEWS employment trends, and platform bid-vs-band residuals',
        source: 'MANUAL',
        asOf: REF_ASOF,
      },
    });
  }

  // --- Scope sheets for three trades on the Henderson project ---
  // Foundation t2: 2,200 SF post-tension slab, 480 LF grade beams.
  // Framing t3: 3,500 SF custom two-story.
  // Roofing t4: 38 squares standing seam; PANELS OWNER-FURNISHED (material
  // record m2 tracks the panel purchase on the builder side).
  const scopeLines = [
    { id: 'scl-t2-1', tradeId: 't2', cat: 'LABOR', d: 'Excavate, form & strip grade beams', q: 480, u: 'LF', task: 'FND-FORM-GRADEBEAM' },
    { id: 'scl-t2-2', tradeId: 't2', cat: 'LABOR', d: 'Install post-tension cables & rebar', q: 2200, u: 'SF', task: 'FND-PT-CABLE' },
    { id: 'scl-t2-3', tradeId: 't2', cat: 'LABOR', d: 'Vapor barrier & sub-slab prep', q: 2200, u: 'SF', task: 'FND-PREP-VAPOR' },
    { id: 'scl-t2-4', tradeId: 't2', cat: 'LABOR', d: 'Place & finish slab', q: 2200, u: 'SF', task: 'FND-POUR-FINISH' },
    { id: 'scl-t2-5', tradeId: 't2', cat: 'MATERIAL', d: 'Ready-mix concrete 3000 PSI', q: 38, u: 'CY', mat: 'CONC-RM-3000PSI' },
    { id: 'scl-t2-6', tradeId: 't2', cat: 'MATERIAL', d: 'PT cable kit & rebar', q: 2200, u: 'SF', mat: 'PT-CABLE-KIT' },
    { id: 'scl-t2-7', tradeId: 't2', cat: 'MATERIAL', d: 'Grade-beam form materials', q: 480, u: 'LF', mat: 'FORM-MAT' },
    { id: 'scl-t3-1', tradeId: 't3', cat: 'LABOR', d: 'Structural framing incl. sheathing & roof deck', q: 3500, u: 'SF', task: 'FRM-STRUCT' },
    { id: 'scl-t3-2', tradeId: 't3', cat: 'LABOR', d: 'Set LVL beams (great room 22-ft clear span)', q: 3, u: 'EA', task: 'FRM-BEAM-SET' },
    { id: 'scl-t3-3', tradeId: 't3', cat: 'MATERIAL', d: 'Framing lumber package', q: 1, u: 'LS', mat: 'FRM-LUMBER-PKG' },
    { id: 'scl-t3-4', tradeId: 't3', cat: 'MATERIAL', d: 'Connectors, fasteners & hardware', q: 1, u: 'LS', mat: 'FRM-HARDWARE' },
    { id: 'scl-t4-1', tradeId: 't4', cat: 'LABOR', d: 'Install standing-seam metal panels (24ga Galvalume — panels owner-furnished)', q: 38, u: 'SQ', task: 'RF-SS-METAL' },
    { id: 'scl-t4-2', tradeId: 't4', cat: 'LABOR', d: 'Install synthetic underlayment', q: 38, u: 'SQ', task: 'RF-UNDERLAY' },
    { id: 'scl-t4-3', tradeId: 't4', cat: 'MATERIAL', d: 'Synthetic underlayment', q: 38, u: 'SQ', mat: 'RF-UNDERLAY-MAT' },
    { id: 'scl-t4-4', tradeId: 't4', cat: 'MATERIAL', d: 'Trim, flashing & fasteners', q: 1, u: 'LS', mat: 'RF-TRIM-FLASH' },
  ];
  let order = 0;
  for (const s of scopeLines) {
    await prisma.scopeLineItem.create({
      data: {
        id: s.id,
        tradeId: s.tradeId,
        description: s.d,
        category: s.cat as 'LABOR' | 'MATERIAL',
        quantity: s.q,
        unit: s.u,
        laborTaskCode: (s as { task?: string }).task ?? null,
        materialCode: (s as { mat?: string }).mat ?? null,
        displayOrder: order++,
      },
    });
  }

  // --- Leveled bid line items (totals reconcile exactly to legacy bid totals) ---
  type Line = {
    bidId: string;
    scope?: string;
    d: string;
    kind?: 'INCLUSION' | 'EXCLUSION';
    cents: number;
  };
  const bidLines: Line[] = [
    // b1 — Reyes Concrete, $42,000 (awarded)
    { bidId: 'b1', scope: 'scl-t2-1', d: 'Form & excavate grade beams', cents: 920000 },
    { bidId: 'b1', scope: 'scl-t2-2', d: 'PT cable & rebar install', cents: 630000 },
    { bidId: 'b1', scope: 'scl-t2-3', d: 'Vapor barrier & prep', cents: 210000 },
    { bidId: 'b1', scope: 'scl-t2-4', d: 'Pour & finish slab', cents: 1440000 },
    { bidId: 'b1', scope: 'scl-t2-5', d: 'Concrete material', cents: 650000 },
    { bidId: 'b1', scope: 'scl-t2-6', d: 'PT kit', cents: 220000 },
    { bidId: 'b1', scope: 'scl-t2-7', d: 'Forms', cents: 130000 },
    // b2 — Brady Foundation Works, $47,500 — EXCLUDES in-scope vapor barrier -> gate conflict
    { bidId: 'b2', scope: 'scl-t2-1', d: 'Grade beam excavation & forming', cents: 1100000 },
    { bidId: 'b2', scope: 'scl-t2-2', d: 'Post-tension system install', cents: 750000 },
    { bidId: 'b2', scope: 'scl-t2-4', d: 'Concrete placement & finish', cents: 1650000 },
    { bidId: 'b2', scope: 'scl-t2-5', d: 'Ready-mix concrete', cents: 720000 },
    { bidId: 'b2', scope: 'scl-t2-6', d: 'PT materials', cents: 280000 },
    { bidId: 'b2', scope: 'scl-t2-7', d: 'Form package', cents: 250000 },
    { bidId: 'b2', scope: 'scl-t2-3', d: 'Vapor barrier & sub-slab prep BY OTHERS', kind: 'EXCLUSION', cents: 0 },
    // b3 — Nguyen Concrete, $44,800
    { bidId: 'b3', scope: 'scl-t2-1', d: 'Grade beams', cents: 1020000 },
    { bidId: 'b3', scope: 'scl-t2-2', d: 'PT cables', cents: 680000 },
    { bidId: 'b3', scope: 'scl-t2-3', d: 'Vapor barrier', cents: 240000 },
    { bidId: 'b3', scope: 'scl-t2-4', d: 'Place & finish', cents: 1520000 },
    { bidId: 'b3', scope: 'scl-t2-5', d: 'Concrete', cents: 690000 },
    { bidId: 'b3', scope: 'scl-t2-6', d: 'PT kit', cents: 210000 },
    { bidId: 'b3', scope: 'scl-t2-7', d: 'Forms', cents: 120000 },
    // b4 — Wells Framing, $62,000 (awarded)
    { bidId: 'b4', scope: 'scl-t3-1', d: 'Frame structure, sheathing, roof deck', cents: 3600000 },
    { bidId: 'b4', scope: 'scl-t3-2', d: 'LVL beam set w/ crane', cents: 200000 },
    { bidId: 'b4', scope: 'scl-t3-3', d: 'Lumber package', cents: 2250000 },
    { bidId: 'b4', scope: 'scl-t3-4', d: 'Hardware & fasteners', cents: 150000 },
    // b5 — Morrison Carpentry, $68,500
    { bidId: 'b5', scope: 'scl-t3-1', d: 'Structural framing complete', cents: 4050000 },
    { bidId: 'b5', scope: 'scl-t3-2', d: 'Beam setting', cents: 250000 },
    { bidId: 'b5', scope: 'scl-t3-3', d: 'Lumber', cents: 2400000 },
    { bidId: 'b5', scope: 'scl-t3-4', d: 'Hardware', cents: 150000 },
    // b6 — DK Framing, $64,200
    { bidId: 'b6', scope: 'scl-t3-1', d: 'Framing labor & sheathing', cents: 3750000 },
    { bidId: 'b6', scope: 'scl-t3-2', d: 'LVL beams', cents: 220000 },
    { bidId: 'b6', scope: 'scl-t3-3', d: 'Lumber package', cents: 2300000 },
    { bidId: 'b6', scope: 'scl-t3-4', d: 'Hardware', cents: 150000 },
    // b8 — Peak Roofing, $24,200
    { bidId: 'b8', scope: 'scl-t4-1', d: 'Standing seam install (panels by owner)', cents: 1850000 },
    { bidId: 'b8', scope: 'scl-t4-2', d: 'Underlayment labor', cents: 140000 },
    { bidId: 'b8', scope: 'scl-t4-3', d: 'Underlayment material', cents: 180000 },
    { bidId: 'b8', scope: 'scl-t4-4', d: 'Trim & flashing', cents: 250000 },
    // b9 — Skyline Roofing, $27,800 — extra unmatched exclusion (warning, not a conflict)
    { bidId: 'b9', scope: 'scl-t4-1', d: 'Metal panel installation', cents: 2130000 },
    { bidId: 'b9', scope: 'scl-t4-2', d: 'Underlayment install', cents: 170000 },
    { bidId: 'b9', scope: 'scl-t4-3', d: 'Underlayment', cents: 200000 },
    { bidId: 'b9', scope: 'scl-t4-4', d: 'Flashing package', cents: 280000 },
    { bidId: 'b9', d: 'Permit & disposal fees excluded', kind: 'EXCLUSION', cents: 0 },
    // b10 — Texas Roofing Pro, $22,500 — lands below band -> scope-gap narrative
    { bidId: 'b10', scope: 'scl-t4-1', d: 'SS panel install', cents: 1720000 },
    { bidId: 'b10', scope: 'scl-t4-2', d: 'Underlayment labor', cents: 130000 },
    { bidId: 'b10', scope: 'scl-t4-3', d: 'Underlayment', cents: 160000 },
    { bidId: 'b10', scope: 'scl-t4-4', d: 'Trim/flashing', cents: 240000 },
  ];
  for (const l of bidLines) {
    await prisma.bidLineItem.create({
      data: {
        bidId: l.bidId,
        scopeLineItemId: l.scope ?? null,
        description: l.d,
        kind: l.kind ?? 'INCLUSION',
        totalCents: l.cents,
      },
    });
  }

  // Raw bid documents for two bids — demo artifacts for the AI parse flow.
  await prisma.bidDocument.create({
    data: {
      bidId: 'b8',
      fileName: 'peak-roofing-proposal.txt',
      rawText: [
        'PEAK ROOFING LLC — PROPOSAL',
        'Re: Henderson Residence, 1842 Oakwood Drive',
        'Install owner-furnished 24ga standing seam panels on main house, approx 38 squares: $18,500',
        'Supply and install synthetic underlayment: $3,200',
        'All trim, flashing, and fasteners: $2,500',
        'Total: $24,200. Valid 30 days. Crew of 4, approx 2 weeks.',
      ].join('\n'),
    },
  });
  await prisma.bidDocument.create({
    data: {
      bidId: 'b2',
      fileName: 'brady-foundation-bid.txt',
      rawText: [
        'Brady Foundation Works — Bid for Henderson Residence PT slab',
        'Grade beam excavation and forming: $11,000',
        'Post tension system furnish & install: $10,300',
        'Concrete placement and finishing: $16,500',
        'Ready mix, forms and materials: $9,700',
        'NOTE: Vapor barrier and sub-slab prep BY OTHERS.',
        'Total: $47,500',
      ].join('\n'),
    },
  });

  // --- Compute assessments: one band per trade, one verdict per bid ---
  // Publishing flow demo: most verdicts are published to the homeowner;
  // b9 is left at builder-review to show the gate; b2 stays blocked.
  const targets: Array<{ tradeId: string; bidId?: string }> = [
    { tradeId: 't2' },
    { tradeId: 't2', bidId: 'b1' },
    { tradeId: 't2', bidId: 'b2' },
    { tradeId: 't2', bidId: 'b3' },
    { tradeId: 't3' },
    { tradeId: 't3', bidId: 'b4' },
    { tradeId: 't3', bidId: 'b5' },
    { tradeId: 't3', bidId: 'b6' },
    { tradeId: 't4' },
    { tradeId: 't4', bidId: 'b8' },
    { tradeId: 't4', bidId: 'b9' },
    { tradeId: 't4', bidId: 'b10' },
  ];
  const holdAtReview = new Set(['b9']);
  for (const t of targets) {
    const a = await computeAssessment(t.tradeId, t.bidId);
    if (a.status === 'DRAFT') {
      const publish = !t.bidId || !holdAtReview.has(t.bidId);
      await prisma.fairPriceAssessment.update({
        where: { id: a.id },
        data: {
          status: publish ? 'CLIENT_VISIBLE' : 'BUILDER_REVIEWED',
          reviewedById: 'u2',
          reviewedAt: new Date(),
        },
      });
    }
    console.log(
      `  assessment ${t.tradeId}${t.bidId ? `/${t.bidId}` : ''}: ` +
        `band $${(a.bandLowCents / 100).toFixed(0)}-$${(a.bandHighCents / 100).toFixed(0)} ` +
        `verdict=${a.verdict ?? (a.status === 'BLOCKED_SCOPE_GATE' ? 'BLOCKED' : 'n/a')}`,
    );
  }

  console.log('Fairness data seeded.');
}
