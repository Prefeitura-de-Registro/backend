import { Prisma, TipoEvento } from '@prisma/client';
import {
  assertDepartmentAccess,
  assertFuncionarioPertenceAoDepartamento,
  getAccessibleDepartamentoIds,
} from '../../shared/authorization/department-scope.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import type {
  CreateSolicitacaoBodyDTO,
  CreateTicketBodyDTO,
  GetManyTicketsQueryDTO,
  UpdateTicketBodyDTO,
} from './dtos/ticket.dto.js';
import { calcularSla } from './rules/sla.rules.js';

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
  arquivos: true,
} satisfies Prisma.TicketInclude;

const ticketListInclude = {
  categoria: true,
  departamento: true,
  funcionarioResponsavel: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

class TicketService {
  async create(user: TokenPayload, body: CreateTicketBodyDTO) {
    const categoria = await prisma.categoria.findFirst({
      where: {
        id: body.idCategoria,
        ativo: true,
        departamento: { ativo: true },
      },
      include: {
        perguntas: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }] },
      },
    });

    if (!categoria) {
      throw new AppError('Categoria não encontrada', 404);
    }

    const perguntasDaCategoria = new Set(
      categoria.perguntas.map((pergunta) => pergunta.id),
    );
    const respostasPorPergunta = new Map<number, boolean>();

    for (const resposta of body.respostas) {
      if (!perguntasDaCategoria.has(resposta.idPergunta)) {
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

    const respostasSim = new Set(
      [...respostasPorPergunta.entries()]
        .filter(([, valor]) => valor)
        .map(([idPergunta]) => idPergunta),
    );
    const sla = calcularSla(categoria, categoria.perguntas, respostasSim);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ticket = await tx.ticket.create({
        data: {
          idUsuario: user.id,
          idCategoria: categoria.id,
          idDepartamento: categoria.idDepartamento,
          descricao: body.descricao ?? null,
          prioridade: sla.prioridade,
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
          SET geom = ST_SetSRID(
            ST_MakePoint(${body.longitude}::double precision, ${body.latitude}::double precision),
            4326
          )::geography
          WHERE id = ${ticket.id}
        `);
      }

      if (categoria.perguntas.length > 0) {
        await tx.resposta.createMany({
          data: categoria.perguntas.map((pergunta) => ({
            idPergunta: pergunta.id,
            idTicket: ticket.id,
            valor: respostasPorPergunta.get(pergunta.id) ?? false,
          })),
        });
      }

      await tx.ticketHistorico.create({
        data: {
          idTicket: ticket.id,
          tipoEvento: TipoEvento.criacao,
          status: 'aberto',
          prazoMinutos: sla.prazoResolucaoMinutos,
          idUsuario: user.id,
        },
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: ticketDetailInclude,
      });
    });
  }

  async getMany(user: TokenPayload, query: GetManyTicketsQueryDTO) {
    if (user.tipoUsuario === 'municipe') {
      const where: Prisma.TicketWhereInput = {
        idUsuario: user.id,
        idDepartamento: query.idDepartamento,
        status: query.status,
        prioridade: query.prioridade,
        descricao: query.busca
          ? { contains: query.busca, mode: 'insensitive' }
          : undefined,
      };

      const [data, total] = await prisma.$transaction([
        prisma.ticket.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
          include: ticketListInclude,
        }),
        prisma.ticket.count({ where }),
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
      descricao: query.busca
        ? { contains: query.busca, mode: 'insensitive' }
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
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    return prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: ticketDetailInclude,
    });
  }

  async assume(user: TokenPayload, id: number) {
    const ticket = await this.findTicketOrThrow(id);

    await assertDepartmentAccess(user, ticket.idDepartamento);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      return tx.ticket.findUniqueOrThrow({
        where: { id },
        include: ticketDetailInclude,
      });
    });
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
      return prisma.ticket.findUniqueOrThrow({
        where: { id },
        include: ticketDetailInclude,
      });
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.ticket.update({ where: { id }, data });

      if (historicos.length > 0) {
        await tx.ticketHistorico.createMany({ data: historicos });
      }

      return tx.ticket.findUniqueOrThrow({
        where: { id },
        include: ticketDetailInclude,
      });
    });
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

    const departamentoSolicitado = await prisma.departamento.findUnique({
      where: { id: body.idDepartamentoSolicitado },
    });

    if (!departamentoSolicitado) {
      throw new AppError('Departamento solicitado não encontrado', 404);
    }

    return prisma.solicitacao.create({
      data: {
        idTicket: id,
        idDepartamentoSolicitado: body.idDepartamentoSolicitado,
        descricao: body.descricao,
      },
      include: { departamentoSolicitado: true },
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

  private async findTicketOrThrow(id: number) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    return ticket;
  }
}

export const ticketService = new TicketService();
