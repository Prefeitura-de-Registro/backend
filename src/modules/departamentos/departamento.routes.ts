import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireFuncionario } from '../../shared/middlewares/authorization.middleware.js';
import { validateQuery } from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { departamentoService } from './departamento.service.js';

const listDepartamentosQuerySchema = z.object({
  excluir: z.coerce.number().int().positive().optional(),
});

const departamentoRoutes = Router();

departamentoRoutes.use(authMiddleware, requireFuncionario);

departamentoRoutes.get(
  '/',
  validateQuery(listDepartamentosQuerySchema),
  asyncHandler(async (request, response) => {
    const { excluir } = request.validated?.query as z.infer<
      typeof listDepartamentosQuerySchema
    >;

    response.status(200).json(await departamentoService.list(excluir));
  }),
);

export { departamentoRoutes };
