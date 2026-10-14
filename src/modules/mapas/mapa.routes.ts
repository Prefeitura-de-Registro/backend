import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireFuncionario } from '../../shared/middlewares/authorization.middleware.js';
import { validateQuery } from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { mapaController } from './mapa.controller.js';
import { mapaTicketsQuerySchema } from './schemas/mapa.schema.js';

const mapaRoutes = Router();

mapaRoutes.use(authMiddleware, requireFuncionario);

mapaRoutes.get(
  '/',
  validateQuery(mapaTicketsQuerySchema),
  asyncHandler(mapaController.getTicketsMap),
);

export { mapaRoutes };
