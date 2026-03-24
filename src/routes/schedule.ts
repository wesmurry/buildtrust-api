import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { serializeScheduleItem, kebabToEnum } from '../utils/serialize.js';

const createScheduleItemSchema = z.object({
  name: z.string(),
  phase: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  isMilestone: z.boolean().optional(),
  tradeId: z.string().optional(),
});

const updateScheduleItemSchema = z.object({
  name: z.string().optional(),
  phase: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  progress: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
  isMilestone: z.boolean().optional(),
  tradeId: z.string().optional(),
});

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/schedule
  app.get<{ Params: { id: string } }>('/api/projects/:id/schedule', async (request) => {
    const items = await prisma.scheduleItem.findMany({
      where: { projectId: request.params.id },
      orderBy: { startDate: 'asc' },
    });
    return items.map(serializeScheduleItem);
  });

  // POST /api/projects/:id/schedule
  app.post<{ Params: { id: string }; Body: z.infer<typeof createScheduleItemSchema> }>(
    '/api/projects/:id/schedule',
    { preHandler: [requireRole('GC'), validateBody(createScheduleItemSchema)] },
    async (request) => {
      const { startDate, endDate, status, ...rest } = request.body;
      const data: any = {
        projectId: request.params.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        ...rest,
      };
      if (status) data.status = kebabToEnum(status);

      const item = await prisma.scheduleItem.create({ data });
      return serializeScheduleItem(item);
    },
  );

  // PATCH /api/schedule/:id
  app.patch<{ Params: { id: string }; Body: z.infer<typeof updateScheduleItemSchema> }>(
    '/api/schedule/:id',
    { preHandler: [validateBody(updateScheduleItemSchema)] },
    async (request) => {
      const { status, startDate, endDate, ...rest } = request.body;
      const data: any = { ...rest };
      if (status) data.status = kebabToEnum(status);
      if (startDate) data.startDate = new Date(startDate);
      if (endDate) data.endDate = new Date(endDate);

      const item = await prisma.scheduleItem.update({
        where: { id: request.params.id },
        data,
      });
      return serializeScheduleItem(item);
    },
  );

  // GET /api/projects/:id/schedule/critical-path
  app.get<{ Params: { id: string } }>('/api/projects/:id/schedule/critical-path', async (request) => {
    const items = await prisma.scheduleItem.findMany({
      where: { projectId: request.params.id },
    });

    const itemMap = new Map(items.map((item) => [item.id, item]));

    // Find items that no other item depends on (terminal nodes)
    const dependedOn = new Set(items.flatMap((item) => item.dependencies));
    const terminalIds = items
      .filter((item) => !dependedOn.has(item.id))
      .map((item) => item.id);

    // Trace back through dependencies to find the longest path
    function tracePath(id: string, visited: Set<string>): string[] {
      if (visited.has(id)) return [];
      visited.add(id);

      const item = itemMap.get(id);
      if (!item || item.dependencies.length === 0) return [id];

      let longestUpstream: string[] = [];
      for (const depId of item.dependencies) {
        const path = tracePath(depId, new Set(visited));
        if (path.length > longestUpstream.length) {
          longestUpstream = path;
        }
      }

      return [...longestUpstream, id];
    }

    let criticalPath: string[] = [];
    for (const terminalId of terminalIds) {
      const path = tracePath(terminalId, new Set());
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    }

    return { criticalPath };
  });

  // GET /api/projects/:id/schedule/alerts
  app.get<{ Params: { id: string } }>('/api/projects/:id/schedule/alerts', async (request) => {
    const items = await prisma.scheduleItem.findMany({
      where: { projectId: request.params.id },
    });

    const now = new Date();
    const alerts = items.filter((item) => {
      if (item.status === 'DELAYED') return true;
      if (item.startDate < now && item.status === 'NOT_STARTED') return true;
      return false;
    });

    return alerts.map(serializeScheduleItem);
  });
}
