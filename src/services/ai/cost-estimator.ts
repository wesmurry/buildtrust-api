import { env } from '../../config/env.js';

interface CostEstimate {
  trade: string;
  low: number;
  mid: number;
  high: number;
  perSqFt?: { low: number; high: number };
}

export async function estimateCosts(
  _projectData: Record<string, any>,
  trades: string[],
): Promise<CostEstimate[]> {
  if (env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY is set — real AI cost estimation would run here');
  }

  // Stub: return realistic estimates for a 3,500 sqft mid-market home
  const estimates: Record<string, CostEstimate> = {
    'Site Work / Excavation': { trade: 'Site Work / Excavation', low: 12000, mid: 15000, high: 18000, perSqFt: { low: 3.4, high: 5.1 } },
    'Foundation / Concrete': { trade: 'Foundation / Concrete', low: 35000, mid: 42500, high: 50000, perSqFt: { low: 10, high: 14.3 } },
    'Framing': { trade: 'Framing', low: 55000, mid: 65000, high: 75000, perSqFt: { low: 15.7, high: 21.4 } },
    'Roofing': { trade: 'Roofing', low: 18000, mid: 23000, high: 28000, perSqFt: { low: 5.1, high: 8 } },
    'Exterior Siding / Masonry': { trade: 'Exterior Siding / Masonry', low: 25000, mid: 32000, high: 40000 },
    'Windows & Doors': { trade: 'Windows & Doors', low: 30000, mid: 38000, high: 48000 },
    'Plumbing Rough-In': { trade: 'Plumbing Rough-In', low: 15000, mid: 18000, high: 22000 },
    'Electrical Rough-In': { trade: 'Electrical Rough-In', low: 14000, mid: 17500, high: 22000 },
    'HVAC': { trade: 'HVAC', low: 18000, mid: 23000, high: 28000 },
    'Insulation': { trade: 'Insulation', low: 6000, mid: 8000, high: 10000 },
    'Drywall': { trade: 'Drywall', low: 18000, mid: 22000, high: 26000 },
    'Interior Trim / Millwork': { trade: 'Interior Trim / Millwork', low: 15000, mid: 20000, high: 25000 },
    'Painting': { trade: 'Painting', low: 10000, mid: 13000, high: 16000 },
    'Flooring': { trade: 'Flooring', low: 15000, mid: 22000, high: 28000 },
    'Tile': { trade: 'Tile', low: 8000, mid: 12000, high: 15000 },
    'Cabinets & Countertops': { trade: 'Cabinets & Countertops', low: 25000, mid: 35000, high: 45000 },
    'Plumbing Finish': { trade: 'Plumbing Finish', low: 8000, mid: 11000, high: 14000 },
    'Electrical Finish': { trade: 'Electrical Finish', low: 6000, mid: 8000, high: 10000 },
    'Landscaping': { trade: 'Landscaping', low: 12000, mid: 17000, high: 22000 },
    'Cleanup / Final Grade': { trade: 'Cleanup / Final Grade', low: 3000, mid: 4500, high: 6000 },
  };

  return trades.map(t => estimates[t] ?? { trade: t, low: 0, mid: 0, high: 0 });
}
