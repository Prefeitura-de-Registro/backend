import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';

type Cliente = Pick<typeof prisma, 'logAuditoria'> | Prisma.TransactionClient;

type RegistroAuditoria = {
  idUsuario: number | null; // null = ação automática do sistema
  acao: string;
  entidadeTipo: string;
  entidadeId: number;
  dadosAntigos?: Prisma.InputJsonValue;
  dadosNovos?: Prisma.InputJsonValue;
};

/**
 * Grava em logs_auditoria. NUNCA passe CPF ou senha em dadosAntigos/dadosNovos
 * (LGPD): registre só o nome do campo alterado.
 */
export async function registrarAuditoria(
  registro: RegistroAuditoria,
  cliente: Cliente = prisma,
): Promise<void> {
  await cliente.logAuditoria.create({
    data: {
      idUsuario: registro.idUsuario,
      acao: registro.acao,
      entidadeTipo: registro.entidadeTipo,
      entidadeId: registro.entidadeId,
      dadosAntigos: registro.dadosAntigos,
      dadosNovos: registro.dadosNovos,
    },
  });
}
