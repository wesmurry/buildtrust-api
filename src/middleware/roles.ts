import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../utils/errors.js';

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new ForbiddenError('Not authenticated');
    }
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenError(`Role '${request.user.role}' not authorized. Required: ${roles.join(', ')}`);
    }
  };
}
