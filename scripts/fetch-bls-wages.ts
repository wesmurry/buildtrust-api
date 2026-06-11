// Refresh WageRate rows from the BLS OEWS public API.
//
// Usage:
//   npx tsx scripts/fetch-bls-wages.ts [msaCode] [msaName]
//   npx tsx scripts/fetch-bls-wages.ts 12420 "Austin-Round Rock-San Marcos, TX"
//
// Unregistered API access allows 25 queries/day. Register a free key at
// https://data.bls.gov/registrationEngine/ and set BLS_API_KEY for 500/day.
//
// OEWS series id: OEUM + 7-digit area + 000000 (cross-industry) + SOC(6) + datatype
//   datatype 08 = hourly median wage, 09 = hourly 75th percentile.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OCCUPATIONS = [
  { socCode: '47-2051', occupation: 'Cement Masons & Concrete Finishers' },
  { socCode: '47-2031', occupation: 'Carpenters' },
  { socCode: '47-2181', occupation: 'Roofers' },
  { socCode: '47-2111', occupation: 'Electricians' },
  { socCode: '47-2152', occupation: 'Plumbers, Pipefitters & Steamfitters' },
  { socCode: '49-9021', occupation: 'HVAC Mechanics & Installers' },
  { socCode: '47-2081', occupation: 'Drywall & Ceiling Tile Installers' },
  { socCode: '47-2141', occupation: 'Painters, Construction & Maintenance' },
  { socCode: '47-2073', occupation: 'Operating Engineers' },
  { socCode: '47-2061', occupation: 'Construction Laborers' },
  { socCode: '47-2044', occupation: 'Tile & Stone Setters' },
  { socCode: '47-2131', occupation: 'Insulation Workers' },
];

function seriesId(msaCode: string, socCode: string, datatype: '08' | '09'): string {
  return `OEUM${msaCode.padStart(7, '0')}000000${socCode.replace('-', '')}${datatype}`;
}

async function main() {
  const msaCode = process.argv[2] ?? '12420';
  const msaName = process.argv[3] ?? 'Austin-Round Rock-San Marcos, TX';
  const currentYear = new Date().getFullYear();

  const seriesIds = OCCUPATIONS.flatMap((o) => [
    seriesId(msaCode, o.socCode, '08'),
    seriesId(msaCode, o.socCode, '09'),
  ]);

  const body: Record<string, unknown> = {
    seriesid: seriesIds,
    startyear: String(currentYear - 2),
    endyear: String(currentYear),
  };
  if (process.env.BLS_API_KEY) body.registrationkey = process.env.BLS_API_KEY;

  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`BLS API HTTP ${res.status}`);
  const json = (await res.json()) as {
    status: string;
    Results?: { series: { seriesID: string; data: { year: string; value: string }[] }[] };
  };
  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API status: ${json.status}`);
  }

  // Collect latest value per series.
  const latest = new Map<string, { year: string; cents: number }>();
  for (const s of json.Results?.series ?? []) {
    const point = s.data?.[0];
    if (!point) continue;
    const dollars = parseFloat(point.value);
    if (!Number.isFinite(dollars)) continue;
    latest.set(s.seriesID, { year: point.year, cents: Math.round(dollars * 100) });
  }

  let written = 0;
  for (const o of OCCUPATIONS) {
    const median = latest.get(seriesId(msaCode, o.socCode, '08'));
    const p75 = latest.get(seriesId(msaCode, o.socCode, '09'));
    if (!median || !p75) {
      console.warn(`  skip ${o.socCode} ${o.occupation}: no data for ${msaName}`);
      continue;
    }
    // OEWS reference period is May of the survey year.
    const asOf = new Date(`${median.year}-05-01T00:00:00Z`);
    await prisma.wageRate.upsert({
      where: { msaCode_socCode_asOf: { msaCode, socCode: o.socCode, asOf } },
      update: { hourlyMedianCents: median.cents, hourlyP75Cents: p75.cents },
      create: {
        msaCode,
        msaName,
        socCode: o.socCode,
        occupation: o.occupation,
        hourlyMedianCents: median.cents,
        hourlyP75Cents: p75.cents,
        source: 'BLS_OEWS',
        sourceRef: `BLS series ${seriesId(msaCode, o.socCode, '08')}/${seriesId(msaCode, o.socCode, '09').slice(-2)}, May ${median.year} OEWS`,
        asOf,
      },
    });
    written++;
    console.log(
      `  ${o.socCode} ${o.occupation}: median $${(median.cents / 100).toFixed(2)} / p75 $${(p75.cents / 100).toFixed(2)} (May ${median.year})`,
    );
  }
  console.log(`Done: ${written}/${OCCUPATIONS.length} occupations written for ${msaName} (${msaCode}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
