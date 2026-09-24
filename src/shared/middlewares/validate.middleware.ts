import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * validateBody parseia e SOBRESCREVE request.body diretamente (padrão usado
 * pelo módulo de login/usuários).
 *
 * validateQuery/validateParams guardam o resultado em request.validated em
 * vez de sobrescrever request.query/request.params, pois esses dois são
 * somente leitura nos tipos do Express 5 usados neste projeto.
 */

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      request.body = schema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      const query = schema.parse(request.query);
      request.validated = { ...request.validated, query };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      const params = schema.parse(request.params);
      request.validated = { ...request.validated, params };
      next();
    } catch (error) {
      next(error);
    }
  };
}
