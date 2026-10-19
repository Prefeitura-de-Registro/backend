import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';

type NotificacaoBruta = {
  tipoEvento: string;
  ticket: {
    protocolo: string | null;
    categoria: { nome: string };
    departamento: { nome: string };
  } | null;
  solicitacao: { departamentoSolicitado: { nome: string } } | null;
};

/** Texto pronto para a tela (título + descrição), montado a partir do evento. */
function comTexto<T extends NotificacaoBruta>(notificacao: T) {
  const protocolo = notificacao.ticket?.protocolo ?? '';

  const textos: Record<string, { titulo: string; descricao: string }> = {
    novo_ticket: {
      titulo: 'Novo chamado',
      descricao: `Nova ocorrência registrada: ${notificacao.ticket?.categoria.nome ?? ''} (${protocolo})`,
    },
    nova_solicitacao: {
      titulo: 'Nova solicitação recebida',
      descricao: `O departamento ${notificacao.ticket?.departamento.nome ?? ''} enviou uma solicitação referente ao chamado ${protocolo}`,
    },
    solicitacao_respondida: {
      titulo: 'Solicitação respondida',
      descricao: `O departamento ${notificacao.solicitacao?.departamentoSolicitado.nome ?? ''} respondeu a solicitação do chamado ${protocolo}`,
    },
    chamado_proximo_prazo: {
      titulo: 'Chamado próximo do prazo',
      descricao: `O chamado ${protocolo} está próximo do prazo de atendimento`,
    },
  };

  return { ...notificacao, ...textos[notificacao.tipoEvento] };
}

type ListQuery = { status: 'nao_lidas' | 'todas'; page: number; limit: number };

class NotificacaoService {
  async list(user: TokenPayload, query: ListQuery) {
    const where: Prisma.NotificacaoWhereInput = {
      idUsuario: user.id,
      ...(query.status === 'nao_lidas' ? { lidoEm: null } : {}),
    };

    const [data, total, naoLidas] = await prisma.$transaction([
      prisma.notificacao.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          tipoEvento: true,
          createdAt: true,
          lidoEm: true,
          ticket: {
            select: {
              id: true,
              protocolo: true,
              status: true,
              categoria: { select: { nome: true } },
              departamento: { select: { nome: true } },
            },
          },
          solicitacao: {
            select: {
              id: true,
              status: true,
              departamentoSolicitado: { select: { nome: true } },
            },
          },
        },
      }),
      prisma.notificacao.count({ where }),
      prisma.notificacao.count({
        where: { idUsuario: user.id, lidoEm: null },
      }),
    ]);

    return {
      data: data.map(comTexto),
      naoLidas,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async marcarComoLida(user: TokenPayload, id: number) {
    // Só mexe em notificação do próprio usuário (senão 404, sem vazar existência).
    const notificacao = await prisma.notificacao.findFirst({
      where: { id, idUsuario: user.id },
      select: { id: true, lidoEm: true },
    });

    if (!notificacao) {
      throw new AppError('Notificação não encontrada', 404);
    }

    if (notificacao.lidoEm) {
      return { id, lidoEm: notificacao.lidoEm };
    }

    const atualizada = await prisma.notificacao.update({
      where: { id },
      data: { status: 'lida', lidoEm: new Date() },
      select: { id: true, lidoEm: true },
    });

    return atualizada;
  }

  async marcarTodasComoLidas(user: TokenPayload) {
    const resultado = await prisma.notificacao.updateMany({
      where: { idUsuario: user.id, lidoEm: null },
      data: { status: 'lida', lidoEm: new Date() },
    });

    return { atualizadas: resultado.count };
  }
}

export const notificacaoService = new NotificacaoService();
