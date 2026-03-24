import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializePayment, kebabToEnum } from '../utils/serialize.js';

const createPaymentSchema = z.object({
  drawNumber: z.number(),
  milestone: z.string(),
  amount: z.number(),
  payee: z.string(),
  scheduledDate: z.string(),
  tradeId: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

const updatePaymentSchema = z.object({
  drawNumber: z.number().optional(),
  milestone: z.string().optional(),
  amount: z.number().optional(),
  payee: z.string().optional(),
  scheduledDate: z.string().optional(),
  tradeId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  status: z.string().optional(),
  paidDate: z.string().optional(),
});

export async function paymentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/payments
  app.get<{ Params: { id: string } }>('/api/projects/:id/payments', async (request) => {
    const payments = await prisma.payment.findMany({
      where: { projectId: request.params.id },
      orderBy: { drawNumber: 'asc' },
    });
    return payments.map(serializePayment);
  });

  // POST /api/projects/:id/payments
  app.post<{ Params: { id: string }; Body: z.infer<typeof createPaymentSchema> }>(
    '/api/projects/:id/payments',
    { preHandler: [requireRole('GC'), validateBody(createPaymentSchema)] },
    async (request) => {
      const { scheduledDate, ...rest } = request.body;
      const payment = await prisma.payment.create({
        data: {
          projectId: request.params.id,
          scheduledDate: new Date(scheduledDate),
          ...rest,
        },
      });
      return serializePayment(payment);
    },
  );

  // PATCH /api/payments/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updatePaymentSchema> }>(
    '/api/payments/:id',
    { preHandler: [validateBody(updatePaymentSchema)] },
    async (request) => {
      const { status, scheduledDate, paidDate, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);
      if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
      if (paidDate) data.paidDate = new Date(paidDate);

      const payment = await prisma.payment.update({
        where: { id: request.params.id },
        data,
      });
      return serializePayment(payment);
    },
  );

  // GET /api/projects/:id/payments/bid-vs-actual
  app.get<{ Params: { id: string } }>('/api/projects/:id/payments/bid-vs-actual', async (request) => {
    const budgetItems = await prisma.budgetLineItem.findMany({
      where: { trade: { projectId: request.params.id } },
      include: { trade: true },
    });

    return budgetItems.map((item) => ({
      tradeId: item.tradeId,
      tradeName: item.trade.name,
      bidAmount: item.bidAmount,
      actualToDate: item.actualToDate,
      variance: item.bidAmount - item.actualToDate,
    }));
  });
}
