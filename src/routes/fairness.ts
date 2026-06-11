import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { enumToKebab } from '../utils/serialize.js';
import { computeAssessment } from '../services/fairness/engine.js';
import { parseBidDocument } from '../services/ai/bid-parser.js';
import type { FairPriceAssessment, ScopeLineItem, BidLineItem } from '@prisma/client';

const scopeLineSchema = z.object({
  description: z.string().min(1),
  category: z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'ALLOWANCE', 'GENERAL']).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  laborTaskCode: z.string().optional(),
  materialCode: z.string().optional(),
  csiCode: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

const computeSchema = z.object({ bidId: z.string().optional() });
const documentSchema = z.object({ rawText: z.string().min(1), fileName: z.string().optional() });

function serializeScopeLine(s: ScopeLineItem) {
  return {
    id: s.id,
    tradeId: s.tradeId,
    description: s.description,
    category: enumToKebab(s.category),
    quantity: s.quantity,
    unit: s.unit,
    laborTaskCode: s.laborTaskCode ?? undefined,
    materialCode: s.materialCode ?? undefined,
    csiCode: s.csiCode ?? undefined,
    displayOrder: s.displayOrder,
  };
}

function serializeBidLine(l: BidLineItem) {
  return {
    id: l.id,
    bidId: l.bidId,
    scopeLineItemId: l.scopeLineItemId ?? undefined,
    description: l.description,
    kind: enumToKebab(l.kind),
    quantity: l.quantity ?? undefined,
    unit: l.unit ?? undefined,
    unitPriceCents: l.unitPriceCents ?? undefined,
    totalCents: l.totalCents,
    laborCents: l.laborCents ?? undefined,
    materialCents: l.materialCents ?? undefined,
    confidence: l.confidence ?? undefined,
    sourceText: l.sourceText ?? undefined,
  };
}

export function serializeAssessment(a: FairPriceAssessment) {
  return {
    id: a.id,
    tradeId: a.tradeId,
    bidId: a.bidId ?? undefined,
    status: enumToKebab(a.status),
    verdict: a.verdict ? enumToKebab(a.verdict) : undefined,
    bandLowCents: a.bandLowCents,
    bandHighCents: a.bandHighCents,
    bandPct: a.bandPct,
    scopeGate: a.scopeGate,
    layers: a.layers,
    assumptions: a.assumptions,
    marketHeatFactor: a.marketHeatFactor,
    engineVersion: a.engineVersion,
    computedAt: a.computedAt.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString() ?? undefined,
  };
}

/** Latest assessment per (bidId | trade-level), newest first wins. */
function latestAssessments(rows: FairPriceAssessment[]) {
  const byKey = new Map<string, FairPriceAssessment>();
  for (const a of [...rows].sort((x, y) => y.computedAt.getTime() - x.computedAt.getTime())) {
    const key = a.bidId ?? '__trade__';
    if (!byKey.has(key)) byKey.set(key, a);
  }
  return byKey;
}

export async function fairnessRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // --- Scope sheet ---
  app.get<{ Params: { id: string } }>('/api/trades/:id/scope-lines', async (request) => {
    const lines = await prisma.scopeLineItem.findMany({
      where: { tradeId: request.params.id },
      orderBy: { displayOrder: 'asc' },
    });
    return lines.map(serializeScopeLine);
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof scopeLineSchema> }>(
    '/api/trades/:id/scope-lines',
    { preHandler: [requireRole('GC'), validateBody(scopeLineSchema)] },
    async (request) => {
      const trade = await prisma.trade.findUnique({ where: { id: request.params.id } });
      if (!trade) throw new NotFoundError('Trade', request.params.id);
      const count = await prisma.scopeLineItem.count({ where: { tradeId: trade.id } });
      const line = await prisma.scopeLineItem.create({
        data: {
          tradeId: trade.id,
          description: request.body.description,
          category: request.body.category ?? 'GENERAL',
          quantity: request.body.quantity,
          unit: request.body.unit,
          laborTaskCode: request.body.laborTaskCode,
          materialCode: request.body.materialCode,
          csiCode: request.body.csiCode,
          displayOrder: request.body.displayOrder ?? count,
        },
      });
      return serializeScopeLine(line);
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<z.infer<typeof scopeLineSchema>> }>(
    '/api/scope-lines/:id',
    { preHandler: [requireRole('GC'), validateBody(scopeLineSchema.partial())] },
    async (request) => {
      const existing = await prisma.scopeLineItem.findUnique({ where: { id: request.params.id } });
      if (!existing) throw new NotFoundError('ScopeLineItem', request.params.id);
      const line = await prisma.scopeLineItem.update({
        where: { id: existing.id },
        data: request.body,
      });
      return serializeScopeLine(line);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/scope-lines/:id',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const existing = await prisma.scopeLineItem.findUnique({ where: { id: request.params.id } });
      if (!existing) throw new NotFoundError('ScopeLineItem', request.params.id);
      await prisma.bidLineItem.updateMany({
        where: { scopeLineItemId: existing.id },
        data: { scopeLineItemId: null },
      });
      await prisma.scopeLineItem.delete({ where: { id: existing.id } });
      return { deleted: true };
    },
  );

  // --- Leveling matrix ---
  app.get<{ Params: { id: string } }>('/api/trades/:id/leveling', async (request) => {
    const trade = await prisma.trade.findUnique({
      where: { id: request.params.id },
      include: {
        scopeLineItems: { orderBy: { displayOrder: 'asc' } },
        bids: { include: { subcontractor: true, lineItems: true } },
      },
    });
    if (!trade) throw new NotFoundError('Trade', request.params.id);

    return {
      tradeId: trade.id,
      tradeName: trade.name,
      scopeLines: trade.scopeLineItems.map(serializeScopeLine),
      bids: trade.bids
        .filter((b) => b.lineItems.length > 0 || b.status !== 'REQUESTED')
        .map((b) => ({
          bidId: b.id,
          subName: b.subcontractor.company ?? b.subcontractor.name,
          totalCents: Math.round((b.totalAmount ?? 0) * 100),
          status: enumToKebab(b.status),
          cells: Object.fromEntries(
            b.lineItems
              .filter((l) => l.scopeLineItemId)
              .map((l) => [l.scopeLineItemId, { totalCents: l.totalCents, kind: enumToKebab(l.kind), description: l.description }]),
          ),
          extras: b.lineItems.filter((l) => !l.scopeLineItemId).map(serializeBidLine),
        })),
    };
  });

  // --- Assessments ---
  app.post<{ Params: { id: string }; Body: z.infer<typeof computeSchema> }>(
    '/api/trades/:id/assessments/compute',
    { preHandler: [requireRole('GC'), validateBody(computeSchema)] },
    async (request) => {
      const assessment = await computeAssessment(request.params.id, request.body.bidId);
      return serializeAssessment(assessment);
    },
  );

  app.get<{ Params: { id: string } }>('/api/trades/:id/assessments', async (request) => {
    const rows = await prisma.fairPriceAssessment.findMany({ where: { tradeId: request.params.id } });
    const latest = latestAssessments(rows);
    const isOwner = request.user.role === 'OWNER';
    return [...latest.values()]
      .filter((a) => !isOwner || a.status === 'CLIENT_VISIBLE')
      .map(serializeAssessment);
  });

  app.post<{ Params: { id: string } }>(
    '/api/assessments/:id/review',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const a = await prisma.fairPriceAssessment.findUnique({ where: { id: request.params.id } });
      if (!a) throw new NotFoundError('FairPriceAssessment', request.params.id);
      if (a.status !== 'DRAFT') {
        throw new ValidationError(`Only DRAFT assessments can be reviewed (current: ${a.status})`);
      }
      const updated = await prisma.fairPriceAssessment.update({
        where: { id: a.id },
        data: { status: 'BUILDER_REVIEWED', reviewedById: request.user.id, reviewedAt: new Date() },
      });
      return serializeAssessment(updated);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/assessments/:id/publish',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const a = await prisma.fairPriceAssessment.findUnique({ where: { id: request.params.id } });
      if (!a) throw new NotFoundError('FairPriceAssessment', request.params.id);
      if (a.status === 'BLOCKED_SCOPE_GATE') {
        throw new ValidationError('Blocked assessments cannot be published — resolve the scope gate first.');
      }
      if (a.status !== 'BUILDER_REVIEWED') {
        throw new ValidationError('Assessments must be builder-reviewed before publishing to the client.');
      }
      const updated = await prisma.fairPriceAssessment.update({
        where: { id: a.id },
        data: { status: 'CLIENT_VISIBLE' },
      });
      return serializeAssessment(updated);
    },
  );

  // --- Bid documents + AI parse ---
  app.post<{ Params: { id: string }; Body: z.infer<typeof documentSchema> }>(
    '/api/bids/:id/documents',
    { preHandler: [requireRole('GC'), validateBody(documentSchema)] },
    async (request) => {
      const bid = await prisma.bid.findUnique({ where: { id: request.params.id } });
      if (!bid) throw new NotFoundError('Bid', request.params.id);
      const doc = await prisma.bidDocument.create({
        data: { bidId: bid.id, rawText: request.body.rawText, fileName: request.body.fileName },
      });
      return { id: doc.id, bidId: doc.bidId, fileName: doc.fileName, createdAt: doc.createdAt.toISOString() };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/bids/:id/parse',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const bid = await prisma.bid.findUnique({
        where: { id: request.params.id },
        include: { trade: { include: { scopeLineItems: { orderBy: { displayOrder: 'asc' } } } } },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.id);
      const doc = await prisma.bidDocument.findFirst({
        where: { bidId: bid.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!doc) throw new ValidationError('No bid document to parse — upload the sub’s bid text first.');

      const parsed = await parseBidDocument(
        doc.rawText,
        bid.trade.scopeLineItems.map((s) => ({
          id: s.id,
          description: s.description,
          category: s.category,
          quantity: s.quantity,
          unit: s.unit,
        })),
      );

      // Replace prior AI-parsed lines (confidence != null); keep manual entries.
      await prisma.bidLineItem.deleteMany({ where: { bidId: bid.id, confidence: { not: null } } });
      const created = [];
      for (const line of parsed.lineItems) {
        created.push(
          await prisma.bidLineItem.create({
            data: {
              bidId: bid.id,
              scopeLineItemId: line.scopeLineItemId,
              description: line.description,
              kind: line.kind,
              quantity: line.quantity,
              unit: line.unit,
              unitPriceCents: line.unitPriceCents,
              totalCents: line.totalCents,
              laborCents: line.laborCents,
              materialCents: line.materialCents,
              confidence: line.confidence,
              sourceText: line.sourceText,
            },
          }),
        );
      }
      await prisma.bidDocument.update({
        where: { id: doc.id },
        data: {
          parsedAt: new Date(),
          parseModel: parsed.model,
          parserVersion: parsed.parserVersion,
          parseConfidence: parsed.overallConfidence,
        },
      });

      return {
        documentId: doc.id,
        usedFixture: parsed.usedFixture,
        model: parsed.model,
        overallConfidence: parsed.overallConfidence,
        lineItems: created.map(serializeBidLine),
      };
    },
  );

  // --- Homeowner-facing fairness report ---
  app.get<{ Params: { id: string } }>('/api/projects/:id/fairness-report', async (request) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } });
    if (!project) throw new NotFoundError('Project', request.params.id);

    const isOwner = request.user.role === 'OWNER';

    const trades = await prisma.trade.findMany({
      where: { projectId: project.id, scopeLineItems: { some: {} } },
      orderBy: { displayOrder: 'asc' },
      include: {
        scopeLineItems: { orderBy: { displayOrder: 'asc' } },
        bids: { include: { subcontractor: true } },
        assessments: true,
      },
    });

    return {
      projectId: project.id,
      projectName: project.name,
      projectAddress: project.address,
      generatedAt: new Date().toISOString(),
      trades: trades.map((trade) => {
        const latest = latestAssessments(trade.assessments);
        const tradeLevel = latest.get('__trade__');
        const visible = (a: FairPriceAssessment | undefined) =>
          a && (!isOwner || a.status === 'CLIENT_VISIBLE') ? a : undefined;

        const tradeBand = visible(tradeLevel);
        return {
          tradeId: trade.id,
          tradeName: trade.name,
          category: trade.category,
          status: enumToKebab(trade.status),
          awardedBidId: trade.awardedBidId ?? undefined,
          scopeLines: trade.scopeLineItems.map(serializeScopeLine),
          band: tradeBand
            ? { lowCents: tradeBand.bandLowCents, highCents: tradeBand.bandHighCents, bandPct: tradeBand.bandPct }
            : undefined,
          tradeAssessment: tradeBand ? serializeAssessment(tradeBand) : undefined,
          bids: trade.bids
            .filter((b) => b.status !== 'REQUESTED')
            .map((b) => {
              const a = visible(latest.get(b.id));
              return {
                bidId: b.id,
                subName: b.subcontractor.company ?? b.subcontractor.name,
                totalCents: Math.round((b.totalAmount ?? 0) * 100),
                status: enumToKebab(b.status),
                awarded: trade.awardedBidId === b.id,
                assessment: a ? serializeAssessment(a) : undefined,
                assessmentPending: !a && latest.has(b.id) ? true : undefined,
              };
            }),
        };
      }),
    };
  });
}
