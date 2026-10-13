import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireGestor } from '../../shared/middlewares/authorization.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validateQuery } from '../../shared/middlewares/validate.middleware.js';
import { relatorioQuerySchema } from './schemas/relatorio.schema.js';
import { relatorioController } from './relatorio.controller.js';

const relatorioRoutes = Router();

// rotas de gestor
relatorioRoutes.use(authMiddleware, requireGestor);

relatorioRoutes.get('/indicadores', validateQuery(relatorioQuerySchema), asyncHandler(relatorioController.getIndicadores));
relatorioRoutes.get('/volume', validateQuery(relatorioQuerySchema), asyncHandler(relatorioController.getVolumeSemanal));
relatorioRoutes.get('/categorias', validateQuery(relatorioQuerySchema), asyncHandler(relatorioController.getTicketsPorCategoria));
relatorioRoutes.get('/departamentos', validateQuery(relatorioQuerySchema), asyncHandler(relatorioController.getDesempenhoPorDepartamento));

export { relatorioRoutes };