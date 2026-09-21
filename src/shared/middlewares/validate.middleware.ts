import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/*
    Middleware de validação de entradas em runtime
    Recebe um schema zod e valida o corpo da requisição
*/

type Source = "body" | "query" | "params";

function createValidator(source: Source) {
  return (schema: z.ZodType) =>
    (req: Request, _res: Response, next: NextFunction) => {
      try {
        const parsed = schema.parse(req[source]);
        req.validated = { ...req.validated, [source]: parsed };
        next();
      } catch (error) {
        next(error);
      }
    };
}

export const validateBody = createValidator("body");
export const validateQuery = createValidator("query");
export const validateParams = createValidator("params");