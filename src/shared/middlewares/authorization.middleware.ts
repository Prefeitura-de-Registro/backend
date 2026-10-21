import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

// Anônimo (sem header Authorization) não está autenticado: 401, não 403
function assertAutenticado(request: Request): void {
  if (!request.user || request.user.tipoUsuario === 'anonimo') {
    throw new AppError('Usuário não autenticado', 401);
  }
}

/**
 * Responsável por responder "esse usuário é autenticado?".
 *
 * Usado nas rotas de munícipes (criação, busca de tickets, etc)
 * Munícipes, funcionários e gestores PASSAM. Anônimos NÃO passam.
 */
export function requireAutenticado(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  assertAutenticado(request);
  next();
}

/** Permite acesso somente a munícipes autenticados. */
export function requireMunicipe(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  assertAutenticado(request);

  if (request.user!.tipoUsuario !== 'municipe') {
    throw new AppError('Acesso restrito a munícipes', 403);
  }

  next();
}

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
  assertAutenticado(request);

  if (
    request.user!.tipoUsuario !== 'funcionario' &&
    request.user!.tipoUsuario !== 'gestor'
  ) {
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
  assertAutenticado(request);

  if (request.user!.tipoUsuario !== 'gestor') {
    throw new AppError('Acesso restrito a gestores', 403);
  }

  next();
}
