import { describe, it, expect } from 'vitest';
import { parseBidFixture } from '../bid-parser.js';
import type { ParserScopeLine } from '../bid-parser.types.js';

const roofingScopeLines: ParserScopeLine[] = [
  {
    id: 'scl-t4-1',
    description: 'Install standing-seam metal panels (24ga Galvalume — panels owner-furnished)',
    category: 'LABOR',
    quantity: 38,
    unit: 'SQ',
  },
  { id: 'scl-t4-2', description: 'Install synthetic underlayment', category: 'LABOR', quantity: 38, unit: 'SQ' },
  { id: 'scl-t4-3', description: 'Synthetic underlayment', category: 'MATERIAL', quantity: 38, unit: 'SQ' },
  { id: 'scl-t4-4', description: 'Trim, flashing & fasteners', category: 'MATERIAL', quantity: 1, unit: 'LS' },
];

const peakRoofingDoc = [
  'PEAK ROOFING LLC — PROPOSAL',
  'Re: Henderson Residence, 1842 Oakwood Drive',
  'Install owner-furnished 24ga standing seam panels on main house, approx 38 squares: $18,500',
  'Supply and install synthetic underlayment: $3,200',
  'All trim, flashing, and fasteners: $2,500',
  'Total: $24,200. Valid 30 days. Crew of 4, approx 2 weeks.',
].join('\n');

describe('parseBidFixture', () => {
  it('parses the Peak Roofing proposal into matched inclusion lines', () => {
    const result = parseBidFixture(peakRoofingDoc, roofingScopeLines);

    expect(result.usedFixture).toBe(true);
    expect(result.model).toBeNull();
    expect(result.parserVersion).toBe('1.0.0');

    const inclusions = result.lineItems.filter((l) => l.kind === 'INCLUSION');
    expect(inclusions).toHaveLength(3);
    expect(result.lineItems).toHaveLength(3);
    expect(inclusions.map((l) => l.totalCents)).toEqual([1850000, 320000, 250000]);

    const panels = inclusions.find((l) => l.totalCents === 1850000)!;
    expect(panels.scopeLineItemId).toBe('scl-t4-1');
    expect(panels.sourceText).toBe(
      'Install owner-furnished 24ga standing seam panels on main house, approx 38 squares: $18,500',
    );

    const trim = inclusions.find((l) => l.totalCents === 250000)!;
    expect(trim.scopeLineItemId).toBe('scl-t4-4');

    expect(result.lineItems.every((l) => !/^total\b/i.test(l.description))).toBe(true);

    // 1850000 + 320000 + 250000 == stated total 2420000 → no reconciliation penalty
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies "BY OTHERS" lines as exclusions with zero total', () => {
    const bradyDoc = [
      'BRADY FOUNDATION CO.',
      'Footings and stem walls per plan: $9,800',
      'Slab on grade, 1200 sf: $7,400',
      'NOTE: Vapor barrier and sub-slab prep BY OTHERS.',
      'Total: $17,200',
    ].join('\n');
    const scopeLines: ParserScopeLine[] = [
      { id: 'scl-f1-1', description: 'Footings and stem walls', category: 'LABOR', quantity: 1, unit: 'LS' },
      { id: 'scl-f1-2', description: 'Concrete slab on grade', category: 'LABOR', quantity: 1200, unit: 'SF' },
      { id: 'scl-f1-3', description: 'Vapor barrier and sub-slab prep', category: 'MATERIAL', quantity: 1, unit: 'LS' },
    ];

    const result = parseBidFixture(bradyDoc, scopeLines);
    const exclusion = result.lineItems.find((l) => l.kind === 'EXCLUSION')!;
    expect(exclusion).toBeDefined();
    expect(exclusion.totalCents).toBe(0);
    expect(exclusion.confidence).toBe(0.6);
    expect(exclusion.sourceText).toBe('NOTE: Vapor barrier and sub-slab prep BY OTHERS.');
  });

  it('converts dollars to integer cents with Math.round semantics', () => {
    const result = parseBidFixture('Concrete pump: $16,500\nAnchor bolts: $4.50', []);
    expect(result.lineItems.map((l) => l.totalCents)).toEqual([1650000, 450]);
    expect(result.lineItems.every((l) => Number.isInteger(l.totalCents))).toBe(true);
  });

  it('returns null scopeLineItemId when no scope line matches', () => {
    const result = parseBidFixture('Portable toilet rental: $500', roofingScopeLines);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].scopeLineItemId).toBeNull();
    expect(result.lineItems[0].confidence).toBe(0.7);
  });
});
