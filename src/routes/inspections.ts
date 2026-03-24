import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeInspection, kebabToEnum } from '../utils/serialize.js';

const createInspectionSchema = z.object({
  type: z.string(),
  requiredDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  inspector: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  corrections: z.string().optional(),
  reInspectionDate: z.string().optional(),
});

const updateInspectionSchema = z.object({
  type: z.string().optional(),
  requiredDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  inspector: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  corrections: z.string().optional(),
  reInspectionDate: z.string().optional(),
});

export async function inspectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/inspections
  app.get<{ Params: { id: string } }>('/api/projects/:id/inspections', async (request) => {
    const inspections = await prisma.inspection.findMany({
      where: { projectId: request.params.id },
      orderBy: { displayOrder: 'asc' },
    });
    return inspections.map(serializeInspection);
  });

  // POST /api/projects/:id/inspections
  app.post<{ Params: { id: string }; Body: z.infer<typeof createInspectionSchema> }>(
    '/api/projects/:id/inspections',
    { preHandler: [requireRole('GC'), validateBody(createInspectionSchema)] },
    async (request) => {
      const { requiredDate, scheduledDate, reInspectionDate, result, ...rest } = request.body;

      const maxOrder = await prisma.inspection.findFirst({
        where: { projectId: request.params.id },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });

      const data: any = {
        projectId: request.params.id,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
        ...rest,
      };
      if (requiredDate) data.requiredDate = new Date(requiredDate);
      if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
      if (reInspectionDate) data.reInspectionDate = new Date(reInspectionDate);
      if (result) data.result = kebabToEnum(result);

      const inspection = await prisma.inspection.create({ data });
      return serializeInspection(inspection);
    },
  );

  // PATCH /api/inspections/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateInspectionSchema> }>(
    '/api/inspections/:id',
    { preHandler: [validateBody(updateInspectionSchema)] },
    async (request) => {
      const { result, scheduledDate, requiredDate, reInspectionDate, ...rest } = request.body;
      const data: any = { ...rest };
      if (result) data.result = kebabToEnum(result);
      if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
      if (requiredDate) data.requiredDate = new Date(requiredDate);
      if (reInspectionDate) data.reInspectionDate = new Date(reInspectionDate);

      const inspection = await prisma.inspection.update({
        where: { id: request.params.id },
        data,
      });
      return serializeInspection(inspection);
    },
  );
}
