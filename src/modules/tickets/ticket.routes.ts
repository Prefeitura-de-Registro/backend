import { Router } from 'express';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import {
  requireAutenticado,
  requireFuncionario,
  requireMunicipe,
} from '../../shared/middlewares/authorization.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { ticketController } from './ticket.controller.js';
import {
  createTicketBodySchema,
  createSolicitacaoBodySchema,
  getManyTicketsQuerySchema,
  ticketIdParamsSchema,
  updateTicketBodySchema,
} from './schemas/ticket.schema.js';

const ticketRoutes = Router();

ticketRoutes.post(
  '/',
  authMiddleware,
  requireMunicipe,
  validateBody(createTicketBodySchema),
  asyncHandler(ticketController.create),
);

ticketRoutes.get(
  '/',
  authMiddleware,
  requireAutenticado,
  validateQuery(getManyTicketsQuerySchema),
  asyncHandler(ticketController.getMany),
);

ticketRoutes.use(authMiddleware, requireFuncionario);

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
