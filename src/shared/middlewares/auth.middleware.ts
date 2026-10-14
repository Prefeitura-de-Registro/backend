import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { verifyToken } from '../utils/jwt.js';
import type { TokenPayload } from '../types/token-payload.js';
import { prisma } from '../database/prisma.js';

// dados de usuário anônimo
const ANONYMOUS_USER: TokenPayload = {
  id: 1,
  email: null,
  name: null,
  tipoUsuario: 'anonimo',
};

/**
 * Responsável apenas por responder "quem é esse usuário?".
 * Não decide se ele pode acessar o painel operacional — isso é
 * responsabilidade do authorization.middleware.ts (requireFuncionario).
 */
export async function authMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  try {
    const authHeader = request.headers.authorization;

    // Nenhum header enviado -> é anônimo, pois nunca iniciou sessão
    if (!authHeader) {
      request.user = ANONYMOUS_USER;
      return next();
    }

    // header com formato errado
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Token não fornecido', 401);
    }

    // verifica token
    let payload: TokenPayload;
    try {
      payload = verifyToken(authHeader.split(' ')[1]);
    } catch {
      throw new AppError('Token inválido ou expirado', 401);
    }

    // confere dados no banco
    const usuario = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        tipoUsuario: true,
        ativo: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      throw new AppError('Token inválido ou expirado', 401);
    }

    request.user = {
      id: usuario.id,
      email: usuario.email,
      name: usuario.name,
      tipoUsuario: usuario.tipoUsuario,
    };
    next();
  } catch (error) {
    next(error);
  }
}
