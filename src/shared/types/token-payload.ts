import { TipoUsuario } from '@prisma/client';

export type PapelUsuario = TipoUsuario | "anonimo";

export interface TokenPayload {
  id: number
  email: string | null // alguns campos permitem null para usuários anônimos
  name: string | null 
  tipoUsuario: PapelUsuario // "anônimo" só existe na API - no banco aponta para munícipe reservado
}