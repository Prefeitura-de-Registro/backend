import type { TicketStatus } from '@prisma/client';

/**
 * Descobre para qual status o ticket deve voltar depois que todas as
 * solicitações foram finalizadas (documentação do banco, seção 7, passo 5).
 *
 * `statusHistoricoDesc`: valores de `ticket_historico.status` (somente linhas
 * com status preenchido), do mais recente para o mais antigo.
 *
 * Regra: o status mais recente precisa ser `pendente` (se o funcionário já
 * mudou o status manualmente, não revertemos nada) e voltamos ao primeiro
 * status anterior diferente de `pendente`.
 */
export function statusAnteriorAoPendente(
  statusHistoricoDesc: TicketStatus[],
): TicketStatus | null {
  if (statusHistoricoDesc[0] !== 'pendente') {
    return null;
  }

  const anterior = statusHistoricoDesc.find((status) => status !== 'pendente');

  return anterior ?? 'aberto';
}
