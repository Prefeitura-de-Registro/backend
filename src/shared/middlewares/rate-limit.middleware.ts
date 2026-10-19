import { rateLimit } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Limites por IP. Atrás de proxy/load balancer defina TRUST_PROXY (ex.: 1)
 * para o IP real ser considerado. Desligado em testes (NODE_ENV=test) ou com
 * RATE_LIMIT_DISABLED=true.
 */
const desativado = () =>
  process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true';

function criarLimiter(
  janelaMinutos: number,
  max: number,
  message: string,
  skip?: (request: Request) => boolean,
) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
    skip: (request) => desativado() || (skip ? skip(request) : false),
  });
}

export const loginLimiter = criarLimiter(
  15,
  10,
  'Muitas tentativas de login. Tente novamente em alguns minutos.',
);

export const registerLimiter = criarLimiter(
  60,
  10,
  'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.',
);

// Só limita quem NÃO está logado (criação anônima de ticket).
export const ticketAnonimoLimiter = criarLimiter(
  60,
  10,
  'Muitos chamados abertos a partir deste endereço. Tente novamente mais tarde.',
  (request) => request.user?.tipoUsuario !== 'anonimo',
);

// Consulta pública por token: dificulta tentativa de adivinhar tokens.
export const acompanhamentoLimiter = criarLimiter(
  15,
  60,
  'Muitas consultas. Tente novamente em alguns minutos.',
);
