import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireFuncionario } from '../../shared/middlewares/authorization.middleware.js';
import { uploadImagens } from '../../shared/middlewares/upload.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { solicitacaoController } from './solicitacao.controller.js';
import {
  createMensagemBodySchema,
  getManySolicitacoesQuerySchema,
  respondSolicitacaoBodySchema,
  solicitacaoIdParamsSchema,
} from './schemas/solicitacao.schema.js';

const solicitacaoRoutes = Router();

solicitacaoRoutes.use(authMiddleware, requireFuncionario);

solicitacaoRoutes.get(
  '/',
  validateQuery(getManySolicitacoesQuerySchema),
  asyncHandler(solicitacaoController.getMany),
);

solicitacaoRoutes.get(
  '/:id',
  validateParams(solicitacaoIdParamsSchema),
  asyncHandler(solicitacaoController.getById),
);

solicitacaoRoutes.get(
  '/:id/mensagens',
  validateParams(solicitacaoIdParamsSchema),
  asyncHandler(solicitacaoController.getMensagens),
);

// multipart/form-data: campo "mensagem" + até 5 imagens no campo "imagens".
solicitacaoRoutes.post(
  '/:id/mensagens',
  validateParams(solicitacaoIdParamsSchema),
  uploadImagens('imagens'),
  validateBody(createMensagemBodySchema),
  asyncHandler(solicitacaoController.createMensagem),
);

solicitacaoRoutes.patch(
  '/:id',
  validateParams(solicitacaoIdParamsSchema),
  validateBody(respondSolicitacaoBodySchema),
  asyncHandler(solicitacaoController.respond),
);

export { solicitacaoRoutes };
