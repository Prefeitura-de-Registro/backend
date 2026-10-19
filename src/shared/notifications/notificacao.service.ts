import type { NotificacaoTipo, Prisma } from '@prisma/client';

type Dados = {
  tipoEvento: NotificacaoTipo;
  idTicket: number;
  idSolicitacao?: number;
};

/**
 * Notificação para todos os usuários ativos vinculados ao departamento
 * (funcionários e gestores). Fica como `pendente`/`push`: o envio real
 * (push/e-mail) é outra etapa e vai consumir esta fila.
 * `excetoUsuarioId` evita avisar quem causou o evento.
 */
export async function notificarDepartamento(
  tx: Prisma.TransactionClient,
  idDepartamento: number,
  dados: Dados,
  excetoUsuarioId?: number,
): Promise<void> {
  const vinculos = await tx.usuarioDepartamento.findMany({
    where: {
      idDepartamento,
      usuario: { ativo: true, reservado: false },
      ...(excetoUsuarioId ? { idUsuario: { not: excetoUsuarioId } } : {}),
    },
    select: { idUsuario: true },
  });

  await criarNotificacoes(
    tx,
    vinculos.map((vinculo: { idUsuario: number }) => vinculo.idUsuario),
    dados,
  );
}

export async function criarNotificacoes(
  tx: Prisma.TransactionClient,
  idsUsuarios: number[],
  dados: Dados,
): Promise<void> {
  const unicos = [...new Set(idsUsuarios)];

  if (unicos.length === 0) {
    return;
  }

  await tx.notificacao.createMany({
    data: unicos.map((idUsuario) => ({
      idUsuario,
      tipoEvento: dados.tipoEvento,
      idTicket: dados.idTicket,
      idSolicitacao: dados.idSolicitacao ?? null,
    })),
  });
}
