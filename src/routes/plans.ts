import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { enumToKebab } from '../utils/serialize.js';

export async function planRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/projects/:id/plans
  app.get<{ Params: { id: string } }>('/api/projects/:id/plans', async (request) => {
    const planSets = await prisma.planSet.findMany({
      where: { projectId: request.params.id },
      include: { parsedData: true },
      orderBy: { createdAt: 'desc' },
    });
    return planSets.map(ps => ({
      id: ps.id,
      projectId: ps.projectId,
      fileName: ps.fileName,
      fileUrl: ps.fileUrl,
      fileSize: ps.fileSize,
      pageCount: ps.pageCount,
      status: enumToKebab(ps.status),
      createdAt: ps.createdAt.toISOString(),
      hasParsedData: !!ps.parsedData,
    }));
  });

  // POST /api/projects/:id/plans/upload
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/plans/upload',
    { preHandler: [requireRole('GC')] },
    async (request, reply) => {
      // For MVP: accept JSON metadata about the upload
      // Real implementation would use @fastify/multipart for file upload to S3
      const body = request.body as any;
      const planSet = await prisma.planSet.create({
        data: {
          projectId: request.params.id,
          fileName: body?.fileName ?? 'plan-set.pdf',
          fileUrl: body?.fileUrl ?? '/uploads/placeholder.pdf',
          fileSize: body?.fileSize ?? 0,
          pageCount: body?.pageCount ?? null,
          status: 'UPLOADED',
        },
      });

      // In production, this would queue a background job for AI parsing
      // For now, simulate by setting status to PROCESSING then PARSED
      // await planParsingQueue.add('parse', { planSetId: planSet.id });

      return {
        id: planSet.id,
        status: enumToKebab(planSet.status),
        message: 'Plan set uploaded. AI parsing would be triggered here.',
      };
    },
  );

  // GET /api/plans/:id
  app.get<{ Params: { id: string } }>('/api/plans/:id', async (request) => {
    const planSet = await prisma.planSet.findUnique({
      where: { id: request.params.id },
      include: { parsedData: true, sheets: { orderBy: { pageNumber: 'asc' } } },
    });
    if (!planSet) throw new NotFoundError('PlanSet', request.params.id);

    return {
      id: planSet.id,
      projectId: planSet.projectId,
      fileName: planSet.fileName,
      fileUrl: planSet.fileUrl,
      fileSize: planSet.fileSize,
      pageCount: planSet.pageCount,
      status: enumToKebab(planSet.status),
      createdAt: planSet.createdAt.toISOString(),
      sheets: planSet.sheets.map(s => ({
        id: s.id,
        pageNumber: s.pageNumber,
        sheetType: s.sheetType,
        thumbnailUrl: s.thumbnailUrl,
        imageUrl: s.imageUrl,
      })),
      parsedData: planSet.parsedData ? {
        projectInfo: planSet.parsedData.projectInfo,
        roomSchedule: planSet.parsedData.roomSchedule,
        doorSchedule: planSet.parsedData.doorSchedule,
        windowSchedule: planSet.parsedData.windowSchedule,
        fixtureCount: planSet.parsedData.fixtureCount,
        structuralNotes: planSet.parsedData.structuralNotes,
        finishSchedule: planSet.parsedData.finishSchedule,
        confidence: planSet.parsedData.confidence,
        reviewedSections: planSet.parsedData.reviewedSections,
      } : null,
    };
  });

  // GET /api/plans/:id/sheets
  app.get<{ Params: { id: string } }>('/api/plans/:id/sheets', async (request) => {
    const sheets = await prisma.planSheet.findMany({
      where: { planSetId: request.params.id },
      orderBy: { pageNumber: 'asc' },
    });
    return sheets.map(s => ({
      id: s.id,
      pageNumber: s.pageNumber,
      sheetType: s.sheetType,
      thumbnailUrl: s.thumbnailUrl,
      imageUrl: s.imageUrl,
      extractedText: s.extractedText,
    }));
  });

  // PATCH /api/plans/:id/parsed — User corrections to parsed data
  app.patch<{ Params: { id: string } }>('/api/plans/:id/parsed', async (request) => {
    const body = request.body as any;
    const parsedData = await prisma.planParsedData.update({
      where: { planSetId: request.params.id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });
    return { success: true, updatedAt: parsedData.updatedAt.toISOString() };
  });

  // POST /api/plans/:id/reparse — Re-trigger AI parsing
  app.post<{ Params: { id: string } }>(
    '/api/plans/:id/reparse',
    { preHandler: [requireRole('GC')] },
    async (request) => {
      await prisma.planSet.update({
        where: { id: request.params.id },
        data: { status: 'PROCESSING' },
      });
      // In production: await planParsingQueue.add('parse', { planSetId: request.params.id });
      return { message: 'Re-parsing triggered. Status will update when complete.' };
    },
  );
}
