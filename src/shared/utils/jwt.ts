import jwt, { type SignOptions } from "jsonwebtoken";
import { TokenPayload } from "../types/token-payload.js";

// valida que o secret não é undefined
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não definido no .env");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

// valida tipo do tempo de expiração
const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
  return decoded;
}