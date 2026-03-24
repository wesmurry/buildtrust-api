import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  // Dev mode: use header-based auth bypass
  if (env.NODE_ENV === 'development' && !env.CLERK_SECRET_KEY) {
    const userId = request.headers['x-dev-user-id'] as string | undefined;
    if (!userId) {
      throw new UnauthorizedError('Missing X-Dev-User-Id header (dev mode)');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError(`User '${userId}' not found`);
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return;
  }

  // Production: Clerk JWT verification would go here
  // For now, fall back to dev header auth
  const userId = request.headers['x-dev-user-id'] as string | undefined;
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('Invalid user');
  }

  request.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
