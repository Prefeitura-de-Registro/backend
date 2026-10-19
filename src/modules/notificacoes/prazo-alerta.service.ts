import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import {
  criarNotificacoes,
  notificarDepartamento,
} from '../../shared/notifications/notificacao.service.js';

const INTERVALO_MS = 30 * 60 * 1000;

/**
 * Gera a notificação "chamado próximo do prazo" para tickets em aberto cujo
 * tempo restante de resolução caiu para `percentualRestante`% (ou menos) do
 * prazo total, inclusive os já vencidos. Cada ticket é avisado uma única vez.
 * Avisa o funcionário responsável; sem responsável, o departamento todo.
 */
export async function notificarChamadosProximosDoPrazo(
  percentualRestante = Number(process.env.PRAZO_ALERTA_PERCENTUAL ?? 20),
): Promise<number> {
  const tickets = await prisma.$queryRaw<
    { id: number; id_departamento: number; id_funcionario: number | null }[]
  >(Prisma.sql`
    SELECT t.id,
           t.id_departamento,
           t.id_funcionario_responsavel AS id_funcionario
    FROM tickets t
    WHERE t.status NOT IN ('resolvido', 'fechado')
      AND (t.created_at + t.prazo_resolucao_minutos * INTERVAL '1 minute') - now()
          <= (t.prazo_resolucao_minutos * (${percentualRestante}::float8 / 100.0)) * INTERVAL '1 minute'
      AND NOT EXISTS (
        SELECT 1 FROM notificacoes n
        WHERE n.id_ticket = t.id AND n.tipo_evento = 'chamado_proximo_prazo'
      )
  `);

  for (const ticket of tickets) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const dados = {
        tipoEvento: 'chamado_proximo_prazo' as const,
        idTicket: ticket.id,
      };

      if (ticket.id_funcionario) {
        await criarNotificacoes(tx, [ticket.id_funcionario], dados);
      } else {
        await notificarDepartamento(tx, ticket.id_departamento, dados);
      }
    });
  }

  return tickets.length;
}

/** Roda a verificação ao subir o servidor e a cada 30 minutos. */
export function iniciarAlertaDePrazos(): void {
  if (process.env.PRAZO_ALERTA_DISABLED === 'true') {
    return;
  }

  const executar = () =>
    notificarChamadosProximosDoPrazo().catch((erro: unknown) => {
      console.error('Falha ao verificar chamados próximos do prazo', erro);
    });

  void executar();
  setInterval(executar, INTERVALO_MS).unref();
}
