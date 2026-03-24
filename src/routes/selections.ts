import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeSelection, kebabToEnum } from '../utils/serialize.js';

const createSelectionSchema = z.object({
  category: z.string(),
  allowanceAmount: z.number(),
  selectedProduct: z.string().optional(),
  selectedCost: z.number().optional(),
  status: z.string().optional(),
  photoUrl: z.string().optional(),
});

const updateSelectionSchema = z.object({
  category: z.string().optional(),
  allowanceAmount: z.number().optional(),
  selectedProduct: z.string().optional(),
  selectedCost: z.number().optional(),
  status: z.string().optional(),
  photoUrl: z.string().optional(),
});

export async function selectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/selections
  app.get<{ Params: { id: string } }>('/api/projects/:id/selections', async (request) => {
    const selections = await prisma.selection.findMany({
      where: { projectId: request.params.id },
    });
    return selections.map(serializeSelection);
  });

  // POST /api/projects/:id/selections
  app.post<{ Params: { id: string }; Body: z.infer<typeof createSelectionSchema> }>(
    '/api/projects/:id/selections',
    { preHandler: [requireRole('GC'), validateBody(createSelectionSchema)] },
    async (request) => {
      const { status, ...rest } = request.body;
      const data: any = {
        projectId: request.params.id,
        ...rest,
      };
      if (status) data.status = kebabToEnum(status);

      const selection = await prisma.selection.create({ data });
      return serializeSelection(selection);
    },
  );

  // PATCH /api/selections/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateSelectionSchema> }>(
    '/api/selections/:id',
    { preHandler: [validateBody(updateSelectionSchema)] },
    async (request) => {
      const { status, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);

      const selection = await prisma.selection.update({
        where: { id: request.params.id },
        data,
      });
      return serializeSelection(selection);
    },
  );

  // GET /api/projects/:id/selections/impact
  app.get<{ Params: { id: string } }>('/api/projects/:id/selections/impact', async (request) => {
    const selections = await prisma.selection.findMany({
      where: { projectId: request.params.id },
    });

    let totalOver = 0;
    let totalUnder = 0;
    const items: { id: string; category: string; overUnder: number }[] = [];

    for (const sel of selections) {
      const overUnder = (sel.selectedCost ?? 0) - sel.allowanceAmount;
      if (overUnder > 0) totalOver += overUnder;
      if (overUnder < 0) totalUnder += Math.abs(overUnder);
      items.push({ id: sel.id, category: sel.category, overUnder });
    }

    return {
      totalOver,
      totalUnder,
      netImpact: totalOver - totalUnder,
      items,
    };
  });
}
