import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeBid, enumToKebab } from '../utils/serialize.js';

const createBidSchema = z.object({
  subcontractorId: z.string(),
  totalAmount: z.number().optional(),
  laborCost: z.number().optional(),
  materialCost: z.number().optional(),
  markupPercent: z.number().optional(),
  timeline: z.string().optional(),
  notes: z.string().optional(),
});

const updateBidSchema = z.object({
  status: z.string().optional(),
  totalAmount: z.number().optional(),
  laborCost: z.number().optional(),
  materialCost: z.number().optional(),
  markupPercent: z.number().optional(),
  timeline: z.string().optional(),
  notes: z.string().optional(),
});

export async function bidRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/trades/:id/bids
  app.get<{ Params: { id: string } }>('/api/trades/:id/bids', async (request) => {
    const bids = await prisma.bid.findMany({
      where: { tradeId: request.params.id },
      include: { subcontractor: true },
      orderBy: { createdAt: 'asc' },
    });
    return bids.map((bid) => serializeBid(bid));
  });

  // POST /api/trades/:id/bids
  app.post<{ Params: { id: string }; Body: z.infer<typeof createBidSchema> }>(
    '/api/trades/:id/bids',
    { preHandler: [requireRole('GC'), validateBody(createBidSchema)] },
    async (request) => {
      const trade = await prisma.trade.findUnique({
        where: { id: request.params.id },
      });
      if (!trade) throw new NotFoundError('Trade', request.params.id);

      const { subcontractorId, ...rest } = request.body;
      const bid = await prisma.bid.create({
        data: {
          trade: { connect: { id: request.params.id } },
          subcontractor: { connect: { id: subcontractorId } },
          ...rest,
        },
        include: { subcontractor: true },
      });
      return serializeBid(bid as any);
    },
  );

  // PATCH /api/bids/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateBidSchema> }>(
    '/api/bids/:id',
    { preHandler: [validateBody(updateBidSchema)] },
    async (request) => {
      const existing = await prisma.bid.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) throw new NotFoundError('Bid', request.params.id);

      const { status, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = status.toUpperCase().replace(/-/g, '_');

      // If status transitions to RECEIVED, set submittedAt
      if (data.status === 'RECEIVED' && !existing.submittedAt) {
        data.submittedAt = new Date();
      }

      const bid = await prisma.bid.update({
        where: { id: request.params.id },
        data,
        include: { subcontractor: true },
      });
      return serializeBid(bid);
    },
  );

  // POST /api/bids/:id/award
  app.post<{ Params: { id: string } }>(
    '/api/bids/:id/award',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const bid = await prisma.bid.findUnique({
        where: { id: request.params.id },
        include: { subcontractor: true },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.id);

      const [updatedBid] = await prisma.$transaction([
        // Set bid status to AWARDED
        prisma.bid.update({
          where: { id: bid.id },
          data: { status: 'AWARDED' },
          include: { subcontractor: true },
        }),
        // Update trade: set awardedBidId and status to AWARDED
        prisma.trade.update({
          where: { id: bid.tradeId },
          data: {
            awardedBidId: bid.id,
            status: 'AWARDED',
          },
        }),
        // Update corresponding budgetLineItem with bid amounts
        prisma.budgetLineItem.upsert({
          where: { tradeId: bid.tradeId },
          update: {
            bidAmount: bid.totalAmount ?? 0,
            committed: bid.totalAmount ?? 0,
          },
          create: {
            tradeId: bid.tradeId,
            estimated: 0,
            bidAmount: bid.totalAmount ?? 0,
            committed: bid.totalAmount ?? 0,
          },
        }),
      ]);

      return serializeBid(updatedBid);
    },
  );

  // GET /api/trades/:id/bids/comparison
  app.get<{ Params: { id: string } }>('/api/trades/:id/bids/comparison', async (request) => {
    const trade = await prisma.trade.findUnique({
      where: { id: request.params.id },
    });
    if (!trade) throw new NotFoundError('Trade', request.params.id);

    const bids = await prisma.bid.findMany({
      where: {
        tradeId: request.params.id,
        status: { in: ['RECEIVED', 'AWARDED'] },
      },
      include: { subcontractor: true },
      orderBy: { totalAmount: 'asc' },
    });

    const amounts = bids
      .map((b) => b.totalAmount ?? 0)
      .filter((a) => a > 0);

    const lowest = amounts.length > 0 ? Math.min(...amounts) : 0;
    const highest = amounts.length > 0 ? Math.max(...amounts) : 0;
    const spread = lowest > 0
      ? Math.round(((highest - lowest) / lowest) * 10000) / 100
      : 0;

    return {
      tradeId: trade.id,
      tradeName: trade.name,
      bidCount: bids.length,
      stats: {
        lowest,
        highest,
        spreadPercent: spread,
      },
      bids: bids.map((bid) => ({
        ...serializeBid(bid),
        breakdown: {
          labor: bid.laborCost ?? 0,
          material: bid.materialCost ?? 0,
          markup: bid.markupPercent ?? 0,
        },
      })),
    };
  });
}
