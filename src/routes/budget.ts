import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeBudgetLineItem } from '../utils/serialize.js';

const updateBudgetSchema = z.object({
  estimated: z.number().optional(),
  bidAmount: z.number().optional(),
  committed: z.number().optional(),
  actualToDate: z.number().optional(),
});

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/budget
  app.get<{ Params: { id: string } }>('/api/projects/:id/budget', async (request) => {
    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
    });
    if (!project) throw new NotFoundError('Project', request.params.id);

    const items = await prisma.budgetLineItem.findMany({
      where: { trade: { projectId: request.params.id } },
      include: { trade: true },
    });

    return items.map((item) =>
      serializeBudgetLineItem(item, project.gcFeeModel, project.gcFeeAmount),
    );
  });

  // GET /api/projects/:id/budget/summary
  app.get<{ Params: { id: string } }>('/api/projects/:id/budget/summary', async (request) => {
    const projectId = request.params.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundError('Project', projectId);

    const [budgetItems, savings] = await Promise.all([
      prisma.budgetLineItem.findMany({ where: { trade: { projectId } } }),
      prisma.savingsEntry.findMany({ where: { projectId } }),
    ]);

    const totalEstimated = budgetItems.reduce((sum, b) => sum + b.estimated, 0);
    const totalCommitted = budgetItems.reduce((sum, b) => sum + b.committed, 0);
    const totalActual = budgetItems.reduce((sum, b) => sum + b.actualToDate, 0);
    const gcFee = project.gcFeeModel === 'PERCENTAGE'
      ? totalCommitted * (project.gcFeeAmount / 100)
      : project.gcFeeAmount;
    const totalWithMarkup = totalCommitted + gcFee;
    const totalBudget = project.totalBudget ?? 0;
    const remaining = totalBudget - totalWithMarkup;
    const savingsToDate = savings.reduce((sum, s) => sum + s.amountSaved, 0);

    return {
      totalEstimated,
      totalCommitted,
      totalActual,
      gcFee: Math.round(gcFee * 100) / 100,
      totalWithMarkup: Math.round(totalWithMarkup * 100) / 100,
      totalBudget,
      remaining: Math.round(remaining * 100) / 100,
      savingsToDate,
    };
  });

  // GET /api/projects/:id/budget/markup-breakdown
  app.get<{ Params: { id: string } }>('/api/projects/:id/budget/markup-breakdown', async (request) => {
    const projectId = request.params.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundError('Project', projectId);

    const items = await prisma.budgetLineItem.findMany({
      where: { trade: { projectId } },
      include: { trade: true },
    });

    const totalCommitted = items.reduce((sum, b) => sum + b.committed, 0);

    return items.map((item) => {
      let gcMarkup: number;
      if (project.gcFeeModel === 'PERCENTAGE') {
        gcMarkup = item.committed * (project.gcFeeAmount / 100);
      } else {
        // Flat fee: proportional allocation based on committed share
        gcMarkup = totalCommitted > 0
          ? project.gcFeeAmount * (item.committed / totalCommitted)
          : 0;
      }

      return {
        tradeName: item.trade.name,
        subCost: item.committed,
        gcMarkup: Math.round(gcMarkup * 100) / 100,
        ownerPays: Math.round((item.committed + gcMarkup) * 100) / 100,
      };
    });
  });

  // PATCH /api/budget/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateBudgetSchema> }>(
    '/api/budget/:id',
    { preHandler: [requireRole('GC'), validateBody(updateBudgetSchema)] },
    async (request) => {
      const existing = await prisma.budgetLineItem.findUnique({
        where: { id: request.params.id },
        include: { trade: true },
      });
      if (!existing) throw new NotFoundError('BudgetLineItem', request.params.id);

      const updated = await prisma.budgetLineItem.update({
        where: { id: request.params.id },
        data: request.body,
        include: { trade: true },
      });

      const project = await prisma.project.findUnique({
        where: { id: updated.trade.projectId },
      });

      return serializeBudgetLineItem(updated, project!.gcFeeModel, project!.gcFeeAmount);
    },
  );

  // GET /api/projects/:id/budget/alerts
  app.get<{ Params: { id: string } }>('/api/projects/:id/budget/alerts', async (request) => {
    const projectId = request.params.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundError('Project', projectId);

    const items = await prisma.budgetLineItem.findMany({
      where: { trade: { projectId } },
      include: { trade: true },
    });

    const alerts: Array<{
      tradeId: string;
      tradeName: string;
      type: string;
      message: string;
    }> = [];

    for (const item of items) {
      if (item.actualToDate > item.committed && item.committed > 0) {
        alerts.push({
          tradeId: item.tradeId,
          tradeName: item.trade.name,
          type: 'over-budget',
          message: `Actual ($${item.actualToDate.toLocaleString()}) exceeds committed ($${item.committed.toLocaleString()})`,
        });
      }
      if (item.bidAmount > item.estimated * 1.1 && item.estimated > 0) {
        alerts.push({
          tradeId: item.tradeId,
          tradeName: item.trade.name,
          type: 'bid-over-estimate',
          message: `Bid ($${item.bidAmount.toLocaleString()}) exceeds estimate ($${item.estimated.toLocaleString()}) by more than 10%`,
        });
      }
    }

    return alerts;
  });
}
