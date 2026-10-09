import type { TipoUsuario } from '@prisma/client';

export type PapelUsuario = TipoUsuario;

export interface TokenPayload {
  id: number;
  email: string | null; // alguns campos permitem null para usuários anônimos
  name: string | null;
  tipoUsuario: TipoUsuario;
}
