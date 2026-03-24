import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeSavingsEntry, kebabToEnum } from '../utils/serialize.js';

const createSavingsSchema = z.object({
  date: z.string(),
  category: z.string(),
  description: z.string(),
  amountSaved: z.number(),
});

export async function savingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/savings
  app.get<{ Params: { id: string } }>('/api/projects/:id/savings', async (request) => {
    const entries = await prisma.savingsEntry.findMany({
      where: { projectId: request.params.id },
      orderBy: { date: 'desc' },
    });
    return entries.map(serializeSavingsEntry);
  });

  // POST /api/projects/:id/savings
  app.post<{ Params: { id: string }; Body: z.infer<typeof createSavingsSchema> }>(
    '/api/projects/:id/savings',
    { preHandler: [requireRole('GC'), validateBody(createSavingsSchema)] },
    async (request) => {
      const { date, category, ...rest } = request.body;
      const entry = await prisma.savingsEntry.create({
        data: {
          projectId: request.params.id,
          date: new Date(date),
          category: kebabToEnum(category),
          ...rest,
        },
      });
      return serializeSavingsEntry(entry);
    },
  );

  // GET /api/projects/:id/savings/summary
  app.get<{ Params: { id: string } }>('/api/projects/:id/savings/summary', async (request) => {
    const entries = await prisma.savingsEntry.findMany({
      where: { projectId: request.params.id },
      orderBy: { date: 'desc' },
    });

    const total = entries.reduce((sum, e) => sum + e.amountSaved, 0);

    const byCategory: Record<string, number> = {};
    for (const entry of entries) {
      const key = entry.category;
      byCategory[key] = (byCategory[key] ?? 0) + entry.amountSaved;
    }

    return {
      total,
      byCategory,
      entries: entries.map(serializeSavingsEntry),
    };
  });
}
