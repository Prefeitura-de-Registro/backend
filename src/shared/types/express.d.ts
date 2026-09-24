import type { TokenPayload } from './token-payload.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo authMiddleware após validar o JWT. */
      user?: TokenPayload;
      /** Query/params já validados e tipados por validateQuery/validateParams. */
      validated?: {
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
