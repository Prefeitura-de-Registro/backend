import { Prisma, TipoEvento, type TicketStatus } from '@prisma/client';
import { statusAnteriorAoPendente } from './rules/status-reversao.rules.js';

const STATUS_SOLICITACAO_ABERTA = ['pendente', 'em_analise'] as const;

/**
 * Coloca o ticket em `pendente` (espera de uma solicitação a outro
 * departamento), gravando `mudanca_status` no histórico. Se já estiver
 * pendente, não faz nada.
 */
export async function marcarTicketPendente(
  tx: Prisma.TransactionClient,
  idTicket: number,
  idUsuario: number | null,
  texto: string,
): Promise<boolean> {
  const ticket = await tx.ticket.findUniqueOrThrow({
    where: { id: idTicket },
    select: { status: true },
  });

  if (ticket.status === 'pendente') {
    return false;
  }

  await tx.ticket.update({
    where: { id: idTicket },
    data: { status: 'pendente' },
  });

  await tx.ticketHistorico.create({
    data: {
      idTicket,
      tipoEvento: TipoEvento.mudanca_status,
      status: 'pendente',
      idUsuario,
      texto,
    },
  });

  return true;
}

/**
 * Regra de negócio da documentação (seção 7): quando TODAS as solicitações do
 * ticket estão `respondida`/`recusada`, o ticket volta ao status anterior ao
 * `pendente` e é gravado um novo `mudanca_status` feito pelo sistema
 * (idUsuario = null). Implementada aqui no backend, na mesma transação da
 * resposta; não existe trigger equivalente no banco.
 *
 * Devolve o status restaurado, ou null se nada foi revertido.
 */
export async function reverterStatusSeSolicitacoesFinalizadas(
  tx: Prisma.TransactionClient,
  idTicket: number,
) {
  const abertas = await tx.solicitacao.count({
    where: { idTicket, status: { in: [...STATUS_SOLICITACAO_ABERTA] } },
  });

  if (abertas > 0) {
    return null;
  }

  const ticket = await tx.ticket.findUniqueOrThrow({
    where: { id: idTicket },
    select: { status: true },
  });

  if (ticket.status !== 'pendente') {
    return null;
  }

  const historicos = await tx.ticketHistorico.findMany({
    where: { idTicket, status: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { status: true },
  });

  const destino = statusAnteriorAoPendente(
    historicos.map((h: { status: TicketStatus | null }) => h.status!),
  );

  if (!destino) {
    return null;
  }

  await tx.ticket.update({
    where: { id: idTicket },
    data: { status: destino },
  });

  await tx.ticketHistorico.create({
    data: {
      idTicket,
      tipoEvento: TipoEvento.mudanca_status,
      status: destino,
      idUsuario: null,
      texto: 'Sistema: todas as solicitações foram respondidas ou recusadas',
    },
  });

  return destino;
}
