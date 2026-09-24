import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireFuncionario } from '../../shared/middlewares/authorization.middleware.js';
import {
  validateBody,
  validateParams,
} from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { solicitacaoController } from './solicitacao.controller.js';
import {
  respondSolicitacaoBodySchema,
  solicitacaoIdParamsSchema,
} from './schemas/solicitacao.schema.js';

const solicitacaoRoutes = Router();

solicitacaoRoutes.use(authMiddleware, requireFuncionario);

solicitacaoRoutes.patch(
  '/:id',
  validateParams(solicitacaoIdParamsSchema),
  validateBody(respondSolicitacaoBodySchema),
  asyncHandler(solicitacaoController.respond),
);

export { solicitacaoRoutes };
