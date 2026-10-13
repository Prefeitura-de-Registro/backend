import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { verifyToken } from '../utils/jwt.js';
import type { TokenPayload } from '../types/token-payload.js';

/**
 * Responsável apenas por responder "quem é esse usuário?".
 * Não decide se ele pode acessar o painel operacional — isso é
 * responsabilidade do authorization.middleware.ts (requireFuncionario).
 */
export function authMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;

  // dados de usuário anônimo
  const ANONYMOUS_USER: TokenPayload = {
    id: 1,
    email: null,
    name: null,
    tipoUsuario: 'anonimo',
  };

  // Nenhum header enviado -> é anônimo, pois nunca iniciou sessão
  if (!authHeader) {
    request.user = ANONYMOUS_USER;
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError('Token não fornecido', 401);
  }

  try {
    request.user = verifyToken(authHeader.split(' ')[1]);
    next();
  } catch {
    // header existe, mas token expirou/invalidou -> sessão quebrada, não anônima
    throw new AppError('Token inválido ou expirado', 401);
  }
}
