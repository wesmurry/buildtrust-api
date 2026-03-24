import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeChangeOrder, kebabToEnum } from '../utils/serialize.js';

const createChangeOrderSchema = z.object({
  description: z.string(),
  reason: z.string(),
  tradesAffected: z.array(z.string()),
  costImpact: z.number(),
  scheduleImpact: z.number(),
});

const updateChangeOrderSchema = z.object({
  description: z.string().optional(),
  reason: z.string().optional(),
  tradesAffected: z.array(z.string()).optional(),
  costImpact: z.number().optional(),
  scheduleImpact: z.number().optional(),
  status: z.string().optional(),
});

export async function changeOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/change-orders
  app.get<{ Params: { id: string } }>('/api/projects/:id/change-orders', async (request) => {
    const changeOrders = await prisma.changeOrder.findMany({
      where: { projectId: request.params.id },
      include: { initiatedBy: true },
    });
    return changeOrders.map((co) => serializeChangeOrder(co as any));
  });

  // POST /api/projects/:id/change-orders
  app.post<{ Params: { id: string }; Body: z.infer<typeof createChangeOrderSchema> }>(
    '/api/projects/:id/change-orders',
    { preHandler: [requireRole('GC'), validateBody(createChangeOrderSchema)] },
    async (request) => {
      const { reason, ...rest } = request.body;

      const maxNumber = await prisma.changeOrder.findFirst({
        where: { projectId: request.params.id },
        orderBy: { number: 'desc' },
        select: { number: true },
      });

      const changeOrder = await prisma.changeOrder.create({
        data: {
          projectId: request.params.id,
          number: (maxNumber?.number ?? 0) + 1,
          reason: kebabToEnum(reason),
          initiatedById: request.user.id,
          ...rest,
        },
        include: { initiatedBy: true },
      });
      return serializeChangeOrder(changeOrder as any);
    },
  );

  // PATCH /api/change-orders/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateChangeOrderSchema> }>(
    '/api/change-orders/:id',
    { preHandler: [validateBody(updateChangeOrderSchema)] },
    async (request) => {
      const { status, reason, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);
      if (reason) data.reason = kebabToEnum(reason);

      const changeOrder = await prisma.changeOrder.update({
        where: { id: request.params.id },
        data,
        include: { initiatedBy: true },
      });
      return serializeChangeOrder(changeOrder as any);
    },
  );

  // POST /api/change-orders/:id/approve
  app.post<{ Params: { id: string } }>(
    '/api/change-orders/:id/approve',
    { preHandler: [requireRole('OWNER')] },
    async (request) => {
      const changeOrder = await prisma.changeOrder.update({
        where: { id: request.params.id },
        data: { status: 'APPROVED' },
        include: { initiatedBy: true },
      });
      return serializeChangeOrder(changeOrder as any);
    },
  );

  // POST /api/change-orders/:id/reject
  app.post<{ Params: { id: string } }>(
    '/api/change-orders/:id/reject',
    { preHandler: [requireRole('OWNER')] },
    async (request) => {
      const changeOrder = await prisma.changeOrder.update({
        where: { id: request.params.id },
        data: { status: 'REJECTED' },
        include: { initiatedBy: true },
      });
      return serializeChangeOrder(changeOrder as any);
    },
  );

  // GET /api/projects/:id/change-orders/impact
  app.get<{ Params: { id: string } }>('/api/projects/:id/change-orders/impact', async (request) => {
    const changeOrders = await prisma.changeOrder.findMany({
      where: { projectId: request.params.id },
    });

    const approved = changeOrders.filter((co) => co.status === 'APPROVED');
    const pending = changeOrders.filter((co) => co.status === 'PENDING_APPROVAL');
    const rejected = changeOrders.filter((co) => co.status === 'REJECTED');

    const totalCostImpact =
      [...approved, ...pending].reduce((sum, co) => sum + co.costImpact, 0);
    const totalScheduleImpact =
      [...approved, ...pending].reduce((sum, co) => sum + co.scheduleImpact, 0);

    return {
      totalCostImpact,
      totalScheduleImpact,
      countByStatus: {
        approved: approved.length,
        pending: pending.length,
        rejected: rejected.length,
      },
    };
  });
}
