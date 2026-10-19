import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { categoriaService } from './categoria.service.js';

const categoriaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const categoriaRoutes = Router();

categoriaRoutes.get(
  '/',
  asyncHandler(async (_request, response) => {
    response.status(200).json(await categoriaService.list());
  }),
);

categoriaRoutes.get(
  '/:id/perguntas',
  validateParams(categoriaIdParamsSchema),
  asyncHandler(async (request, response) => {
    const { id } = request.validated?.params as z.infer<
      typeof categoriaIdParamsSchema
    >;

    response.status(200).json(await categoriaService.listPerguntas(id));
  }),
);

export { categoriaRoutes };
