import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeTrade, kebabToEnum } from '../utils/serialize.js';

const createTradeSchema = z.object({
  name: z.string(),
  category: z.string(),
  estimatedLow: z.number().optional(),
  estimatedHigh: z.number().optional(),
  description: z.string().optional(),
});

const updateTradeSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  estimatedLow: z.number().optional(),
  estimatedHigh: z.number().optional(),
  description: z.string().optional(),
});

export async function tradeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/trades
  app.get<{ Params: { id: string } }>('/api/projects/:id/trades', async (request) => {
    const trades = await prisma.trade.findMany({
      where: { projectId: request.params.id },
      orderBy: { displayOrder: 'asc' },
    });
    return trades.map(serializeTrade);
  });

  // POST /api/projects/:id/trades
  app.post<{ Params: { id: string }; Body: z.infer<typeof createTradeSchema> }>(
    '/api/projects/:id/trades',
    { preHandler: [requireRole('GC'), validateBody(createTradeSchema)] },
    async (request) => {
      const maxOrder = await prisma.trade.findFirst({
        where: { projectId: request.params.id },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      const trade = await prisma.trade.create({
        data: {
          projectId: request.params.id,
          displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
          ...request.body,
        },
      });
      return serializeTrade(trade);
    },
  );

  // PATCH /api/trades/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateTradeSchema> }>(
    '/api/trades/:id',
    { preHandler: [validateBody(updateTradeSchema)] },
    async (request) => {
      const { status, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);

      const trade = await prisma.trade.update({
        where: { id: request.params.id },
        data,
      });
      return serializeTrade(trade);
    },
  );

  // DELETE /api/trades/:id
  app.delete<{ Params: { id: string } }>(
    '/api/trades/:id',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      const trade = await prisma.trade.findUnique({ where: { id: request.params.id } });
      if (!trade) throw new NotFoundError('Trade', request.params.id);
      if (trade.status !== 'NOT_STARTED') {
        throw new Error('Can only delete trades that have not started');
      }
      await prisma.trade.delete({ where: { id: request.params.id } });
      return { success: true };
    },
  );
}
