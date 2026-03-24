import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.changeOrder.deleteMany();
  await prisma.savingsEntry.deleteMany();
  await prisma.scheduleItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.selection.deleteMany();
  await prisma.materialItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.budgetLineItem.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.scopeDocument.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.planParsedData.deleteMany();
  await prisma.planSheet.deleteMany();
  await prisma.planSet.deleteMany();
  await prisma.subcontractor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // --- Users ---
  const owner = await prisma.user.create({
    data: { id: 'u1', email: 'sarah@email.com', name: 'Sarah Henderson', role: 'OWNER' },
  });
  const gc = await prisma.user.create({
    data: { id: 'u2', email: 'mike@torresbuilders.com', name: 'Mike Torres', role: 'GC' },
  });

  // --- Project ---
  await prisma.project.create({
    data: {
      id: 'p1',
      name: 'The Henderson Residence',
      address: '1842 Oakwood Drive, Austin, TX 78703',
      status: 'ACTIVE',
      totalBudget: 875000,
      gcFeeModel: 'PERCENTAGE',
      gcFeeAmount: 18,
      squareFootage: 3500,
      stories: 2,
      bedroomCount: 4,
      bathroomCount: 3.5,
      createdAt: new Date('2025-06-01'),
      ownerId: owner.id,
      gcId: gc.id,
    },
  });

  // --- Subcontractors ---
  const subsData = [
    { id: 's1', name: 'Carlos Reyes', company: 'Reyes Concrete', email: 'carlos@reyesconcrete.com', phone: '512-555-0101', rating: 4.8, pastProjects: 12, trades: ['foundation'] },
    { id: 's2', name: 'Jim Brady', company: 'Brady Foundation Works', email: 'jim@bradyfound.com', phone: '512-555-0102', rating: 4.5, pastProjects: 8, trades: ['foundation'] },
    { id: 's3', name: 'Nguyen Brothers', company: 'Nguyen Concrete LLC', email: 'info@nguyenconcrete.com', phone: '512-555-0103', rating: 4.2, pastProjects: 5, trades: ['foundation'] },
    { id: 's4', name: 'Tom Wells', company: 'Wells Framing Co', email: 'tom@wellsframing.com', phone: '512-555-0104', rating: 4.9, pastProjects: 20, trades: ['framing'] },
    { id: 's5', name: 'Jake Morrison', company: 'Morrison Carpentry', email: 'jake@morrisonc.com', phone: '512-555-0105', rating: 4.3, pastProjects: 6, trades: ['framing'] },
    { id: 's6', name: 'Dave Kowalski', company: 'DK Framing', email: 'dave@dkframing.com', phone: '512-555-0106', rating: 4.6, pastProjects: 15, trades: ['framing'] },
    { id: 's7', name: 'Maria Santos', company: 'Santos Windows', email: 'maria@santoswin.com', phone: '512-555-0107', rating: 4.7, pastProjects: 10, trades: ['windows'] },
    { id: 's8', name: 'Peak Roofing', company: 'Peak Roofing LLC', email: 'info@peakroof.com', phone: '512-555-0108', rating: 4.4, pastProjects: 18, trades: ['roofing'] },
    { id: 's9', name: 'Skyline Roofing', company: 'Skyline Roofing', email: 'bids@skyline.com', phone: '512-555-0109', rating: 4.1, pastProjects: 7, trades: ['roofing'] },
    { id: 's10', name: 'Tex Roofing', company: 'Texas Roofing Pro', email: 'tex@texroof.com', phone: '512-555-0110', rating: 4.6, pastProjects: 22, trades: ['roofing'] },
    { id: 's11', name: 'Cool Air HVAC', company: 'Cool Air Systems', email: 'info@coolair.com', phone: '512-555-0111', rating: 4.8, pastProjects: 30, trades: ['hvac'] },
  ];
  for (const s of subsData) {
    await prisma.subcontractor.create({ data: s });
  }

  // --- Trades ---
  const tradesData = [
    { id: 't1', projectId: 'p1', name: 'Site Work / Excavation', category: 'sitework', displayOrder: 1, status: 'COMPLETE' as const, estimatedLow: 12000, estimatedHigh: 18000, description: 'Clearing, grading, and excavation for foundation.' },
    { id: 't2', projectId: 'p1', name: 'Foundation / Concrete', category: 'foundation', displayOrder: 2, status: 'COMPLETE' as const, estimatedLow: 35000, estimatedHigh: 50000, awardedBidId: 'b1' },
    { id: 't3', projectId: 'p1', name: 'Framing', category: 'framing', displayOrder: 3, status: 'IN_PROGRESS' as const, estimatedLow: 55000, estimatedHigh: 75000, awardedBidId: 'b4' },
    { id: 't4', projectId: 'p1', name: 'Roofing', category: 'roofing', displayOrder: 4, status: 'OUT_FOR_BID' as const, estimatedLow: 18000, estimatedHigh: 28000 },
    { id: 't5', projectId: 'p1', name: 'Exterior Siding / Masonry', category: 'exterior', displayOrder: 5, status: 'SCOPE_WRITTEN' as const, estimatedLow: 25000, estimatedHigh: 40000 },
    { id: 't6', projectId: 'p1', name: 'Windows & Doors', category: 'windows', displayOrder: 6, status: 'AWARDED' as const, estimatedLow: 30000, estimatedHigh: 48000, awardedBidId: 'b7' },
    { id: 't7', projectId: 'p1', name: 'Plumbing Rough-In', category: 'plumbing', displayOrder: 7, status: 'OUT_FOR_BID' as const, estimatedLow: 15000, estimatedHigh: 22000 },
    { id: 't8', projectId: 'p1', name: 'Electrical Rough-In', category: 'electrical', displayOrder: 8, status: 'OUT_FOR_BID' as const, estimatedLow: 14000, estimatedHigh: 22000 },
    { id: 't9', projectId: 'p1', name: 'HVAC', category: 'hvac', displayOrder: 9, status: 'AWARDED' as const, estimatedLow: 18000, estimatedHigh: 28000, awardedBidId: 'b10' },
    { id: 't10', projectId: 'p1', name: 'Insulation', category: 'insulation', displayOrder: 10, status: 'NOT_STARTED' as const, estimatedLow: 6000, estimatedHigh: 10000 },
    { id: 't11', projectId: 'p1', name: 'Drywall', category: 'drywall', displayOrder: 11, status: 'NOT_STARTED' as const, estimatedLow: 18000, estimatedHigh: 26000 },
    { id: 't12', projectId: 'p1', name: 'Interior Trim / Millwork', category: 'trim', displayOrder: 12, status: 'NOT_STARTED' as const, estimatedLow: 15000, estimatedHigh: 25000 },
    { id: 't13', projectId: 'p1', name: 'Painting', category: 'painting', displayOrder: 13, status: 'NOT_STARTED' as const, estimatedLow: 10000, estimatedHigh: 16000 },
    { id: 't14', projectId: 'p1', name: 'Flooring', category: 'flooring', displayOrder: 14, status: 'SCOPE_WRITTEN' as const, estimatedLow: 15000, estimatedHigh: 28000 },
    { id: 't15', projectId: 'p1', name: 'Tile', category: 'tile', displayOrder: 15, status: 'NOT_STARTED' as const, estimatedLow: 8000, estimatedHigh: 15000 },
    { id: 't16', projectId: 'p1', name: 'Cabinets & Countertops', category: 'cabinets', displayOrder: 16, status: 'SCOPE_WRITTEN' as const, estimatedLow: 25000, estimatedHigh: 45000 },
    { id: 't17', projectId: 'p1', name: 'Plumbing Finish', category: 'plumbing-finish', displayOrder: 17, status: 'NOT_STARTED' as const, estimatedLow: 8000, estimatedHigh: 14000 },
    { id: 't18', projectId: 'p1', name: 'Electrical Finish', category: 'electrical-finish', displayOrder: 18, status: 'NOT_STARTED' as const, estimatedLow: 6000, estimatedHigh: 10000 },
    { id: 't19', projectId: 'p1', name: 'Landscaping', category: 'landscaping', displayOrder: 19, status: 'NOT_STARTED' as const, estimatedLow: 12000, estimatedHigh: 22000 },
    { id: 't20', projectId: 'p1', name: 'Cleanup / Final Grade', category: 'cleanup', displayOrder: 20, status: 'NOT_STARTED' as const, estimatedLow: 3000, estimatedHigh: 6000 },
  ];
  for (const t of tradesData) {
    await prisma.trade.create({ data: t });
  }

  // --- Bids ---
  // Note: b10 in frontend is for t4 (roofing), but awardedBidId on t9 is 'b10'.
  // Frontend mock has b10 on t4 and b11 on t9. But t9.awardedBidId = 'b10'.
  // Looking at the data: t9 HVAC awardedBidId='b10', but bid b10 has tradeId='t4'.
  // This is a frontend inconsistency. The HVAC bid b11 has tradeId='t9'.
  // We'll fix this: t9.awardedBidId should be 'b11'.
  // Update trade t9 after bids are created.

  const bidsData = [
    { id: 'b1', tradeId: 't2', subcontractorId: 's1', totalAmount: 42000, laborCost: 24000, materialCost: 14000, markupPercent: 10, timeline: '3 weeks', status: 'AWARDED' as const, submittedAt: new Date('2025-07-05') },
    { id: 'b2', tradeId: 't2', subcontractorId: 's2', totalAmount: 47500, laborCost: 28000, materialCost: 15000, markupPercent: 12, timeline: '4 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-07-08') },
    { id: 'b3', tradeId: 't2', subcontractorId: 's3', totalAmount: 44800, laborCost: 26000, materialCost: 14800, markupPercent: 10, timeline: '3.5 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-07-06') },
    { id: 'b4', tradeId: 't3', subcontractorId: 's4', totalAmount: 62000, laborCost: 38000, materialCost: 18000, markupPercent: 10, timeline: '5 weeks', status: 'AWARDED' as const, submittedAt: new Date('2025-08-10') },
    { id: 'b5', tradeId: 't3', subcontractorId: 's5', totalAmount: 68500, laborCost: 42000, materialCost: 20000, markupPercent: 10, timeline: '6 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-08-12') },
    { id: 'b6', tradeId: 't3', subcontractorId: 's6', totalAmount: 64200, laborCost: 39000, materialCost: 19200, markupPercent: 10, timeline: '5 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-08-11') },
    { id: 'b7', tradeId: 't6', subcontractorId: 's7', totalAmount: 38500, laborCost: 8000, materialCost: 27000, markupPercent: 10, timeline: '8-10 weeks lead', status: 'AWARDED' as const, submittedAt: new Date('2025-08-20') },
    { id: 'b8', tradeId: 't4', subcontractorId: 's8', totalAmount: 24200, laborCost: 14000, materialCost: 8200, markupPercent: 10, timeline: '2 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-11-01') },
    { id: 'b9', tradeId: 't4', subcontractorId: 's9', totalAmount: 27800, laborCost: 16000, materialCost: 9000, markupPercent: 10, timeline: '2.5 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-11-03') },
    { id: 'b10', tradeId: 't4', subcontractorId: 's10', totalAmount: 22500, laborCost: 13000, materialCost: 7500, markupPercent: 10, timeline: '2 weeks', status: 'RECEIVED' as const, submittedAt: new Date('2025-11-02') },
    { id: 'b11', tradeId: 't9', subcontractorId: 's11', totalAmount: 24000, laborCost: 12000, materialCost: 10000, markupPercent: 8, timeline: '2 weeks', status: 'AWARDED' as const, submittedAt: new Date('2025-09-15') },
  ];
  for (const b of bidsData) {
    await prisma.bid.create({ data: b });
  }

  // Fix t9 awardedBidId to match b11 (the actual HVAC bid)
  await prisma.trade.update({ where: { id: 't9' }, data: { awardedBidId: 'b11' } });

  // --- Budget Line Items ---
  const budgetData = [
    { id: 'bl1', tradeId: 't1', estimated: 15000, bidAmount: 13800, committed: 13800, actualToDate: 13800 },
    { id: 'bl2', tradeId: 't2', estimated: 42500, bidAmount: 42000, committed: 42000, actualToDate: 42000 },
    { id: 'bl3', tradeId: 't3', estimated: 65000, bidAmount: 62000, committed: 62000, actualToDate: 38000 },
    { id: 'bl4', tradeId: 't4', estimated: 23000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl5', tradeId: 't5', estimated: 32000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl6', tradeId: 't6', estimated: 38000, bidAmount: 38500, committed: 38500, actualToDate: 27000 },
    { id: 'bl7', tradeId: 't7', estimated: 18000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl8', tradeId: 't8', estimated: 17500, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl9', tradeId: 't9', estimated: 23000, bidAmount: 24000, committed: 24000, actualToDate: 0 },
    { id: 'bl10', tradeId: 't10', estimated: 8000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl11', tradeId: 't11', estimated: 22000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl12', tradeId: 't12', estimated: 20000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl13', tradeId: 't13', estimated: 13000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl14', tradeId: 't14', estimated: 22000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl15', tradeId: 't15', estimated: 12000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl16', tradeId: 't16', estimated: 35000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl17', tradeId: 't17', estimated: 11000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl18', tradeId: 't18', estimated: 8000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl19', tradeId: 't19', estimated: 17000, bidAmount: 0, committed: 0, actualToDate: 0 },
    { id: 'bl20', tradeId: 't20', estimated: 4500, bidAmount: 0, committed: 0, actualToDate: 0 },
  ];
  for (const bl of budgetData) {
    await prisma.budgetLineItem.create({ data: bl });
  }

  // --- Change Orders ---
  const changeOrdersData = [
    { id: 'co1', projectId: 'p1', number: 1, description: 'Upgrade master bath to heated floors — added Warmly radiant system under tile.', reason: 'OWNER_REQUEST' as const, initiatedById: 'u1', tradesAffected: ['Tile', 'Electrical Rough-In'], costImpact: 4200, scheduleImpact: 2, status: 'APPROVED' as const, createdAt: new Date('2025-09-15') },
    { id: 'co2', projectId: 'p1', number: 2, description: 'Structural engineer required additional beam at great room span — field condition discovered during framing.', reason: 'FIELD_CONDITION' as const, initiatedById: 'u2', tradesAffected: ['Framing'], costImpact: 3800, scheduleImpact: 3, status: 'APPROVED' as const, createdAt: new Date('2025-10-02') },
    { id: 'co3', projectId: 'p1', number: 3, description: 'Add outdoor kitchen gas line and electrical — owner added outdoor kitchen after initial design.', reason: 'OWNER_REQUEST' as const, initiatedById: 'u1', tradesAffected: ['Plumbing Rough-In', 'Electrical Rough-In'], costImpact: 6500, scheduleImpact: 0, status: 'PENDING_APPROVAL' as const, createdAt: new Date('2025-11-10') },
    { id: 'co4', projectId: 'p1', number: 4, description: 'Relocate laundry room plumbing per architect revision to flip mudroom layout.', reason: 'ARCHITECT_REVISION' as const, initiatedById: 'u2', tradesAffected: ['Plumbing Rough-In', 'Framing'], costImpact: 2100, scheduleImpact: 1, status: 'DRAFT' as const, createdAt: new Date('2025-11-18') },
    { id: 'co5', projectId: 'p1', number: 5, description: 'Fire sprinkler system required by updated city code for homes over 3,000 sq ft.', reason: 'CODE_REQUIREMENT' as const, initiatedById: 'u2', tradesAffected: ['Plumbing Rough-In'], costImpact: 8500, scheduleImpact: 5, status: 'PENDING_APPROVAL' as const, createdAt: new Date('2025-11-22') },
  ];
  for (const co of changeOrdersData) {
    await prisma.changeOrder.create({ data: co });
  }

  // --- Payments ---
  const paymentsData = [
    { id: 'pay1', projectId: 'p1', drawNumber: 1, milestone: 'Foundation Complete', amount: 65844, payee: 'Torres Builders', status: 'PAID' as const, scheduledDate: new Date('2025-08-15'), paidDate: new Date('2025-08-18') },
    { id: 'pay2', projectId: 'p1', drawNumber: 2, milestone: 'Framing 50% Complete', amount: 42000, payee: 'Torres Builders', status: 'PAID' as const, scheduledDate: new Date('2025-10-01'), paidDate: new Date('2025-10-04') },
    { id: 'pay3', projectId: 'p1', drawNumber: 3, milestone: 'Framing & Roof Complete', amount: 85000, payee: 'Torres Builders', status: 'READY' as const, scheduledDate: new Date('2025-12-01') },
    { id: 'pay4', projectId: 'p1', drawNumber: 4, milestone: 'Rough-Ins Complete', amount: 78000, payee: 'Torres Builders', status: 'UPCOMING' as const, scheduledDate: new Date('2026-01-15') },
    { id: 'pay5', projectId: 'p1', drawNumber: 5, milestone: 'Drywall & Interior Start', amount: 92000, payee: 'Torres Builders', status: 'UPCOMING' as const, scheduledDate: new Date('2026-03-01') },
    { id: 'pay6', projectId: 'p1', drawNumber: 6, milestone: 'Finishes Complete', amount: 115000, payee: 'Torres Builders', status: 'UPCOMING' as const, scheduledDate: new Date('2026-04-15') },
    { id: 'pay7', projectId: 'p1', drawNumber: 7, milestone: 'Final / Certificate of Occupancy', amount: 45000, payee: 'Torres Builders', status: 'UPCOMING' as const, scheduledDate: new Date('2026-05-30') },
  ];
  for (const p of paymentsData) {
    await prisma.payment.create({ data: p });
  }

  // --- Materials ---
  const materialsData = [
    { id: 'm1', projectId: 'p1', name: 'Andersen 400 Series Windows (lot)', specification: 'Double-hung, Low-E, 15 units assorted sizes', category: 'Windows & Doors', supplier: 'BuilderDirect', unitCost: 420, quantity: 15, totalCost: 6300, leadTimeDays: 42, orderDate: new Date('2025-09-01'), expectedDelivery: new Date('2025-10-13'), neededByDate: new Date('2025-11-01'), status: 'DELIVERED' as const },
    { id: 'm2', projectId: 'p1', name: 'Standing Seam Metal Roof Panels', specification: '24-gauge Galvalume, Matte Black', category: 'Roofing', supplier: 'MetalSales Inc', unitCost: 4.50, quantity: 3800, totalCost: 17100, leadTimeDays: 21, neededByDate: new Date('2025-12-15'), status: 'NOT_ORDERED' as const },
    { id: 'm3', projectId: 'p1', name: 'Engineered Hardwood Flooring', specification: 'White Oak, 7" wide plank, matte finish', category: 'Flooring', supplier: 'Lumber Liquidators', unitCost: 6.80, quantity: 2200, totalCost: 14960, leadTimeDays: 14, neededByDate: new Date('2026-02-15'), status: 'NOT_ORDERED' as const },
    { id: 'm4', projectId: 'p1', name: 'Kitchen Cabinets', specification: 'Shaker style, maple, soft-close', category: 'Cabinets & Countertops', supplier: 'CabinetWorks Custom', unitCost: 18500, quantity: 1, totalCost: 18500, leadTimeDays: 56, neededByDate: new Date('2026-02-01'), status: 'ORDERED' as const, orderDate: new Date('2025-10-15'), expectedDelivery: new Date('2025-12-10') },
    { id: 'm5', projectId: 'p1', name: 'Quartz Countertops', specification: 'Caesarstone Calacatta Nuvo, 3cm', category: 'Cabinets & Countertops', supplier: 'Stone Center Austin', unitCost: 75, quantity: 64, totalCost: 4800, leadTimeDays: 21, neededByDate: new Date('2026-02-15'), status: 'NOT_ORDERED' as const },
    { id: 'm6', projectId: 'p1', name: 'Carrier Infinity HVAC System', specification: '5-ton, 21 SEER, variable speed', category: 'HVAC', supplier: 'Ferguson HVAC', unitCost: 8500, quantity: 1, totalCost: 8500, leadTimeDays: 14, orderDate: new Date('2025-09-20'), expectedDelivery: new Date('2025-10-04'), neededByDate: new Date('2025-11-15'), status: 'DELIVERED' as const },
    { id: 'm7', projectId: 'p1', name: 'Front Entry Door', specification: 'Therma-Tru Fiber-Classic Mahogany, 36x80', category: 'Windows & Doors', supplier: 'BuilderDirect', unitCost: 2800, quantity: 1, totalCost: 2800, leadTimeDays: 35, orderDate: new Date('2025-09-10'), expectedDelivery: new Date('2025-10-15'), neededByDate: new Date('2025-11-15'), status: 'SHIPPED' as const },
    { id: 'm8', projectId: 'p1', name: 'Porcelain Floor Tile', specification: 'Daltile Emser, 24x24, natural stone look', category: 'Tile', supplier: 'Floor & Decor', unitCost: 4.20, quantity: 800, totalCost: 3360, leadTimeDays: 7, neededByDate: new Date('2026-03-01'), status: 'NOT_ORDERED' as const },
    { id: 'm9', projectId: 'p1', name: 'Framing Lumber Package', specification: 'SPF #2, mixed dimensions', category: 'Lumber', supplier: '84 Lumber', unitCost: 18000, quantity: 1, totalCost: 18000, leadTimeDays: 7, orderDate: new Date('2025-08-20'), expectedDelivery: new Date('2025-08-27'), neededByDate: new Date('2025-09-01'), status: 'INSTALLED' as const },
    { id: 'm10', projectId: 'p1', name: 'Spray Foam Insulation', specification: 'Closed-cell, R-20 walls, R-38 ceiling', category: 'Insulation', supplier: 'SES Foam LLC', unitCost: 7200, quantity: 1, totalCost: 7200, leadTimeDays: 3, neededByDate: new Date('2026-01-15'), status: 'NOT_ORDERED' as const },
    { id: 'm11', projectId: 'p1', name: 'Recessed LED Lighting Package', specification: 'Halo 6" IC-rated, 42 units', category: 'Lighting', supplier: 'Amazon Business', unitCost: 28, quantity: 42, totalCost: 1176, leadTimeDays: 5, neededByDate: new Date('2026-01-20'), status: 'NOT_ORDERED' as const },
  ];
  for (const m of materialsData) {
    await prisma.materialItem.create({ data: m });
  }

  // --- Selections ---
  const selectionsData = [
    { id: 'sel1', projectId: 'p1', category: 'Cabinets', allowanceAmount: 20000, selectedProduct: 'CabinetWorks Shaker Maple', selectedCost: 18500, status: 'ORDERED' as const },
    { id: 'sel2', projectId: 'p1', category: 'Countertops', allowanceAmount: 5000, selectedProduct: 'Caesarstone Calacatta Nuvo', selectedCost: 4800, status: 'SELECTED' as const },
    { id: 'sel3', projectId: 'p1', category: 'Flooring', allowanceAmount: 14000, selectedProduct: 'White Oak Engineered Hardwood', selectedCost: 14960, status: 'SELECTED' as const },
    { id: 'sel4', projectId: 'p1', category: 'Tile', allowanceAmount: 4000, selectedProduct: 'Daltile Emser Porcelain', selectedCost: 3360, status: 'SELECTED' as const },
    { id: 'sel5', projectId: 'p1', category: 'Plumbing Fixtures', allowanceAmount: 8000, selectedProduct: 'Kohler Composed Collection', selectedCost: 9200, status: 'SELECTED' as const },
    { id: 'sel6', projectId: 'p1', category: 'Lighting', allowanceAmount: 6000, selectedProduct: 'Mixed — Halo recessed + Schoolhouse pendants', selectedCost: 5400, status: 'NOT_SELECTED' as const },
    { id: 'sel7', projectId: 'p1', category: 'Appliances', allowanceAmount: 12000, selectedProduct: 'Bosch 800 Series Package', selectedCost: 11200, status: 'ORDERED' as const },
    { id: 'sel8', projectId: 'p1', category: 'Paint', allowanceAmount: 3000, selectedProduct: 'Benjamin Moore — Chantilly Lace + Revere Pewter', selectedCost: 2800, status: 'SELECTED' as const },
    { id: 'sel9', projectId: 'p1', category: 'Hardware', allowanceAmount: 2000, status: 'NOT_SELECTED' as const },
  ];
  for (const s of selectionsData) {
    await prisma.selection.create({ data: s });
  }

  // --- Inspections ---
  const inspectionsData = [
    { id: 'i1', projectId: 'p1', type: 'Foundation / Footing', displayOrder: 1, scheduledDate: new Date('2025-08-01'), result: 'PASS' as const, inspector: 'Bob Chen', notes: 'Footings meet spec. Rebar spacing approved.' },
    { id: 'i2', projectId: 'p1', type: 'Slab / Foundation Waterproofing', displayOrder: 2, scheduledDate: new Date('2025-08-10'), result: 'PASS' as const, inspector: 'Bob Chen' },
    { id: 'i3', projectId: 'p1', type: 'Framing (Structural)', displayOrder: 3, scheduledDate: new Date('2025-11-20'), result: 'CONDITIONAL' as const, inspector: 'Lisa Tran', notes: 'Missing hurricane clip at 3 connections. Correct and re-inspect.', corrections: 'Install missing hurricane clips at great room header connections.' },
    { id: 'i4', projectId: 'p1', type: 'Rough Plumbing', displayOrder: 4, requiredDate: new Date('2026-01-10') },
    { id: 'i5', projectId: 'p1', type: 'Rough Electrical', displayOrder: 5, requiredDate: new Date('2026-01-12') },
    { id: 'i6', projectId: 'p1', type: 'Rough HVAC / Mechanical', displayOrder: 6, requiredDate: new Date('2026-01-15') },
    { id: 'i7', projectId: 'p1', type: 'Insulation', displayOrder: 7, requiredDate: new Date('2026-01-25') },
    { id: 'i8', projectId: 'p1', type: 'Final Plumbing', displayOrder: 8, requiredDate: new Date('2026-04-15') },
    { id: 'i9', projectId: 'p1', type: 'Final Electrical', displayOrder: 9, requiredDate: new Date('2026-04-15') },
    { id: 'i10', projectId: 'p1', type: 'Final Building', displayOrder: 10, requiredDate: new Date('2026-05-15') },
    { id: 'i11', projectId: 'p1', type: 'Certificate of Occupancy', displayOrder: 11, requiredDate: new Date('2026-05-30') },
  ];
  for (const i of inspectionsData) {
    await prisma.inspection.create({ data: i });
  }

  // --- Savings Entries ---
  const savingsData = [
    { id: 'sv1', projectId: 'p1', date: new Date('2025-07-10'), category: 'COMPETITIVE_BIDDING' as const, description: 'Foundation: Reyes Concrete was $5,500 less than highest bidder Brady Foundation Works', amountSaved: 5500 },
    { id: 'sv2', projectId: 'p1', date: new Date('2025-08-15'), category: 'COMPETITIVE_BIDDING' as const, description: 'Framing: Wells Framing was $6,500 less than Morrison Carpentry\'s bid', amountSaved: 6500 },
    { id: 'sv3', projectId: 'p1', date: new Date('2025-09-05'), category: 'MATERIAL_SOURCING' as const, description: 'Windows: sourced Andersen 400 series from BuilderDirect vs. local supplier — saved $4,800 on lot', amountSaved: 4800 },
    { id: 'sv4', projectId: 'p1', date: new Date('2025-09-20'), category: 'NEGOTIATION' as const, description: 'HVAC: negotiated 8% markup down from Cool Air\'s standard 15%', amountSaved: 1680 },
    { id: 'sv5', projectId: 'p1', date: new Date('2025-10-01'), category: 'SCOPE_OPTIMIZATION' as const, description: 'Removed unnecessary structural upgrade at garage header after engineer review', amountSaved: 2100 },
    { id: 'sv6', projectId: 'p1', date: new Date('2025-10-15'), category: 'MATERIAL_SOURCING' as const, description: 'Lumber package: 84 Lumber price-matched competitor quote, saving $2,200', amountSaved: 2200 },
    { id: 'sv7', projectId: 'p1', date: new Date('2025-10-28'), category: 'COMPETITIVE_BIDDING' as const, description: 'Site work: third bid revealed first two were 20% over market rate', amountSaved: 3200 },
    { id: 'sv8', projectId: 'p1', date: new Date('2025-11-01'), category: 'MATERIAL_SOURCING' as const, description: 'Kitchen cabinets: CabinetWorks custom bid $1,500 under allowance vs. big box quotes', amountSaved: 1500 },
    { id: 'sv9', projectId: 'p1', date: new Date('2025-11-08'), category: 'NEGOTIATION' as const, description: 'Tile labor rate negotiated down by bundling bathroom and kitchen tile work', amountSaved: 1800 },
    { id: 'sv10', projectId: 'p1', date: new Date('2025-11-15'), category: 'SCOPE_OPTIMIZATION' as const, description: 'Simplified master closet millwork design — saved on trim carpentry without sacrificing function', amountSaved: 1400 },
    { id: 'sv11', projectId: 'p1', date: new Date('2025-11-20'), category: 'MATERIAL_SOURCING' as const, description: 'Recessed lighting: Amazon Business bulk pricing vs. electrical supplier saved $480', amountSaved: 480 },
    { id: 'sv12', projectId: 'p1', date: new Date('2025-11-25'), category: 'COMPETITIVE_BIDDING' as const, description: 'Roofing: 3rd bid from Texas Roofing Pro was $5,300 less than highest', amountSaved: 5300 },
    { id: 'sv13', projectId: 'p1', date: new Date('2025-12-01'), category: 'OTHER' as const, description: 'Countertops: selected quartz at $200 under allowance', amountSaved: 200 },
    { id: 'sv14', projectId: 'p1', date: new Date('2025-12-05'), category: 'NEGOTIATION' as const, description: 'Paint contractor offered 5% discount for booking early', amountSaved: 650 },
    { id: 'sv15', projectId: 'p1', date: new Date('2025-12-10'), category: 'MATERIAL_SOURCING' as const, description: 'Appliance package: Bosch 800 Series from authorized dealer vs. retail saved $800', amountSaved: 800 },
  ];
  for (const sv of savingsData) {
    await prisma.savingsEntry.create({ data: sv });
  }

  // --- Schedule Items ---
  const scheduleData = [
    { id: 'sch1', projectId: 'p1', name: 'Permits & Planning', phase: 'Pre-Construction', startDate: new Date('2025-06-01'), endDate: new Date('2025-07-15'), progress: 100, status: 'COMPLETE' as const, dependencies: [] as string[] },
    { id: 'sch2', projectId: 'p1', name: 'Site Work / Excavation', phase: 'Pre-Construction', startDate: new Date('2025-07-15'), endDate: new Date('2025-07-28'), progress: 100, status: 'COMPLETE' as const, dependencies: [] as string[] },
    { id: 'sch3', projectId: 'p1', name: 'Foundation / Concrete', phase: 'Foundation', startDate: new Date('2025-07-28'), endDate: new Date('2025-08-18'), progress: 100, status: 'COMPLETE' as const, dependencies: ['sch2'] },
    { id: 'sch4', projectId: 'p1', name: 'Framing', phase: 'Framing & Rough-Ins', startDate: new Date('2025-09-01'), endDate: new Date('2025-11-15'), progress: 75, status: 'IN_PROGRESS' as const, dependencies: ['sch3'] },
    { id: 'sch5', projectId: 'p1', name: 'Roofing', phase: 'Exterior Envelope', startDate: new Date('2025-11-20'), endDate: new Date('2025-12-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch4'] },
    { id: 'sch6', projectId: 'p1', name: 'Windows & Doors Install', phase: 'Exterior Envelope', startDate: new Date('2025-12-01'), endDate: new Date('2025-12-20'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch4'] },
    { id: 'sch7', projectId: 'p1', name: 'Exterior Siding / Masonry', phase: 'Exterior Envelope', startDate: new Date('2025-12-15'), endDate: new Date('2026-01-20'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch5', 'sch6'] },
    { id: 'sch8', projectId: 'p1', name: 'Plumbing Rough-In', phase: 'Framing & Rough-Ins', startDate: new Date('2025-12-01'), endDate: new Date('2025-12-20'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch4'] },
    { id: 'sch9', projectId: 'p1', name: 'Electrical Rough-In', phase: 'Framing & Rough-Ins', startDate: new Date('2025-12-01'), endDate: new Date('2025-12-22'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch4'] },
    { id: 'sch10', projectId: 'p1', name: 'HVAC', phase: 'Framing & Rough-Ins', startDate: new Date('2025-12-05'), endDate: new Date('2025-12-20'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch4'] },
    { id: 'sch11', projectId: 'p1', name: 'Insulation', phase: 'Framing & Rough-Ins', startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch8', 'sch9', 'sch10'] },
    { id: 'sch12', projectId: 'p1', name: 'Drywall', phase: 'Interior Finishes', startDate: new Date('2026-01-15'), endDate: new Date('2026-02-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch11'] },
    { id: 'sch13', projectId: 'p1', name: 'Interior Trim / Millwork', phase: 'Interior Finishes', startDate: new Date('2026-02-10'), endDate: new Date('2026-03-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch12'] },
    { id: 'sch14', projectId: 'p1', name: 'Cabinets & Countertops', phase: 'Interior Finishes', startDate: new Date('2026-02-15'), endDate: new Date('2026-03-05'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch12'] },
    { id: 'sch15', projectId: 'p1', name: 'Painting', phase: 'Interior Finishes', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-20'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch13'] },
    { id: 'sch16', projectId: 'p1', name: 'Flooring', phase: 'Interior Finishes', startDate: new Date('2026-03-10'), endDate: new Date('2026-03-28'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch15'] },
    { id: 'sch17', projectId: 'p1', name: 'Tile', phase: 'Interior Finishes', startDate: new Date('2026-03-10'), endDate: new Date('2026-03-25'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch12'] },
    { id: 'sch18', projectId: 'p1', name: 'Plumbing Finish', phase: 'Final / Closeout', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch16', 'sch17'] },
    { id: 'sch19', projectId: 'p1', name: 'Electrical Finish', phase: 'Final / Closeout', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch16'] },
    { id: 'sch20', projectId: 'p1', name: 'Landscaping', phase: 'Final / Closeout', startDate: new Date('2026-04-15'), endDate: new Date('2026-05-10'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch7'] },
    { id: 'sch21', projectId: 'p1', name: 'Final Inspections & CO', phase: 'Final / Closeout', startDate: new Date('2026-05-10'), endDate: new Date('2026-05-30'), progress: 0, status: 'NOT_STARTED' as const, dependencies: ['sch18', 'sch19', 'sch20'], isMilestone: true },
  ];
  for (const sch of scheduleData) {
    await prisma.scheduleItem.create({ data: sch });
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
