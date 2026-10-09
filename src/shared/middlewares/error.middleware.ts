import type { ErrorRequestHandler } from 'express';
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

  console.error(error);
  response.status(500).json({ message: 'Internal server error' });
};
