import { randomBytes } from 'node:crypto';
import { Prisma, TipoEvento } from '@prisma/client';
import {
  assertDepartmentAccess,
  assertFuncionarioPertenceAoDepartamento,
  getAccessibleDepartamentoIds,
} from '../../shared/authorization/department-scope.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notificarDepartamento } from '../../shared/notifications/notificacao.service.js';
import { removerArquivos, salvarMidia } from '../../shared/storage/storage.js';
import { mimePorExtensao } from '../../shared/utils/image.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import {
  buscarLocalizacao,
  buscarLocalizacoes,
} from '../../shared/utils/localizacao.js';
import { getUsuarioAnonimoId } from '../../shared/utils/usuario-anonimo.js';
import type {
  CreateSolicitacaoBodyDTO,
  CreateTicketBodyDTO,
  GetManyTicketsQueryDTO,
  GetMeusTicketsQueryDTO,
  UpdateTicketBodyDTO,
} from './dtos/ticket.dto.js';
import { normalizarProtocolo } from './rules/protocolo.rules.js';
import { calcularSla } from './rules/sla.rules.js';
import { marcarTicketPendente } from './ticket-status.service.js';

type ArquivoUpload = { path: string; originalname: string };

const STATUS_SOLICITACAO_ABERTA = ['pendente', 'em_analise'] as const;

// Visão do munícipe/anônimo: nada interno (responsável, solicitações,
// justificativas, usuário que mexeu no ticket).
const ticketPublicoSelect = {
  id: true,
  protocolo: true,
  status: true,
  prioridade: true,
  descricao: true,
  endereco: true,
  pontoReferencia: true,
  prazoPrimeiraRespostaMinutos: true,
  prazoResolucaoMinutos: true,
  createdAt: true,
  categoria: { select: { id: true, nome: true } },
  departamento: { select: { id: true, nome: true, sigla: true } },
  // Perguntas e respostas do formulário (sem reducao/critica: regra interna de SLA).
  respostas: {
    orderBy: { pergunta: { ordem: 'asc' } },
    select: {
      valor: true,
      pergunta: { select: { id: true, enunciado: true, ordem: true } },
    },
  },
  arquivos: {
    orderBy: { id: 'asc' },
    select: { id: true, tipo: true, path: true, createdAt: true },
  },
  historicos: {
    where: {
      tipoEvento: {
        in: [
          TipoEvento.criacao,
          TipoEvento.mudanca_status,
          TipoEvento.ajuste_prazo,
        ],
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      tipoEvento: true,
      status: true,
      prazoMinutos: true,
      createdAt: true,
    },
  },
} satisfies Prisma.TicketSelect;

function adicionarPrazos<
  T extends {
    createdAt: Date;
    prazoPrimeiraRespostaMinutos: number;
    prazoResolucaoMinutos: number;
  },
>(ticket: T) {
  const em = (minutos: number) =>
    new Date(ticket.createdAt.getTime() + minutos * 60_000);

  return {
    ...ticket,
    prazoPrimeiraRespostaEm: em(ticket.prazoPrimeiraRespostaMinutos),
    prazoResolucaoEm: em(ticket.prazoResolucaoMinutos),
  };
}

function urlArquivo(id: number) {
  return `/api/arquivos/${id}`;
}

type ArquivoComPath = {
  id: number;
  tipo: string | null;
  path: string;
  createdAt: Date;
};

type TicketPublico = Parameters<typeof adicionarPrazos>[0] & {
  id: number;
  arquivos: ArquivoComPath[];
};

// Colunas que só aparecem quando o acesso é por token (link secreto) ou pelo
// próprio dono: protocolo é sequencial e fácil de adivinhar.
const CAMPOS_DE_LOCALIZACAO = ['endereco', 'pontoReferencia'] as const;

const ticketDetailInclude = {
  usuario: { select: { id: true, name: true, email: true } },
  categoria: true,
  departamento: true,
  funcionarioResponsavel: { select: { id: true, name: true, email: true } },
  respostas: { include: { pergunta: true } },
  historicos: {
    orderBy: { createdAt: 'desc' },
    include: { usuario: { select: { id: true, name: true } } },
  },
  solicitacoes: {
    orderBy: { createdAt: 'desc' },
    include: { departamentoSolicitado: true },
  },
  arquivos: {
    orderBy: { id: 'asc' },
    select: { id: true, tipo: true, path: true, createdAt: true },
  },
} satisfies Prisma.TicketInclude;

const ticketListInclude = {
  categoria: true,
  departamento: true,
  funcionarioResponsavel: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

class TicketService {
  async getMany(user: TokenPayload, query: GetManyTicketsQueryDTO) {
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

    if (
      query.idDepartamento &&
      Array.isArray(scope) &&
      !scope.includes(query.idDepartamento)
    ) {
      throw new AppError('Você não tem acesso a este departamento', 403);
    }

    const where: Prisma.TicketWhereInput = {
      idDepartamento:
        query.idDepartamento ??
        (Array.isArray(scope) ? { in: scope } : undefined),
      status: query.status,
      prioridade: query.prioridade,
      OR: query.busca
        ? [
            { descricao: { contains: query.busca, mode: 'insensitive' } },
            { protocolo: { contains: query.busca, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [data, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ prioridade: 'desc' }, { createdAt: 'asc' }],
        include: ticketListInclude,
      }),
      prisma.ticket.count({ where }),
    ]);

    const localizacoes = await buscarLocalizacoes(
      data.map((ticket: { id: number }) => ticket.id),
    );

    return {
      data: data.map((ticket: { id: number }) => ({
        ...ticket,
        localizacao: localizacoes.get(ticket.id) ?? null,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async getById(user: TokenPayload, id: number) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    return this.detalhar(id);
  }

  // Detalhe operacional: inclui localização (PostGIS) e URLs dos arquivos.
  private async detalhar(id: number) {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: ticketDetailInclude,
    });

    return {
      ...ticket,
      localizacao: await buscarLocalizacao(id),
      arquivos: ticket.arquivos.map(({ path, ...arquivo }: ArquivoComPath) => ({
        ...arquivo,
        mime: mimePorExtensao(path),
        url: urlArquivo(arquivo.id),
      })),
    };
  }

  async assume(user: TokenPayload, id: number) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.ticket.updateMany({
        where: { id, idFuncionarioResponsavel: null },
        data: { idFuncionarioResponsavel: user.id },
      });

      if (result.count === 0) {
        throw new AppError('Ticket já possui um responsável', 409);
      }

      await tx.ticketHistorico.create({
        data: {
          idTicket: id,
          tipoEvento: TipoEvento.atribuicao,
          idUsuario: user.id,
          createdAt: new Date(),
        },
      });
    });

    return this.detalhar(id);
  }

  async update(user: TokenPayload, id: number, body: UpdateTicketBodyDTO) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    if (
      body.idFuncionarioResponsavel !== undefined &&
      body.idFuncionarioResponsavel !== null
    ) {
      await assertFuncionarioPertenceAoDepartamento(
        body.idFuncionarioResponsavel,
        ticket.idDepartamento,
      );
    }

    const data: Prisma.TicketUpdateInput = {};
    const historicos: Prisma.TicketHistoricoCreateManyInput[] = [];
    const agora = new Date();

    if (body.status !== undefined && body.status !== ticket.status) {
      data.status = body.status;
      historicos.push({
        idTicket: id,
        tipoEvento: TipoEvento.mudanca_status,
        status: body.status,
        idUsuario: user.id,
        createdAt: agora,
      });
    }

    if (
      body.prioridade !== undefined &&
      body.prioridade !== ticket.prioridade
    ) {
      data.prioridade = body.prioridade;
    }

    if (body.descricao !== undefined && body.descricao !== ticket.descricao) {
      data.descricao = body.descricao;
    }

    if (
      body.prazoPrimeiraRespostaMinutos !== undefined &&
      body.prazoPrimeiraRespostaMinutos !== ticket.prazoPrimeiraRespostaMinutos
    ) {
      data.prazoPrimeiraRespostaMinutos = body.prazoPrimeiraRespostaMinutos;
      historicos.push({
        idTicket: id,
        tipoEvento: TipoEvento.ajuste_prazo,
        prazoMinutos: body.prazoPrimeiraRespostaMinutos,
        idUsuario: user.id,
        texto: 'Ajuste do prazo de primeira resposta',
        createdAt: agora,
      });
    }

    if (
      body.prazoResolucaoMinutos !== undefined &&
      body.prazoResolucaoMinutos !== ticket.prazoResolucaoMinutos
    ) {
      data.prazoResolucaoMinutos = body.prazoResolucaoMinutos;
      historicos.push({
        idTicket: id,
        tipoEvento: TipoEvento.ajuste_prazo,
        prazoMinutos: body.prazoResolucaoMinutos,
        idUsuario: user.id,
        texto: 'Ajuste do prazo de resolução',
        createdAt: agora,
      });
    }

    if (
      body.idFuncionarioResponsavel !== undefined &&
      body.idFuncionarioResponsavel !== ticket.idFuncionarioResponsavel
    ) {
      data.funcionarioResponsavel = body.idFuncionarioResponsavel
        ? { connect: { id: body.idFuncionarioResponsavel } }
        : { disconnect: true };
      historicos.push({
        idTicket: id,
        tipoEvento: TipoEvento.atribuicao,
        idUsuario: user.id,
        createdAt: agora,
      });
    }

    if (Object.keys(data).length === 0) {
      return this.detalhar(id);
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.ticket.update({ where: { id }, data });

      if (historicos.length > 0) {
        await tx.ticketHistorico.createMany({ data: historicos });
      }
    });

    return this.detalhar(id);
  }

  async createSolicitacao(
    user: TokenPayload,
    id: number,
    body: CreateSolicitacaoBodyDTO,
  ) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    if (body.idDepartamentoSolicitado === ticket.idDepartamento) {
      throw new AppError(
        'O departamento solicitado deve ser diferente do departamento responsável pelo ticket',
        400,
      );
    }

    if (ticket.status === 'resolvido' || ticket.status === 'fechado') {
      throw new AppError(
        'Não é possível criar solicitação em um ticket resolvido ou fechado',
        409,
      );
    }

    const departamentoSolicitado = await prisma.departamento.findUnique({
      where: { id: body.idDepartamentoSolicitado },
    });

    if (!departamentoSolicitado) {
      throw new AppError('Departamento solicitado não encontrado', 404);
    }

    if (!departamentoSolicitado.ativo) {
      throw new AppError('Departamento solicitado está inativo', 400);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Evita duplicar: já existe pedido em aberto para o mesmo departamento.
      const emAberto = await tx.solicitacao.findFirst({
        where: {
          idTicket: id,
          idDepartamentoSolicitado: body.idDepartamentoSolicitado,
          status: { in: [...STATUS_SOLICITACAO_ABERTA] },
        },
        select: { id: true },
      });

      if (emAberto) {
        throw new AppError(
          'Já existe uma solicitação em aberto para este departamento neste ticket',
          409,
        );
      }

      const solicitacao = await tx.solicitacao.create({
        data: {
          idTicket: id,
          idDepartamentoSolicitado: body.idDepartamentoSolicitado,
          descricao: body.descricao,
        },
        include: { departamentoSolicitado: true },
      });

      // Doc (seção 7): ticket fica `pendente` enquanto espera a resposta.
      await marcarTicketPendente(
        tx,
        id,
        user.id,
        `Aguardando solicitação ao departamento ${departamentoSolicitado.nome}`,
      );

      await notificarDepartamento(
        tx,
        body.idDepartamentoSolicitado,
        {
          tipoEvento: 'nova_solicitacao',
          idTicket: id,
          idSolicitacao: solicitacao.id,
        },
        user.id,
      );

      return solicitacao;
    });
  }

  async getSolicitacoes(user: TokenPayload, id: number) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    return prisma.solicitacao.findMany({
      where: { idTicket: id },
      orderBy: { createdAt: 'desc' },
      include: {
        departamentoSolicitado: true,
        usuarioRespondedor: { select: { id: true, name: true } },
        mensagens: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /**
   * Abertura de chamado (anônimo ou logado). Tudo na mesma transação: ticket,
   * protocolo, respostas, evento `criacao`, solicitações automáticas
   * (perguntas com departamento solicitado respondidas "sim"), fotos e
   * notificações.
   */
  async create(
    user: TokenPayload,
    body: CreateTicketBodyDTO,
    arquivos: ArquivoUpload[],
  ) {
    const categoria = await prisma.categoria.findFirst({
      where: {
        id: body.idCategoria,
        ativo: true,
        departamento: { ativo: true },
      },
      include: { perguntas: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }] } },
    });

    if (!categoria) {
      throw new AppError('Categoria não encontrada', 404);
    }

    const idsPerguntas = new Set<number>(
      categoria.perguntas.map((pergunta: { id: number }) => pergunta.id),
    );
    const respostasPorPergunta = new Map<number, boolean>();

    for (const resposta of body.respostas) {
      if (!idsPerguntas.has(resposta.idPergunta)) {
        throw new AppError(
          `A pergunta ${resposta.idPergunta} não pertence à categoria informada`,
          400,
        );
      }
      if (respostasPorPergunta.has(resposta.idPergunta)) {
        throw new AppError(
          `A pergunta ${resposta.idPergunta} foi respondida mais de uma vez`,
          400,
        );
      }
      respostasPorPergunta.set(resposta.idPergunta, resposta.valor);
    }

    const respostasSim = new Set<number>(
      [...respostasPorPergunta.entries()]
        .filter(([, valor]) => valor)
        .map(([idPergunta]) => idPergunta),
    );

    const sla = calcularSla(categoria, categoria.perguntas, respostasSim);
    const anonimo = user.tipoUsuario === 'anonimo';
    const idUsuario = anonimo ? await getUsuarioAnonimoId() : user.id;
    const tokenAcesso = anonimo ? randomBytes(16).toString('hex') : null;

    // Uma solicitação por departamento (sem duplicar), nunca para o próprio.
    const solicitacoesAutomaticas = new Map<number, string>();
    for (const pergunta of categoria.perguntas) {
      if (
        respostasSim.has(pergunta.id) &&
        pergunta.idDepartamentoSolicitado &&
        pergunta.idDepartamentoSolicitado !== categoria.idDepartamento &&
        !solicitacoesAutomaticas.has(pergunta.idDepartamentoSolicitado)
      ) {
        solicitacoesAutomaticas.set(
          pergunta.idDepartamentoSolicitado,
          `Solicitação automática: ${pergunta.enunciado}`,
        );
      }
    }

    const arquivosSalvos: string[] = [];

    try {
      const criado = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const ticket = await tx.ticket.create({
            data: {
              idUsuario,
              idCategoria: categoria.id,
              idDepartamento: categoria.idDepartamento,
              prioridade: sla.prioridade,
              descricao: body.descricao ?? null,
              endereco: body.endereco ?? null,
              pontoReferencia: body.pontoReferencia ?? null,
              tokenAcesso,
              prazoPrimeiraRespostaMinutos: sla.prazoPrimeiraRespostaMinutos,
              prazoResolucaoMinutos: sla.prazoResolucaoMinutos,
            },
          });

          const protocolo = `REG-${ticket.createdAt.getFullYear()}-${String(ticket.id).padStart(6, '0')}`;

          await tx.ticket.update({
            where: { id: ticket.id },
            data: { protocolo },
          });

          if (body.latitude !== undefined && body.longitude !== undefined) {
            await tx.$executeRaw(Prisma.sql`
              UPDATE tickets
              SET geom = ST_SetSRID(ST_MakePoint(${body.longitude}::float8, ${body.latitude}::float8), 4326)::geography
              WHERE id = ${ticket.id}
            `);
          }

          await tx.resposta.createMany({
            data: categoria.perguntas.map((pergunta: { id: number }) => ({
              idPergunta: pergunta.id,
              idTicket: ticket.id,
              valor: respostasSim.has(pergunta.id),
            })),
          });

          await tx.ticketHistorico.create({
            data: {
              idTicket: ticket.id,
              tipoEvento: TipoEvento.criacao,
              status: 'aberto',
              prazoMinutos: sla.prazoResolucaoMinutos,
              idUsuario,
            },
          });

          let status: 'aberto' | 'pendente' = 'aberto';

          for (const [idDepartamento, descricao] of solicitacoesAutomaticas) {
            const solicitacao = await tx.solicitacao.create({
              data: {
                idTicket: ticket.id,
                idDepartamentoSolicitado: idDepartamento,
                descricao,
              },
            });

            await notificarDepartamento(tx, idDepartamento, {
              tipoEvento: 'nova_solicitacao',
              idTicket: ticket.id,
              idSolicitacao: solicitacao.id,
            });
          }

          if (solicitacoesAutomaticas.size > 0) {
            await marcarTicketPendente(
              tx,
              ticket.id,
              null,
              'Sistema: aguardando resposta de solicitação a outro departamento',
            );
            status = 'pendente';
          }

          if (arquivos.length > 0) {
            const salvos = [];
            for (const arquivo of arquivos) {
              const salvo = await salvarMidia(arquivo, `tickets/${ticket.id}`);
              arquivosSalvos.push(salvo.path);
              salvos.push(salvo);
            }

            await tx.arquivo.createMany({
              data: salvos.map((salvo) => ({
                idTicket: ticket.id,
                path: salvo.path,
                tipo:
                  salvo.tipo === 'video' ? 'video_abertura' : 'foto_abertura',
              })),
            });
          }

          await notificarDepartamento(tx, categoria.idDepartamento, {
            tipoEvento: 'novo_ticket',
            idTicket: ticket.id,
          });

          return { ticket, protocolo, status };
        },
        { timeout: 20_000 },
      );

      const { ticket, protocolo, status } = criado;

      return {
        id: ticket.id,
        protocolo,
        status,
        prioridade: ticket.prioridade,
        prazoPrimeiraRespostaMinutos: ticket.prazoPrimeiraRespostaMinutos,
        prazoResolucaoMinutos: ticket.prazoResolucaoMinutos,
        createdAt: ticket.createdAt,
        localizacao:
          body.latitude !== undefined && body.longitude !== undefined
            ? { latitude: body.latitude, longitude: body.longitude }
            : null,
        ...(tokenAcesso
          ? {
              tokenAcesso,
              linkAcompanhamento: `${process.env.FRONTEND_URL ?? ''}/acompanhar/${tokenAcesso}`,
              apiAcompanhamento: `/api/tickets/acompanhar/${tokenAcesso}`,
            }
          : {}),
      };
    } catch (error) {
      await removerArquivos(arquivosSalvos);
      throw error;
    }
  }

  /** Chamados do munícipe logado (visão pública, sem dados internos). */
  async getMeus(user: TokenPayload, query: GetMeusTicketsQueryDTO) {
    const where: Prisma.TicketWhereInput = {
      idUsuario: user.id,
      status: query.status ? { in: query.status } : undefined,
    };

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          protocolo: true,
          status: true,
          prioridade: true,
          descricao: true,
          endereco: true,
          prazoPrimeiraRespostaMinutos: true,
          prazoResolucaoMinutos: true,
          createdAt: true,
          categoria: { select: { id: true, nome: true } },
          departamento: { select: { id: true, nome: true, sigla: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    const localizacoes = await buscarLocalizacoes(
      tickets.map((ticket: { id: number }) => ticket.id),
    );

    return {
      data: tickets.map(
        (ticket: Parameters<typeof adicionarPrazos>[0] & { id: number }) => ({
          ...adicionarPrazos(ticket),
          localizacao: localizacoes.get(ticket.id) ?? null,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async getMeuById(user: TokenPayload, id: number) {
    const ticket = await prisma.ticket.findFirst({
      where: { id, idUsuario: user.id },
      select: ticketPublicoSelect,
    });

    if (!ticket) {
      throw new AppError('Chamado não encontrado', 404);
    }

    return this.visaoPublica(ticket, `/api/arquivos`, true);
  }

  /**
   * Acompanhamento sem login. O código pode ser o TOKEN do link (32 caracteres,
   * secreto: visão completa) ou o PROTOCOLO que o app mostra ao abrir o chamado
   * (visão sem endereço/localização, pois protocolo é sequencial).
   */
  async acompanhar(codigo: string) {
    const { ticket, completo } = await this.buscarPorCodigo(codigo);

    return this.visaoPublica(
      ticket,
      `/api/tickets/acompanhar/${encodeURIComponent(codigo)}/arquivos`,
      completo,
    );
  }

  /** Mídia do chamado para quem acompanha sem login (só arquivos do próprio ticket). */
  async getArquivoPublico(codigo: string, idArquivo: number) {
    const { ticket } = await this.buscarPorCodigo(codigo);
    const arquivo = ticket.arquivos.find(
      (a: ArquivoComPath) => a.id === idArquivo,
    );

    if (!arquivo) {
      throw new AppError('Arquivo não encontrado', 404);
    }

    return arquivo.path;
  }

  private async buscarPorCodigo(codigo: string) {
    const protocolo = normalizarProtocolo(codigo);

    const ticket = protocolo
      ? await prisma.ticket.findUnique({
          where: { protocolo },
          select: ticketPublicoSelect,
        })
      : await prisma.ticket.findUnique({
          where: { tokenAcesso: codigo },
          select: ticketPublicoSelect,
        });

    if (!ticket) {
      throw new AppError('Chamado não encontrado', 404);
    }

    return { ticket, completo: !protocolo };
  }

  private async visaoPublica(
    ticket: TicketPublico,
    urlBaseArquivos: string,
    completo: boolean,
  ) {
    const { arquivos, ...resto } = adicionarPrazos(ticket);
    const visao: Record<string, unknown> = {
      ...resto,
      arquivos: arquivos.map(({ path, ...arquivo }) => ({
        ...arquivo,
        mime: mimePorExtensao(path),
        url: `${urlBaseArquivos}/${arquivo.id}`,
      })),
    };

    if (completo) {
      visao.localizacao = await buscarLocalizacao(ticket.id);
    } else {
      for (const campo of CAMPOS_DE_LOCALIZACAO) {
        delete visao[campo];
      }
    }

    return visao;
  }

  private async findTicketOrThrow(id: number) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    return ticket;
  }
}

export const ticketService = new TicketService();
