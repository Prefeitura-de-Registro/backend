import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireFuncionario } from '../../shared/middlewares/authorization.middleware.js';
import {
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { notificacaoService } from './notificacao.service.js';

const listQuerySchema = z.object({
  status: z.enum(['nao_lidas', 'todas']).default('todas'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const notificacaoRoutes = Router();

notificacaoRoutes.use(authMiddleware, requireFuncionario);

notificacaoRoutes.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (request, response) => {
    const query = request.validated?.query as z.infer<typeof listQuerySchema>;

    response
      .status(200)
      .json(await notificacaoService.list(request.user!, query));
  }),
);

// Antes de "/:id/lida" para não conflitar.
notificacaoRoutes.patch(
  '/lidas',
  asyncHandler(async (request, response) => {
    response
      .status(200)
      .json(await notificacaoService.marcarTodasComoLidas(request.user!));
  }),
);

notificacaoRoutes.patch(
  '/:id/lida',
  validateParams(idParamsSchema),
  asyncHandler(async (request, response) => {
    const { id } = request.validated?.params as z.infer<typeof idParamsSchema>;

    response
      .status(200)
      .json(await notificacaoService.marcarComoLida(request.user!, id));
  }),
);

export { notificacaoRoutes };
