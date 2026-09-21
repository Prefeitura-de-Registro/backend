import type { TokenPayload } from "./token-payload.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      validated?: {
        body?: unknown,
        query?: unknown,
        params?: unknown,
      }
    }
  }
}

export {};