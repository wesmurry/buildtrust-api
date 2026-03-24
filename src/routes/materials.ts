import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeMaterial, kebabToEnum } from '../utils/serialize.js';

const createMaterialSchema = z.object({
  name: z.string(),
  specification: z.string().optional(),
  category: z.string(),
  supplier: z.string().optional(),
  unitCost: z.number().optional(),
  quantity: z.number().optional(),
  totalCost: z.number().optional(),
  leadTimeDays: z.number().optional(),
  orderDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  neededByDate: z.string().optional(),
  status: z.string().optional(),
});

const updateMaterialSchema = z.object({
  name: z.string().optional(),
  specification: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  unitCost: z.number().optional(),
  quantity: z.number().optional(),
  totalCost: z.number().optional(),
  leadTimeDays: z.number().optional(),
  orderDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  neededByDate: z.string().optional(),
  status: z.string().optional(),
});

export async function materialRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/materials
  app.get<{ Params: { id: string } }>('/api/projects/:id/materials', async (request) => {
    const materials = await prisma.materialItem.findMany({
      where: { projectId: request.params.id },
    });
    return materials.map(serializeMaterial);
  });

  // POST /api/projects/:id/materials
  app.post<{ Params: { id: string }; Body: z.infer<typeof createMaterialSchema> }>(
    '/api/projects/:id/materials',
    { preHandler: [requireRole('GC'), validateBody(createMaterialSchema)] },
    async (request) => {
      const { orderDate, expectedDelivery, neededByDate, status, ...rest } = request.body;
      const data: any = {
        projectId: request.params.id,
        ...rest,
      };
      if (orderDate) data.orderDate = new Date(orderDate);
      if (expectedDelivery) data.expectedDelivery = new Date(expectedDelivery);
      if (neededByDate) data.neededByDate = new Date(neededByDate);
      if (status) data.status = kebabToEnum(status);

      const material = await prisma.materialItem.create({ data });
      return serializeMaterial(material);
    },
  );

  // PATCH /api/materials/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateMaterialSchema> }>(
    '/api/materials/:id',
    { preHandler: [validateBody(updateMaterialSchema)] },
    async (request) => {
      const { status, orderDate, expectedDelivery, neededByDate, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);
      if (orderDate) data.orderDate = new Date(orderDate);
      if (expectedDelivery) data.expectedDelivery = new Date(expectedDelivery);
      if (neededByDate) data.neededByDate = new Date(neededByDate);

      const material = await prisma.materialItem.update({
        where: { id: request.params.id },
        data,
      });
      return serializeMaterial(material);
    },
  );

  // GET /api/projects/:id/materials/alerts
  app.get<{ Params: { id: string } }>('/api/projects/:id/materials/alerts', async (request) => {
    const materials = await prisma.materialItem.findMany({
      where: { projectId: request.params.id },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = materials.filter((item) => {
      // Needed within 30 days but not ordered
      if (
        item.neededByDate &&
        item.neededByDate <= thirtyDaysFromNow &&
        item.status === 'NOT_ORDERED'
      ) {
        return true;
      }
      // Expected delivery is after the needed-by date
      if (
        item.expectedDelivery &&
        item.neededByDate &&
        item.expectedDelivery > item.neededByDate
      ) {
        return true;
      }
      return false;
    });

    return alerts.map(serializeMaterial);
  });
}
