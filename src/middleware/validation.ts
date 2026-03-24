import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

export function validateBody(schema: ZodSchema) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map(i => i.message).join('; '));
    }
    request.body = result.data;
  };
}

export function validateParams(schema: ZodSchema) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map(i => i.message).join('; '));
    }
    (request as any).params = result.data;
  };
}

export function validateQuery(schema: ZodSchema) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map(i => i.message).join('; '));
    }
    (request as any).query = result.data;
  };
}
