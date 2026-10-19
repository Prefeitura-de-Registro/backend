import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import {
  requireAutenticado,
  requireFuncionario,
} from '../../shared/middlewares/authorization.middleware.js';
import {
  acompanhamentoLimiter,
  ticketAnonimoLimiter,
} from '../../shared/middlewares/rate-limit.middleware.js';
import { uploadImagens } from '../../shared/middlewares/upload.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { ticketController } from './ticket.controller.js';
import {
  createSolicitacaoBodySchema,
  createTicketBodySchema,
  getManyTicketsQuerySchema,
  getMeusTicketsQuerySchema,
  ticketIdParamsSchema,
  codigoAcompanhamentoParamsSchema,
  arquivoPublicoParamsSchema,
  updateTicketBodySchema,
} from './schemas/ticket.schema.js';

const ticketRoutes = Router();

// --- Rotas do munícipe / anônimo (definidas ANTES do requireFuncionario) ---

// Abertura de chamado: anônimo ou logado. JSON ou multipart (campo "fotos").
ticketRoutes.post(
  '/',
  authMiddleware,
  ticketAnonimoLimiter,
  uploadImagens('fotos'),
  validateBody(createTicketBodySchema),
  asyncHandler(ticketController.create),
);

// Acompanhamento sem login: pelo token do link OU pelo protocolo do chamado.
ticketRoutes.get(
  '/acompanhar/:codigo',
  acompanhamentoLimiter,
  validateParams(codigoAcompanhamentoParamsSchema),
  asyncHandler(ticketController.acompanhar),
);

// Imagem/vídeo do chamado para quem acompanha sem login (funciona em <img src>).
ticketRoutes.get(
  '/acompanhar/:codigo/arquivos/:idArquivo',
  acompanhamentoLimiter,
  validateParams(arquivoPublicoParamsSchema),
  asyncHandler(ticketController.getArquivoPublico),
);

ticketRoutes.get(
  '/meus',
  authMiddleware,
  requireAutenticado,
  validateQuery(getMeusTicketsQuerySchema),
  asyncHandler(ticketController.getMeus),
);

ticketRoutes.get(
  '/meus/:id',
  authMiddleware,
  requireAutenticado,
  validateParams(ticketIdParamsSchema),
  asyncHandler(ticketController.getMeuById),
);

// --- Rotas operacionais (funcionário e gestor) ---

ticketRoutes.use(authMiddleware, requireFuncionario);

ticketRoutes.get(
  '/',
  validateQuery(getManyTicketsQuerySchema),
  asyncHandler(ticketController.getMany),
);

ticketRoutes.get(
  '/:id',
  validateParams(ticketIdParamsSchema),
  asyncHandler(ticketController.getById),
);

ticketRoutes.patch(
  '/:id/assume',
  validateParams(ticketIdParamsSchema),
  asyncHandler(ticketController.assume),
);

ticketRoutes.patch(
  '/:id',
  validateParams(ticketIdParamsSchema),
  validateBody(updateTicketBodySchema),
  asyncHandler(ticketController.update),
);

ticketRoutes.post(
  '/:id/solicitacoes',
  validateParams(ticketIdParamsSchema),
  validateBody(createSolicitacaoBodySchema),
  asyncHandler(ticketController.createSolicitacao),
);

ticketRoutes.get(
  '/:id/solicitacoes',
  validateParams(ticketIdParamsSchema),
  asyncHandler(ticketController.getSolicitacoes),
);

export { ticketRoutes };
