import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'Validation failed',
      errors: error.flatten(),
    });
    return;
  }

  // Violação de unicidade (corrida entre duas requisições ou índice único do banco).
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const alvo = JSON.stringify(error.meta ?? '').toLowerCase();
    const campo = alvo.includes('cpf')
      ? 'CPF'
      : alvo.includes('matricula')
        ? 'matrícula'
        : alvo.includes('email')
          ? 'e-mail'
          : null;

    response.status(409).json({
      message: campo
        ? `Já existe um cadastro com esse ${campo}`
        : 'Registro já cadastrado',
    });
    return;
  }

  // JSON malformado / corpo grande demais (erros do body-parser).
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 400 || error.status === 413) &&
    'type' in error
  ) {
    response.status(error.status as number).json({
      message:
        error.status === 413
          ? 'Corpo da requisição grande demais'
          : 'JSON inválido',
    });
    return;
  }

  console.error(error);
  response.status(500).json({ message: 'Internal server error' });
};
