import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../types/token-payload.js';
import { PapelUsuario } from '../types/token-payload.js';
import { AppError } from '../errors/app-error.js';

export function authorizeMiddleware(...allowedTypes: PapelUsuario[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = req.user as TokenPayload;

        if (!user) {
            throw new AppError('Usuário não autenticado', 401);
        }

        if (!allowedTypes.includes(user.tipoUsuario)) {
            throw new AppError('Acesso restrito', 403);
        }

        return next();
    };
}
