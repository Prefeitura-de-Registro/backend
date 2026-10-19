import { Router } from 'express';
import { arquivoRoutes } from '../modules/arquivos/arquivo.routes.js';
import { categoriaRoutes } from '../modules/categorias/categoria.routes.js';
import { departamentoRoutes } from '../modules/departamentos/departamento.routes.js';
import { notificacaoRoutes } from '../modules/notificacoes/notificacao.routes.js';
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
routes.use('/api/categorias', categoriaRoutes);
routes.use('/api/departamentos', departamentoRoutes);
routes.use('/api/arquivos', arquivoRoutes);
routes.use('/api/notificacoes', notificacaoRoutes);
routes.use('/api/solicitacoes', solicitacaoRoutes);
routes.use('/api/relatorios', relatorioRoutes);
routes.use('/api/mapas', mapaRoutes);

export { routes };
