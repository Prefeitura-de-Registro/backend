import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/*
    Middleware de validação de entradas em runtime
    Recebe um schema zod e valida o corpo da requisição
*/

export function validateBody(schema: z.ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            next(error);
        }
    };
}