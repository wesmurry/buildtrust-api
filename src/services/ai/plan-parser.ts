import { env } from '../../config/env.js';

interface ParsedPlanData {
  projectInfo: Record<string, any>;
  roomSchedule: any[];
  doorSchedule: any[];
  windowSchedule: any[];
  fixtureCount: any[];
  structuralNotes: any[];
  finishSchedule: any[];
  confidence: Record<string, number>;
}

// Stub implementation — returns mock parsed data
function getMockParsedData(): ParsedPlanData {
  return {
    projectInfo: {
      name: 'Henderson Residence',
      architect: 'Studio Arch Austin',
      date: '2025-05-15',
      address: '1842 Oakwood Drive, Austin, TX 78703',
    },
    roomSchedule: [
      { name: 'Great Room', dimensions: '24x18', sqft: 432, floor: 'Hardwood', wall: 'Paint', ceiling: '10ft' },
      { name: 'Kitchen', dimensions: '16x14', sqft: 224, floor: 'Hardwood', wall: 'Paint/Tile backsplash', ceiling: '10ft' },
      { name: 'Master Bedroom', dimensions: '18x16', sqft: 288, floor: 'Hardwood', wall: 'Paint', ceiling: '9ft' },
      { name: 'Master Bath', dimensions: '12x10', sqft: 120, floor: 'Tile', wall: 'Tile/Paint', ceiling: '9ft' },
      { name: 'Bedroom 2', dimensions: '14x12', sqft: 168, floor: 'Hardwood', wall: 'Paint', ceiling: '9ft' },
      { name: 'Bedroom 3', dimensions: '14x12', sqft: 168, floor: 'Hardwood', wall: 'Paint', ceiling: '9ft' },
      { name: 'Bedroom 4', dimensions: '12x11', sqft: 132, floor: 'Hardwood', wall: 'Paint', ceiling: '9ft' },
    ],
    doorSchedule: [
      { type: 'Exterior Entry', size: '36x80', quantity: 1, spec: 'Therma-Tru Fiber-Classic Mahogany' },
      { type: 'Exterior Sliding', size: '72x80', quantity: 2, spec: 'Andersen 400 Series' },
      { type: 'Interior Panel', size: '32x80', quantity: 14, spec: 'Solid core, shaker style' },
      { type: 'Interior Panel', size: '28x80', quantity: 4, spec: 'Solid core, shaker style' },
    ],
    windowSchedule: [
      { type: 'Double-hung', size: '36x60', quantity: 8, spec: 'Andersen 400 Series, Low-E' },
      { type: 'Double-hung', size: '30x48', quantity: 4, spec: 'Andersen 400 Series, Low-E' },
      { type: 'Fixed Picture', size: '48x72', quantity: 3, spec: 'Andersen 400 Series, Low-E' },
    ],
    fixtureCount: [
      { type: 'Toilets', count: 4, spec: 'Kohler Composed' },
      { type: 'Vanity sinks', count: 5, spec: 'Kohler Composed' },
      { type: 'Kitchen sink', count: 1, spec: 'Kohler stainless undermount' },
      { type: 'Bathtub', count: 1, spec: 'Freestanding soaking' },
      { type: 'Shower', count: 2, spec: 'Tile, frameless glass' },
      { type: 'Electrical panel', count: 1, spec: '200A main' },
      { type: 'HVAC system', count: 1, spec: '5-ton, 21 SEER' },
    ],
    structuralNotes: [
      { item: 'Foundation', spec: 'Slab-on-grade, post-tension', notes: 'Per soils report' },
      { item: 'Framing', spec: 'SPF #2, 2x6 exterior, 2x4 interior', notes: 'Engineered trusses at roof' },
      { item: 'Great room beam', spec: 'LVL 5.25x16', notes: '22ft clear span' },
    ],
    finishSchedule: [
      { room: 'Great Room', floor: 'Engineered Hardwood', wall: 'Benjamin Moore Chantilly Lace', ceiling: 'Flat white', trim: 'Painted poplar' },
      { room: 'Kitchen', floor: 'Engineered Hardwood', wall: 'Benjamin Moore Revere Pewter', ceiling: 'Flat white', trim: 'Painted poplar' },
      { room: 'Master Bath', floor: 'Porcelain tile 24x24', wall: 'Tile to 8ft / Paint above', ceiling: 'Semi-gloss white', trim: 'PVC' },
    ],
    confidence: {
      projectInfo: 0.95,
      roomSchedule: 0.85,
      doorSchedule: 0.9,
      windowSchedule: 0.9,
      fixtureCount: 0.8,
      structuralNotes: 0.75,
      finishSchedule: 0.7,
    },
  };
}

export async function parsePlanSet(_planSetId: string): Promise<ParsedPlanData> {
  if (env.ANTHROPIC_API_KEY) {
    // Real implementation would use Claude vision API here
    // For now, fall through to mock
    console.log('ANTHROPIC_API_KEY is set — real AI parsing would run here');
  }

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return getMockParsedData();
}
