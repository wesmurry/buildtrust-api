// Seed the REAL Murry Residence project (p2) from the ingested permit set:
//   docs/20260610_1701ClaysSpringLn_DrawingSet.pdf (Champlin | EOP, permit set 06/05/26)
//
// Quantity provenance discipline:
//   PRINTED  — number appears verbatim on a sheet (G000 floor areas, LS-100
//              coded-note quantities, G002 R-values).
//   DERIVED  — computed from printed program/geometry (fixture count from
//              "5 beds / 7 baths"; beam count from S-series callouts) and
//              flagged in the line description for builder verification.
//
// NOTE: prisma/seed.ts wipes ALL data — re-run this script after any reseed.

import { PrismaClient } from '@prisma/client';
import { computeAssessment } from '../src/services/fairness/engine.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Murry Residence (p2) from plan-set extraction...');

  // Idempotent: clear any prior p2 fairness data
  await prisma.fairPriceAssessment.deleteMany({ where: { trade: { projectId: 'p2' } } });
  await prisma.bidLineItem.deleteMany({ where: { bid: { trade: { projectId: 'p2' } } } });
  await prisma.scopeLineItem.deleteMany({ where: { trade: { projectId: 'p2' } } });
  await prisma.trade.deleteMany({ where: { projectId: 'p2' } });
  await prisma.project.deleteMany({ where: { id: 'p2' } });

  await prisma.project.create({
    data: {
      id: 'p2',
      name: 'Murry Residence',
      address: '1701 Clays Spring Ln, Lexington, KY 40502',
      status: 'PRE_CONSTRUCTION',
      gcFeeModel: 'PERCENTAGE',
      gcFeeAmount: 15,
      squareFootage: 6192, // PRINTED: G000 main residence total
      stories: 2,
      bedroomCount: 5,
      bathroomCount: 7,
      garageType: '3-car',
      ownerId: 'u1',
      gcId: 'u2',
    },
  });

  // KY burden factors (idempotent — survive a full reseed via this script)
  const kyBurdens: Array<[string, number]> = [
    ['foundation', 0.16], ['framing', 0.14], ['roofing', 0.32], ['plumbing', 0.07],
    ['electrical', 0.055], ['hvac', 0.07], ['drywall', 0.11], ['painting', 0.09],
    ['sitework', 0.11], ['tile', 0.09], ['insulation', 0.12], ['exterior', 0.14],
  ];
  for (const [tradeCategory, wc] of kyBurdens) {
    await prisma.burdenFactor.upsert({
      where: { state_tradeCategory: { state: 'KY', tradeCategory } },
      update: {},
      create: {
        state: 'KY', tradeCategory, payrollTaxPct: 0.09, workersCompPct: wc, otherPct: 0,
        multiplier: 1 + 0.09 + wc,
        source: 'PUBLISHED_ESTIMATE',
        sourceRef: 'NCCI class-code rate ranges (KY) + payroll taxes — verify against carrier quotes',
      },
    });
  }

  // Lumber package reference (national estimate pending dealer quote)
  await prisma.materialPriceRef.upsert({
    where: { itemCode_region_asOf: { itemCode: 'FRM-LUMBER-SF', region: 'US', asOf: new Date('2026-06-01') } },
    update: {},
    create: {
      itemCode: 'FRM-LUMBER-SF',
      description: 'Framing lumber + truss package per framed SF (custom residential)',
      unit: 'SF',
      unitPriceCents: 750,
      region: 'US',
      source: 'PUBLISHED_ESTIMATE',
      sourceRef: 'National custom-home lumber package ballpark — replace with dealer quote',
      asOf: new Date('2026-06-01'),
    },
  });

  const trades: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    lines: Array<{
      d: string;
      cat: 'LABOR' | 'MATERIAL' | 'GENERAL';
      q: number;
      u: string;
      task?: string;
      mat?: string;
    }>;
  }> = [
    {
      id: 't-m-sitework',
      name: 'Site Work / Demolition',
      category: 'sitework',
      description:
        'Demolition + erosion control + earthwork. PRINTED quantities (LD-100, LS-100): flagstone 65 SF, wall 139 LF, planting demo 2,090 SF; disturbance 42,757 SF (0.98 AC); construction access via Clays Spring Lane only.',
      lines: [
        { d: 'Demolition: flagstone 65 SF, wall 139 LF, planting 2,090 SF (PRINTED, LD-100)', cat: 'GENERAL', q: 1, u: 'LS' },
        { d: 'Erosion control: silt fence, tree protection, construction entrance, washout (C-100/C-101)', cat: 'GENERAL', q: 1, u: 'LS' },
        { d: 'Area of disturbance 42,757 SF / 0.98 AC (PRINTED, LS-100)', cat: 'GENERAL', q: 42757, u: 'SF' },
      ],
    },
    {
      id: 't-m-foundation',
      name: 'Foundation / Concrete',
      category: 'foundation',
      description:
        'Main house CRAWL SPACE foundation (S101) — wall footings WF20/WF30, 1,500 PSF bearing; accessory wing slab-on-grade; pool house basement + crawl w/ 4" reinforced slab (S132). NOTE: current labor-unit library covers post-tension slabs only — crawl-space units pending licensed data, so no band is computed yet.',
      lines: [
        { d: 'Crawl-space foundation, main house — footings, piers, crawl walls per S101 (no crawl-space labor units on file yet)', cat: 'LABOR', q: 1, u: 'LS' },
        { d: 'Accessory building slab-on-grade (garage/gym/storage) per A100', cat: 'LABOR', q: 1650, u: 'SF' },
        { d: 'Pool house basement + crawl, 4" slab w/ 6x6 WWF over 10-mil vapor retarder (PRINTED, S132)', cat: 'LABOR', q: 1, u: 'LS' },
      ],
    },
    {
      id: 't-m-framing',
      name: 'Framing',
      category: 'framing',
      description:
        'Wood framing w/ steel: 2x6 exterior / 2x4 interior walls (PRINTED, G002); prefab trusses @ 24" OC + 2x12 SP#2 @ 16" OC joists; LVL girders; steel W12/W10/W14 beams + HSS5x5 columns (S110-S131). Areas PRINTED on G000.',
      lines: [
        { d: 'Structural framing — main residence 6,192 SF (PRINTED: 3,530 + 2,662, G000)', cat: 'LABOR', q: 6192, u: 'SF', task: 'FRM-STRUCT' },
        { d: 'Structural framing — garage + storage/gym building 1,650 SF (PRINTED: 1,087 + 563, G000)', cat: 'LABOR', q: 1650, u: 'SF', task: 'FRM-STRUCT' },
        { d: 'Structural framing — pool house 1,135 SF first floor (PRINTED, G000)', cat: 'LABOR', q: 1135, u: 'SF', task: 'FRM-STRUCT' },
        { d: 'Set steel/LVL beams & HSS columns (DERIVED count from S-series callouts — builder to verify)', cat: 'LABOR', q: 12, u: 'EA', task: 'FRM-BEAM-SET' },
        { d: 'Framing lumber + truss package, 8,977 framed SF (ESTIMATE pending dealer quote)', cat: 'MATERIAL', q: 8977, u: 'SF', mat: 'FRM-LUMBER-SF' },
      ],
    },
    {
      id: 't-m-plumbing',
      name: 'Plumbing (design-build)',
      category: 'plumbing',
      description:
        'No plumbing sheets in permit set — design-build. Program PRINTED on G000: 5 beds / 7 baths / kitchen / 2 laundry; pool house. Grinder pump station 80 GPM w/ 2" forcemain (PRINTED, C-200). Fixture count DERIVED — builder to verify.',
      lines: [
        { d: 'Rough-in per fixture — DERIVED ~30 fixtures from program (7 baths, kitchen, 2 laundry, pool house); builder to verify', cat: 'LABOR', q: 30, u: 'EA', task: 'PLB-RI-FIXTURE' },
        { d: 'Rough-in piping & materials (unpriced — supplier quote needed)', cat: 'MATERIAL', q: 1, u: 'LS' },
        { d: 'Grinder pump station, 80 GPM, 2" PVC forcemain @ 30" min depth (PRINTED, C-200)', cat: 'GENERAL', q: 1, u: 'LS' },
      ],
    },
    {
      id: 't-m-hvac',
      name: 'HVAC (design-build)',
      category: 'hvac',
      description:
        'No mechanical sheets in permit set — design-build per 2015 IMC. Tonnage DERIVED from 6,192 SF conditioned + pool house — Manual J by sub required.',
      lines: [
        { d: 'System install — DERIVED ~10 tons total (no M sheets; Manual J required); builder to verify', cat: 'LABOR', q: 10, u: 'TON', task: 'HVAC-SPLIT-TON' },
        { d: 'Equipment + ductwork (unpriced — design-build quote needed)', cat: 'MATERIAL', q: 1, u: 'LS' },
      ],
    },
    {
      id: 't-m-insulation',
      name: 'Insulation',
      category: 'insulation',
      description:
        'R-values PRINTED on G002: R-20 wood-framed walls; R-10/R-5ci CMU walls; R-49 roofs; R-19 floor joists; R-13/R-10ci crawl walls; R-13 interior sound. No insulation labor units or margin norms on file yet — no band.',
      lines: [
        { d: 'Wall insulation R-20, roof R-49, floor R-19, crawl R-13/R-10ci (PRINTED specs, G002)', cat: 'GENERAL', q: 1, u: 'LS' },
      ],
    },
    {
      id: 't-m-masonry',
      name: 'Masonry / Exterior Veneer',
      category: 'exterior',
      description:
        'Full-thickness facebrick painted white + limestone (PRINTED, LS coded notes); site: brick retaining wall 482 LF w/ limestone cap, 12 pilasters, 2 fountains. Structural CMU w/ bond beams (S301).',
      lines: [
        { d: 'House brick veneer — full-thickness facebrick, painted white (quantities not printed; elevation takeoff needed)', cat: 'GENERAL', q: 1, u: 'LS' },
        { d: 'Brick-faced retaining wall w/ limestone cap, 482 LF (PRINTED, LS-100)', cat: 'GENERAL', q: 482, u: 'LF' },
        { d: 'Masonry pilasters w/ double limestone caps: 2 @ 42"x42" + 10 @ 30"x30" (PRINTED)', cat: 'GENERAL', q: 12, u: 'EA' },
      ],
    },
    {
      id: 't-m-roofing',
      name: 'Roofing',
      category: 'roofing',
      description:
        'Hip roofs 6:12 + low-slope 1/4:12 parapet roofs (PRINTED slopes, A130). Roof MATERIAL and AREA not printed anywhere in set — pending elevation/spec review, no honest band yet.',
      lines: [
        { d: 'Steep-slope hips 6:12 — area not printed; takeoff or roofer measure required', cat: 'GENERAL', q: 1, u: 'LS' },
        { d: 'Low-slope 1/4:12 parapet roofs w/ scuppers (dining, primary suite, sunroom, storage)', cat: 'GENERAL', q: 1, u: 'LS' },
      ],
    },
    {
      id: 't-m-hardscape',
      name: 'Hardscape / Landscape',
      category: 'landscaping',
      description:
        'Fully quantified on LS-100 coded notes (PRINTED; "contractor responsible for verification"). US Stone limestone (Plaza Gray), Belden pavers, Ameristar fence.',
      lines: [
        { d: 'Vehicular concrete pavement (PRINTED)', cat: 'GENERAL', q: 4097, u: 'SF' },
        { d: 'Permeable brick pavers + border, Belden City Line (PRINTED: 2,622 + 523)', cat: 'GENERAL', q: 3145, u: 'SF' },
        { d: 'Limestone pavement, US Stone Plaza Gray (PRINTED)', cat: 'GENERAL', q: 3072, u: 'SF' },
        { d: 'Limestone borders + raised curb (PRINTED: 650 + 186 + 264 LF)', cat: 'GENERAL', q: 1100, u: 'LF' },
        { d: 'Brick retaining wall 482 LF + pool fence 313 LF + gates (PRINTED)', cat: 'GENERAL', q: 1, u: 'LS' },
        { d: 'Driveway entrance per Lexington std 307-1 (PRINTED)', cat: 'GENERAL', q: 396, u: 'SF' },
      ],
    },
    {
      id: 't-m-pool',
      name: 'Pool (gunite)',
      category: 'pool',
      description: 'Gunite pool 40\'x20\' w/ spa + tanning shelf (PRINTED, LS-100 note 18); coping 147 LF; equipment w/ overhead structure; slot drain 39 LF.',
      lines: [
        { d: 'Gunite pool 40x20 w/ spa + tanning shelf, stairs, ledge seating (PRINTED)', cat: 'GENERAL', q: 800, u: 'SF' },
        { d: 'Pool coping, limestone w/ bullnose, 147 LF (PRINTED)', cat: 'GENERAL', q: 147, u: 'LF' },
      ],
    },
    {
      id: 't-m-sprinkler',
      name: 'Fire Sprinklers (deferred submittal)',
      category: 'fire-protection',
      description: 'PRINTED on G000: FIRE SPRINKLERS: YES (DEFERRED SUBMITTAL). Design-build NFPA 13D system across 6,192 SF + accessory structures.',
      lines: [
        { d: 'NFPA 13D residential sprinkler system, design-build (deferred submittal)', cat: 'GENERAL', q: 6192, u: 'SF' },
      ],
    },
  ];

  let order = 1;
  for (const t of trades) {
    await prisma.trade.create({
      data: {
        id: t.id,
        projectId: 'p2',
        name: t.name,
        category: t.category,
        displayOrder: order++,
        status: 'SCOPE_WRITTEN',
        description: t.description,
      },
    });
    let lineOrder = 0;
    for (const l of t.lines) {
      await prisma.scopeLineItem.create({
        data: {
          tradeId: t.id,
          description: l.d,
          category: l.cat,
          quantity: l.q,
          unit: l.u,
          laborTaskCode: l.task ?? null,
          materialCode: l.mat ?? null,
          displayOrder: lineOrder++,
        },
      });
    }
  }

  // Compute + publish trade-level bands where the engine has real inputs.
  for (const tradeId of ['t-m-framing', 't-m-plumbing', 't-m-hvac']) {
    const a = await computeAssessment(tradeId);
    await prisma.fairPriceAssessment.update({
      where: { id: a.id },
      data: { status: 'CLIENT_VISIBLE', reviewedById: 'u2', reviewedAt: new Date() },
    });
    console.log(
      `  ${tradeId}: band $${(a.bandLowCents / 100).toLocaleString()} - $${(a.bandHighCents / 100).toLocaleString()} (±${a.bandPct * 100}%)`,
    );
  }

  console.log('Murry Residence seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
