import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

/**
 * Responsável por responder "esse usuário pode utilizar o painel operacional?".
 *
 * Hoje o banco só possui os tipos `municipe` e `funcionario`. Quando um tipo
 * `admin` existir, basta ajustar a condição abaixo — o restante do domínio de
 * tickets (escopo de departamentos) já está preparado em
 * `shared/authorization/department-scope.service.ts` e não precisa mudar.
 */
export function requireFuncionario(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) {
    throw new AppError("Usuário não autenticado", 401);
  }

  if (request.user.tipoUsuario !== "funcionario") {
    throw new AppError("Acesso restrito a funcionários", 403);
  }

  next();
}
