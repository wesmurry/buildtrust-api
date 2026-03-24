import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import {
  serializeProject, serializeTrade, serializeBudgetLineItem,
  serializeChangeOrder, serializePayment, serializeSavingsEntry,
  serializeScheduleItem, serializeInspection, enumToKebab,
} from '../utils/serialize.js';

const updateProjectSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  totalBudget: z.number().optional(),
  gcFeeModel: z.enum(['percentage', 'flat']).optional(),
  gcFeeAmount: z.number().optional(),
  squareFootage: z.number().optional(),
});

export async function projectRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request) => {
    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      include: { owner: true, gc: true },
    });
    if (!project) throw new NotFoundError('Project', request.params.id);
    return serializeProject(project as any);
  });

  // PATCH /api/projects/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateProjectSchema> }>(
    '/api/projects/:id',
    { preHandler: [validateBody(updateProjectSchema)] },
    async (request) => {
      const { gcFeeModel, status, ...rest } = request.body;
      const data: any = { ...rest };
      if (gcFeeModel) data.gcFeeModel = gcFeeModel.toUpperCase();
      if (status) data.status = status.toUpperCase().replace(/-/g, '_');

      const project = await prisma.project.update({
        where: { id: request.params.id },
        data,
        include: { owner: true, gc: true },
      });
      return serializeProject(project as any);
    },
  );

  // GET /api/projects/:id/dashboard
  app.get<{ Params: { id: string } }>('/api/projects/:id/dashboard', async (request) => {
    const projectId = request.params.id;

    const [project, trades, budgetItems, changeOrders, payments, savings, scheduleItems, inspections] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, include: { owner: true, gc: true } }),
      prisma.trade.findMany({ where: { projectId }, orderBy: { displayOrder: 'asc' } }),
      prisma.budgetLineItem.findMany({ where: { trade: { projectId } }, include: { trade: true } }),
      prisma.changeOrder.findMany({ where: { projectId }, include: { initiatedBy: true }, orderBy: { createdAt: 'desc' } }),
      prisma.payment.findMany({ where: { projectId }, orderBy: { drawNumber: 'asc' } }),
      prisma.savingsEntry.findMany({ where: { projectId }, orderBy: { date: 'desc' } }),
      prisma.scheduleItem.findMany({ where: { projectId }, orderBy: { startDate: 'asc' } }),
      prisma.inspection.findMany({ where: { projectId }, orderBy: { displayOrder: 'asc' } }),
    ]);

    if (!project) throw new NotFoundError('Project', projectId);

    // Budget summary
    const totalEstimated = budgetItems.reduce((sum, b) => sum + b.estimated, 0);
    const totalCommitted = budgetItems.reduce((sum, b) => sum + b.committed, 0);
    const totalActual = budgetItems.reduce((sum, b) => sum + b.actualToDate, 0);
    const gcFee = project.gcFeeModel === 'PERCENTAGE'
      ? totalCommitted * (project.gcFeeAmount / 100)
      : project.gcFeeAmount;
    const totalSavings = savings.reduce((sum, s) => sum + s.amountSaved, 0);

    // Schedule progress
    const completedItems = scheduleItems.filter(s => s.status === 'COMPLETE');
    const schedulePercent = scheduleItems.length > 0
      ? Math.round((completedItems.length / scheduleItems.length) * 100)
      : 0;
    const currentPhase = scheduleItems.find(s => s.status === 'IN_PROGRESS')?.phase ?? 'Pre-Construction';

    // Health indicators
    const budgetHealth = totalActual <= totalCommitted * 0.95 ? 'green'
      : totalActual <= totalCommitted * 1.05 ? 'yellow' : 'red';

    const delayedItems = scheduleItems.filter(s => s.status === 'DELAYED');
    const scheduleHealth = delayedItems.length === 0 ? 'green'
      : delayedItems.length <= 2 ? 'yellow' : 'red';

    const passedInspections = inspections.filter(i => i.result === 'PASS').length;
    const totalInspected = inspections.filter(i => i.result).length;
    const qualityHealth = totalInspected === 0 ? 'green'
      : (passedInspections / totalInspected) >= 0.9 ? 'green'
      : (passedInspections / totalInspected) >= 0.7 ? 'yellow' : 'red';

    // Pending decisions
    const pendingChangeOrders = changeOrders.filter(co => co.status === 'PENDING_APPROVAL');
    const pendingPayments = payments.filter(p => p.status === 'READY');

    // Activity feed (last 10 items from change orders, payments, etc.)
    const activityItems: any[] = [];

    for (const co of changeOrders.slice(0, 5)) {
      activityItems.push({
        id: `a-co-${co.id}`,
        type: 'change-order',
        description: `CO #${co.number} ${co.status === 'PENDING_APPROVAL' ? 'submitted' : enumToKebab(co.status)}: ${co.description.substring(0, 80)}`,
        date: co.createdAt.toISOString(),
        icon: 'AlertTriangle',
      });
    }

    for (const p of payments.filter(p => p.paidDate).slice(0, 3)) {
      activityItems.push({
        id: `a-pay-${p.id}`,
        type: 'payment',
        description: `Draw #${p.drawNumber} paid — $${p.amount.toLocaleString()} for ${p.milestone.toLowerCase()}`,
        date: (p.paidDate!).toISOString(),
        icon: 'DollarSign',
      });
    }

    activityItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      project: serializeProject(project as any),
      budget: {
        totalEstimated,
        totalCommitted,
        totalActual,
        gcFee: Math.round(gcFee * 100) / 100,
        totalSavings,
        totalBudget: project.totalBudget ?? 0,
        remaining: (project.totalBudget ?? 0) - totalCommitted - gcFee,
      },
      schedule: {
        percentComplete: schedulePercent,
        currentPhase,
        totalItems: scheduleItems.length,
        completedItems: completedItems.length,
      },
      health: {
        budget: budgetHealth,
        schedule: scheduleHealth,
        quality: qualityHealth,
      },
      pendingDecisions: {
        changeOrders: pendingChangeOrders.map(co => serializeChangeOrder(co as any)),
        payments: pendingPayments.map(p => serializePayment(p)),
      },
      recentActivity: activityItems.slice(0, 10),
    };
  });
}
