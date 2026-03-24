import type {
  User, Project, Trade, Bid, Subcontractor, BudgetLineItem,
  ChangeOrder, Payment, MaterialItem, Selection, Inspection,
  SavingsEntry, ScheduleItem,
} from '@prisma/client';

// --- Enum Conversions ---

const ROLE_TO_FRONTEND: Record<string, string> = {
  OWNER: 'homeowner',
  GC: 'gc',
  ADMIN: 'admin',
};

const ROLE_FROM_FRONTEND: Record<string, string> = {
  homeowner: 'OWNER',
  gc: 'GC',
  admin: 'ADMIN',
};

export function enumToKebab(value: string): string {
  return value.toLowerCase().replace(/_/g, '-');
}

export function kebabToEnum(value: string): string {
  return value.toUpperCase().replace(/-/g, '_');
}

export function roleToFrontend(role: string): string {
  return ROLE_TO_FRONTEND[role] ?? role.toLowerCase();
}

export function roleFromFrontend(role: string): string {
  return ROLE_FROM_FRONTEND[role] ?? role.toUpperCase();
}

// --- Category to Icon mapping ---

const CATEGORY_TO_ICON: Record<string, string> = {
  sitework: 'Shovel',
  foundation: 'Layers',
  framing: 'Frame',
  roofing: 'Home',
  exterior: 'Blocks',
  windows: 'DoorOpen',
  plumbing: 'Droplets',
  electrical: 'Zap',
  hvac: 'Wind',
  insulation: 'Thermometer',
  drywall: 'Square',
  trim: 'Ruler',
  painting: 'Paintbrush',
  flooring: 'Grid3x3',
  tile: 'LayoutGrid',
  cabinets: 'Archive',
  'plumbing-finish': 'Droplets',
  'electrical-finish': 'Zap',
  landscaping: 'TreePine',
  cleanup: 'Sparkles',
};

// --- Serializers ---

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleToFrontend(user.role),
    avatar: user.avatar ?? undefined,
  };
}

export function serializeProject(project: Project & { owner: User; gc: User | null }) {
  return {
    id: project.id,
    name: project.name,
    address: project.address,
    owner: serializeUser(project.owner),
    gc: project.gc ? serializeUser(project.gc) : undefined,
    status: enumToKebab(project.status),
    totalBudget: project.totalBudget ?? 0,
    gcFeeModel: enumToKebab(project.gcFeeModel),
    gcFeeAmount: project.gcFeeAmount,
    createdAt: project.createdAt.toISOString(),
    squareFootage: project.squareFootage ?? 0,
  };
}

export function serializeTrade(trade: Trade) {
  return {
    id: trade.id,
    projectId: trade.projectId,
    name: trade.name,
    category: trade.category,
    icon: CATEGORY_TO_ICON[trade.category] ?? 'Wrench',
    status: enumToKebab(trade.status),
    estimatedCost: { low: trade.estimatedLow ?? 0, high: trade.estimatedHigh ?? 0 },
    awardedBidId: trade.awardedBidId ?? undefined,
    description: trade.description ?? undefined,
  };
}

export function serializeSubcontractor(sub: Subcontractor) {
  return {
    id: sub.id,
    name: sub.name,
    company: sub.company ?? '',
    email: sub.email,
    phone: sub.phone ?? '',
    rating: sub.rating ?? undefined,
    pastProjects: sub.pastProjects ?? undefined,
  };
}

export function serializeBid(bid: Bid & { subcontractor: Subcontractor }) {
  return {
    id: bid.id,
    tradeId: bid.tradeId,
    subcontractor: serializeSubcontractor(bid.subcontractor),
    totalAmount: bid.totalAmount ?? 0,
    laborCost: bid.laborCost ?? 0,
    materialCost: bid.materialCost ?? 0,
    markupPercent: bid.markupPercent ?? 0,
    timeline: bid.timeline ?? '',
    status: enumToKebab(bid.status),
    submittedAt: bid.submittedAt?.toISOString() ?? undefined,
    notes: bid.notes ?? undefined,
  };
}

export function serializeBudgetLineItem(
  item: BudgetLineItem & { trade: Trade },
  gcFeeModel: string,
  gcFeeAmount: number,
) {
  const gcMarkup = item.committed > 0 && gcFeeModel === 'PERCENTAGE'
    ? item.committed * (gcFeeAmount / 100)
    : 0;
  const totalWithMarkup = item.committed + gcMarkup;
  const variance = item.bidAmount - item.estimated;

  return {
    id: item.id,
    tradeId: item.tradeId,
    tradeName: item.trade.name,
    estimated: item.estimated,
    bidAmount: item.bidAmount,
    committed: item.committed,
    actualToDate: item.actualToDate,
    gcMarkup: Math.round(gcMarkup * 100) / 100,
    totalWithMarkup: Math.round(totalWithMarkup * 100) / 100,
    variance,
  };
}

export function serializeChangeOrder(co: ChangeOrder & { initiatedBy: { name: string } }) {
  return {
    id: co.id,
    projectId: co.projectId,
    number: co.number,
    description: co.description,
    reason: enumToKebab(co.reason),
    initiatedBy: co.initiatedBy.name,
    tradesAffected: co.tradesAffected,
    costImpact: co.costImpact,
    scheduleImpact: co.scheduleImpact,
    status: enumToKebab(co.status),
    createdAt: co.createdAt.toISOString(),
  };
}

export function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    projectId: payment.projectId,
    drawNumber: payment.drawNumber,
    milestone: payment.milestone,
    amount: payment.amount,
    payee: payment.payee,
    tradeId: payment.tradeId ?? undefined,
    invoiceNumber: payment.invoiceNumber ?? undefined,
    status: enumToKebab(payment.status),
    scheduledDate: payment.scheduledDate.toISOString(),
    paidDate: payment.paidDate?.toISOString() ?? undefined,
  };
}

export function serializeMaterial(item: MaterialItem) {
  return {
    id: item.id,
    projectId: item.projectId,
    name: item.name,
    specification: item.specification ?? '',
    category: item.category,
    supplier: item.supplier ?? '',
    unitCost: item.unitCost ?? 0,
    quantity: item.quantity ?? 0,
    totalCost: item.totalCost ?? 0,
    leadTimeDays: item.leadTimeDays ?? 0,
    orderDate: item.orderDate?.toISOString() ?? undefined,
    expectedDelivery: item.expectedDelivery?.toISOString() ?? undefined,
    neededByDate: item.neededByDate?.toISOString() ?? undefined,
    status: enumToKebab(item.status),
  };
}

export function serializeSelection(sel: Selection) {
  const overUnder = (sel.selectedCost ?? 0) - sel.allowanceAmount;
  return {
    id: sel.id,
    projectId: sel.projectId,
    category: sel.category,
    allowanceAmount: sel.allowanceAmount,
    selectedProduct: sel.selectedProduct ?? undefined,
    selectedCost: sel.selectedCost ?? undefined,
    overUnder,
    status: enumToKebab(sel.status),
    photo: sel.photoUrl ?? undefined,
  };
}

export function serializeInspection(insp: Inspection) {
  return {
    id: insp.id,
    projectId: insp.projectId,
    type: insp.type,
    requiredDate: insp.requiredDate?.toISOString() ?? undefined,
    scheduledDate: insp.scheduledDate?.toISOString() ?? undefined,
    inspector: insp.inspector ?? undefined,
    result: insp.result ? enumToKebab(insp.result) : undefined,
    notes: insp.notes ?? undefined,
    corrections: insp.corrections ?? undefined,
    reInspectionDate: insp.reInspectionDate?.toISOString() ?? undefined,
  };
}

export function serializeSavingsEntry(entry: SavingsEntry) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    date: entry.date.toISOString(),
    category: enumToKebab(entry.category),
    description: entry.description,
    amountSaved: entry.amountSaved,
  };
}

export function serializeScheduleItem(item: ScheduleItem) {
  return {
    id: item.id,
    tradeName: item.name,
    phase: item.phase,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
    progress: item.progress,
    status: enumToKebab(item.status),
    dependencies: item.dependencies.length > 0 ? item.dependencies : undefined,
    isMilestone: item.isMilestone || undefined,
  };
}
