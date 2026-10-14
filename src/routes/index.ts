import { Router } from 'express';
import { healthRoutes } from '../modules/health/health.routes.js';
import { solicitacaoRoutes } from '../modules/solicitacoes/solicitacao.routes.js';
import { ticketRoutes } from '../modules/tickets/ticket.routes.js';
import { usersRoutes } from '../modules/users/user.routes.js';
import { relatorioRoutes } from '../modules/relatorios/relatorio.routes.js';
import { mapaRoutes } from '../modules/mapas/mapa.routes.js';

const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/api/user', usersRoutes);
routes.use('/api/tickets', ticketRoutes);
routes.use('/api/solicitacoes', solicitacaoRoutes);
routes.use('/api/relatorios', relatorioRoutes);
routes.use('/api/mapas', mapaRoutes);

export { routes };
