import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

/**
 * Responsável por responder "esse usuário é funcionário?".
 *
 * Usado nas rotas de operadores (manipulação de tickets, visualização de mapas,
 * criação de solicitações, etc). Munícipes NÃO passam. Funcionários e gestores PASSAM.
 */
export function requireFuncionario(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!request.user) {
    throw new AppError('Usuário não autenticado', 401);
  }

  if (request.user.tipoUsuario !== 'funcionario' || 'gestor') {
    throw new AppError('Acesso restrito a funcionários', 403);
  }

  next();
}

/**
 * Responsável por responder "esse usuário é gestor?".
 *
 * Usado nas rotas de gestão de usuários (cadastro de funcionários, edição,
 * desativação e vínculo com departamentos). Funcionários comuns NÃO passam.
 */
export function requireGestor(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!request.user) {
    throw new AppError('Usuário não autenticado', 401);
  }

  if (request.user.tipoUsuario !== 'gestor') {
    throw new AppError('Acesso restrito a gestores', 403);
  }

  next();
}
