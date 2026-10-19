import { Prisma, SolicitacaoStatus } from '@prisma/client';
import {
  assertDepartmentAccess,
  getAccessibleDepartamentoIds,
  type DepartmentScope,
} from '../../shared/authorization/department-scope.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  criarNotificacoes,
  notificarDepartamento,
} from '../../shared/notifications/notificacao.service.js';
import { removerArquivos, salvarMidia } from '../../shared/storage/storage.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import { mimePorExtensao } from '../../shared/utils/image.js';
import { buscarLocalizacao } from '../../shared/utils/localizacao.js';
import { reverterStatusSeSolicitacoesFinalizadas } from '../tickets/ticket-status.service.js';
import type {
  CreateMensagemBodyDTO,
  GetManySolicitacoesQueryDTO,
  RespondSolicitacaoBodyDTO,
} from './dtos/solicitacao.dto.js';

type ArquivoUpload = { path: string; originalname: string };

const ticketResumoSelect = {
  id: true,
  protocolo: true,
  status: true,
  prioridade: true,
  descricao: true,
  endereco: true,
  pontoReferencia: true,
  idDepartamento: true,
  createdAt: true,
  categoria: { select: { id: true, nome: true } },
  departamento: { select: { id: true, nome: true, sigla: true } },
} satisfies Prisma.TicketSelect;

const mensagemInclude = {
  usuario: { select: { id: true, name: true, cargo: true } },
  arquivos: {
    orderBy: { id: 'asc' },
    select: { id: true, tipo: true, path: true, createdAt: true },
  },
} satisfies Prisma.SolicitacaoMensagemInclude;

function comUrls<T extends { arquivos: { id: number; path: string }[] }>(
  mensagem: T,
) {
  return {
    ...mensagem,
    arquivos: mensagem.arquivos.map(({ path, ...arquivo }) => ({
      ...arquivo,
      mime: mimePorExtensao(path),
      url: `/api/arquivos/${arquivo.id}`,
    })),
  };
}

function escopoPorTipo(
  tipo: 'recebidas' | 'enviadas',
  scope: DepartmentScope,
): Prisma.SolicitacaoWhereInput {
  if (scope === 'all') {
    return {};
  }

  return tipo === 'recebidas'
    ? { idDepartamentoSolicitado: { in: scope } }
    : { ticket: { idDepartamento: { in: scope } } };
}

class SolicitacaoService {
  /**
   * recebidas: pedidos feitos AO(s) departamento(s) do funcionário.
   * enviadas: pedidos feitos a partir de tickets do(s) departamento(s) dele.
   * Gestor ("all") enxerga todas.
   */
  async getMany(user: TokenPayload, query: GetManySolicitacoesQueryDTO) {
    const scope = await getAccessibleDepartamentoIds(user);

    if (Array.isArray(scope) && scope.length === 0) {
      return {
        data: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where: Prisma.SolicitacaoWhereInput = {
      ...escopoPorTipo(query.tipo, scope),
      status: query.status,
    };

    const [data, total] = await prisma.$transaction([
      prisma.solicitacao.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: { select: ticketResumoSelect },
          departamentoSolicitado: {
            select: { id: true, nome: true, sigla: true },
          },
          usuarioRespondedor: { select: { id: true, name: true } },
          _count: { select: { mensagens: true } },
        },
      }),
      prisma.solicitacao.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async getById(user: TokenPayload, id: number) {
    await this.assertAcesso(user, id);

    const solicitacao = await prisma.solicitacao.findUniqueOrThrow({
      where: { id },
      include: {
        ticket: { select: ticketResumoSelect },
        departamentoSolicitado: {
          select: { id: true, nome: true, sigla: true },
        },
        usuarioRespondedor: { select: { id: true, name: true } },
        mensagens: { orderBy: { createdAt: 'asc' }, include: mensagemInclude },
      },
    });

    return {
      ...solicitacao,
      ticket: {
        ...solicitacao.ticket,
        localizacao: await buscarLocalizacao(solicitacao.idTicket),
      },
      mensagens: solicitacao.mensagens.map(comUrls),
    };
  }

  async getMensagens(user: TokenPayload, id: number) {
    await this.assertAcesso(user, id);

    const mensagens = await prisma.solicitacaoMensagem.findMany({
      where: { idSolicitacao: id },
      orderBy: { createdAt: 'asc' },
      include: mensagemInclude,
    });

    return mensagens.map(comUrls);
  }

  /**
   * Mensagem do chat interno entre departamentos (com até 5 imagens). Quem
   * pode: funcionário/gestor do departamento dono do ticket OU do solicitado.
   * Só enquanto a solicitação estiver em aberto (doc, seção 10).
   */
  async createMensagem(
    user: TokenPayload,
    id: number,
    body: CreateMensagemBodyDTO,
    arquivos: ArquivoUpload[],
  ) {
    const solicitacao = await this.assertAcesso(user, id);

    if (
      solicitacao.status === SolicitacaoStatus.respondida ||
      solicitacao.status === SolicitacaoStatus.recusada
    ) {
      throw new AppError(
        'Esta solicitação já foi finalizada: não é possível enviar mensagens',
        409,
      );
    }

    const salvos: string[] = [];

    try {
      const idMensagem = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const mensagem = await tx.solicitacaoMensagem.create({
            data: {
              idSolicitacao: id,
              idUsuario: user.id,
              mensagem: body.mensagem,
            },
          });

          if (arquivos.length > 0) {
            const registros = [];
            for (const arquivo of arquivos) {
              const salvo = await salvarMidia(
                arquivo,
                `solicitacoes/${id}/mensagens/${mensagem.id}`,
              );
              salvos.push(salvo.path);
              registros.push({
                idSolicitacaoMensagem: mensagem.id,
                path: salvo.path,
                tipo:
                  salvo.tipo === 'video' ? 'video_mensagem' : 'foto_mensagem',
              });
            }
            await tx.arquivo.createMany({ data: registros });
          }

          return mensagem.id;
        },
        { timeout: 20_000 },
      );

      const mensagem = await prisma.solicitacaoMensagem.findUniqueOrThrow({
        where: { id: idMensagem },
        include: mensagemInclude,
      });

      return comUrls(mensagem);
    } catch (error) {
      await removerArquivos(salvos);
      throw error;
    }
  }

  async respond(
    user: TokenPayload,
    id: number,
    body: RespondSolicitacaoBodyDTO,
  ) {
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      include: { ticket: { select: { idDepartamento: true } } },
    });

    if (!solicitacao) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    // O funcionário que responde precisa pertencer ao departamento
    // SOLICITADO, não ao departamento responsável pelo ticket original.
    await assertDepartmentAccess(user, solicitacao.idDepartamentoSolicitado);

    if (
      solicitacao.status === SolicitacaoStatus.respondida ||
      solicitacao.status === SolicitacaoStatus.recusada
    ) {
      throw new AppError('Esta solicitação já foi finalizada', 409);
    }

    const finalizando =
      body.status === 'respondida' || body.status === 'recusada';

    // Atualiza a solicitação, reverte o status do ticket (se for a última
    // aberta) e avisa o departamento de origem, tudo na mesma transação.
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const atualizada = await tx.solicitacao.update({
        where: { id },
        data: {
          status: body.status,
          resposta: body.resposta ?? solicitacao.resposta,
          respondidoPor: finalizando ? user.id : solicitacao.respondidoPor,
          respondidoEm: finalizando ? new Date() : solicitacao.respondidoEm,
        },
        include: {
          departamentoSolicitado: true,
          ticket: true,
          usuarioRespondedor: { select: { id: true, name: true } },
        },
      });

      if (finalizando) {
        await reverterStatusSeSolicitacoesFinalizadas(tx, solicitacao.idTicket);

        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: solicitacao.idTicket },
          select: { idFuncionarioResponsavel: true },
        });
        const dados = {
          tipoEvento: 'solicitacao_respondida' as const,
          idTicket: solicitacao.idTicket,
          idSolicitacao: id,
        };

        // Com responsável definido, só ele é avisado; senão, o departamento.
        if (ticket.idFuncionarioResponsavel) {
          await criarNotificacoes(tx, [ticket.idFuncionarioResponsavel], dados);
        } else {
          await notificarDepartamento(
            tx,
            solicitacao.ticket.idDepartamento,
            dados,
            user.id,
          );
        }
      }

      // devolve o ticket já com o status revertido
      return {
        ...atualizada,
        ticket: await tx.ticket.findUniqueOrThrow({
          where: { id: solicitacao.idTicket },
        }),
      };
    });
  }

  /** Acesso: departamento dono do ticket OU departamento solicitado. */
  private async assertAcesso(user: TokenPayload, id: number) {
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      include: { ticket: { select: { idDepartamento: true } } },
    });

    if (!solicitacao) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    const scope = await getAccessibleDepartamentoIds(user);

    if (
      scope !== 'all' &&
      !scope.includes(solicitacao.idDepartamentoSolicitado) &&
      !scope.includes(solicitacao.ticket.idDepartamento)
    ) {
      throw new AppError('Você não tem acesso a esta solicitação', 403);
    }

    return solicitacao;
  }
}

export const solicitacaoService = new SolicitacaoService();
