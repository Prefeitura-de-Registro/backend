import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/authenticate.middleware.js';
import { authorizeMiddleware } from '../../shared/middlewares/authorize.middleware.js';
import { validateQuery } from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { mapaController } from './mapa.controller.js';
import { mapaTicketsQuerySchema } from './schemas/mapa.schema.js';

const mapaRoutes = Router();

mapaRoutes.use(authMiddleware, authorizeMiddleware('gestor'));

mapaRoutes.get('/', validateQuery(mapaTicketsQuerySchema), asyncHandler(mapaController.getTickets));

export { mapaRoutes };