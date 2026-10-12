import { Prisma, TicketStatus } from '@prisma/client';
import {
  assertDepartmentAccess,
  getAccessibleDepartamentoIds,
  type DepartmentScope,
} from '../../shared/authorization/department-scope.service.js';
import { FUSO_HORARIO } from '../../shared/config/municipio.js';
import { prisma } from '../../shared/database/prisma.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import { montarPeriodo, type Periodo } from '../../shared/utils/periodo.js';
import { decimalParaMinutos } from '../../shared/utils/units.js';
import type { RelatorioQueryDTO } from './dtos/relatorio.dto.js';
import { classificarDesempenho } from './rules/relatorio.rules.js';
import type {
  ConsultaDesempenhoDepartamento,
  ConsultaTemposMedios,
  ConsultaVolumeSemanal,
  DesempenhoDepartamento,
  IndicadoresResposta,
  TicketsPorCategoriaResposta,
  VolumeSemana,
} from './types/relatorio.types.js';

// Primeira vez que cada ticket foi marcado como resolvido (usada em 3 consultas)
const CTE_RESOLUCAO = Prisma.sql`
  resolucao AS (
    SELECT h.id_ticket, MIN(h.created_at) AS resolvido_em
    FROM ticket_historico h
    WHERE h.tipo_evento = 'mudanca_status'
      AND h.status = 'resolvido'
    GROUP BY h.id_ticket
  )`;

class RelatorioService {
  async getIndicadores(user: TokenPayload, query: RelatorioQueryDTO): Promise<IndicadoresResposta> {
    const { periodo, escopo } = await this.prepararConsulta(user, query);

    const [ticketsTotais, ticketsResolvidos, temposTicket] = await Promise.all([
      this.contarTicketsTotais(periodo, escopo),
      this.contarTicketsResolvidos(periodo, escopo),
      this.calcularTemposMediosTicket(periodo, escopo),
    ]);

    return { ticketsTotais, ticketsResolvidos, temposTicket };
  }

  async getVolumeSemanal(user: TokenPayload, query: RelatorioQueryDTO): Promise<VolumeSemana[]> {
    const { periodo, escopo } = await this.prepararConsulta(user, query);
    return this.calcularVolumeTickets(periodo, escopo);
  }

  async getTicketsPorCategoria(
    user: TokenPayload,
    query: RelatorioQueryDTO,
  ): Promise<TicketsPorCategoriaResposta> {
    const { periodo, escopo } = await this.prepararConsulta(user, query);
    return this.contarTicketsPorCategoria(periodo, escopo);
  }

  async getDesempenhoPorDepartamento(
    user: TokenPayload,
    query: RelatorioQueryDTO,
  ): Promise<DesempenhoDepartamento[]> {
    const { periodo, escopo } = await this.prepararConsulta(user, query);
    return this.calcularDesempenhoPorDepartamento(periodo, escopo);
  }

  // Converte as datas e resolve quais departamentos o usuário pode ver
  private async prepararConsulta(user: TokenPayload, query: RelatorioQueryDTO) {
    const periodo = montarPeriodo(query.inicio, query.fim);

    // Departamentos que o usuário pode ver (ou só o pedido, se tiver acesso a ele)
    let escopo: DepartmentScope;
    if (query.idDepartamento !== undefined) {
      await assertDepartmentAccess(user, query.idDepartamento);
      escopo = [query.idDepartamento];
    } else {
      escopo = await getAccessibleDepartamentoIds(user);
    }

    return { periodo, escopo };
  }

  // Tickets criados no período, dentro do escopo, sem os 'fechado'
  private whereTicketsDoPeriodo(periodo: Periodo, escopo: DepartmentScope): Prisma.TicketWhereInput {
    return {
      createdAt: { gte: periodo.inicio, lt: periodo.fim },
      idDepartamento: escopo === 'all' ? undefined : { in: escopo },
      status: { not: TicketStatus.fechado },
    };
  }

  private async contarTicketsTotais(periodo: Periodo, escopo: DepartmentScope): Promise<number> {
    return prisma.ticket.count({ where: this.whereTicketsDoPeriodo(periodo, escopo) });
  }

  private async contarTicketsResolvidos(periodo: Periodo, escopo: DepartmentScope): Promise<number> {
    return prisma.ticket.count({
      where: { ...this.whereTicketsDoPeriodo(periodo, escopo), status: TicketStatus.resolvido },
    });
  }

  private async calcularTemposMediosTicket(
    periodo: Periodo,
    escopo: DepartmentScope,
  ): Promise<IndicadoresResposta['temposTicket']> {
    const filtroDepartamento =
      escopo === 'all' ? Prisma.empty : Prisma.sql`AND t.id_departamento = ANY(${escopo}::int[])`;

    const [tempos] = await prisma.$queryRaw<ConsultaTemposMedios[]>`
      WITH tickets_periodo AS (
        SELECT t.id, t.created_at
        FROM tickets t
        WHERE t.created_at >= ${periodo.inicio}::timestamp
          AND t.created_at <  ${periodo.fim}::timestamp
          AND t.status <> 'fechado'
          ${filtroDepartamento}
      ),
      primeira_resposta AS (
        SELECT h.id_ticket, MIN(h.created_at) AS respondido_em
        FROM ticket_historico h
        JOIN usuarios u ON u.id = h.id_usuario
        WHERE h.tipo_evento <> 'criacao'
          AND u.tipo_usuario IN ('funcionario', 'gestor')
        GROUP BY h.id_ticket
      ),
      ${CTE_RESOLUCAO}
      SELECT
        AVG(EXTRACT(EPOCH FROM (r.resolvido_em - tp.created_at)) / 60)   AS media_resolucao_minutos,
        AVG(EXTRACT(EPOCH FROM (pr.respondido_em - tp.created_at)) / 60) AS media_primeira_resposta_minutos
      FROM tickets_periodo tp
      LEFT JOIN primeira_resposta pr ON pr.id_ticket = tp.id
      LEFT JOIN resolucao r ON r.id_ticket = tp.id
    `;

    return {
      resolucaoMinutos: decimalParaMinutos(tempos.media_resolucao_minutos),
      primeiraRespostaMinutos: decimalParaMinutos(tempos.media_primeira_resposta_minutos),
    };
  }

  private async calcularVolumeTickets(periodo: Periodo, escopo: DepartmentScope): Promise<VolumeSemana[]> {
    const filtroDepartamento =
      escopo === 'all' ? Prisma.empty : Prisma.sql`AND t.id_departamento = ANY(${escopo}::int[])`;

    const volume = await prisma.$queryRaw<ConsultaVolumeSemanal[]>`
      WITH semanas AS (
        -- Todas as segundas-feiras do período, mesmo sem tickets
        SELECT generate_series(
          date_trunc('week', ${periodo.inicio}::timestamptz AT TIME ZONE ${FUSO_HORARIO}),
          date_trunc('week', (${periodo.fim}::timestamptz - interval '1 microsecond') AT TIME ZONE ${FUSO_HORARIO}),
          interval '1 week'
        ) AS semana
      ),
      abertos AS (
        SELECT date_trunc('week', t.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${FUSO_HORARIO}) AS semana,
               COUNT(*) AS total
        FROM tickets t
        WHERE t.created_at >= ${periodo.inicio}::timestamp
          AND t.created_at <  ${periodo.fim}::timestamp
          AND t.status <> 'fechado'
          ${filtroDepartamento}
        GROUP BY 1
      ),
      ${CTE_RESOLUCAO},
      concluidos AS (
        SELECT date_trunc('week', r.resolvido_em AT TIME ZONE 'UTC' AT TIME ZONE ${FUSO_HORARIO}) AS semana,
               COUNT(*) AS total
        FROM resolucao r
        JOIN tickets t ON t.id = r.id_ticket
        WHERE r.resolvido_em >= ${periodo.inicio}::timestamp
          AND r.resolvido_em <  ${periodo.fim}::timestamp
          ${filtroDepartamento}
        GROUP BY 1
      )
      SELECT
        to_char(s.semana, 'YYYY-MM-DD') AS semana_inicio,
        COALESCE(a.total, 0)            AS abertos,
        COALESCE(c.total, 0)            AS concluidos
      FROM semanas s
      LEFT JOIN abertos a    ON a.semana = s.semana
      LEFT JOIN concluidos c ON c.semana = s.semana
      ORDER BY s.semana
    `;

    return volume.map((linha) => ({
      semanaInicio: linha.semana_inicio,
      abertos: Number(linha.abertos),
      concluidos: Number(linha.concluidos),
    }));
  }

  private async contarTicketsPorCategoria(
    periodo: Periodo,
    escopo: DepartmentScope,
  ): Promise<TicketsPorCategoriaResposta> {
    const grupos = await prisma.ticket.groupBy({
      by: ['idCategoria'],
      where: this.whereTicketsDoPeriodo(periodo, escopo),
      _count: { _all: true },
      orderBy: { _count: { idCategoria: 'desc' } },
    });

    const categorias = await prisma.categoria.findMany({
      where: { id: { in: grupos.map((grupo) => grupo.idCategoria) } },
      select: { id: true, nome: true },
    });

    const nomePorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));

    return {
      categorias: grupos.map((grupo) => ({
        idCategoria: grupo.idCategoria,
        nome: nomePorId.get(grupo.idCategoria) ?? 'Categoria desconhecida',
        quantidade: grupo._count._all,
      })),
    };
  }

  private async calcularDesempenhoPorDepartamento(
    periodo: Periodo,
    escopo: DepartmentScope,
  ): Promise<DesempenhoDepartamento[]> {
    const filtroDepartamento =
      escopo === 'all' ? Prisma.empty : Prisma.sql`AND d.id = ANY(${escopo}::int[])`;

    const linhas = await prisma.$queryRaw<ConsultaDesempenhoDepartamento[]>`
      WITH tickets_periodo AS (
        SELECT t.id, t.id_departamento, t.status, t.created_at, t.prazo_resolucao_minutos
        FROM tickets t
        WHERE t.created_at >= ${periodo.inicio}::timestamp
          AND t.created_at <  ${periodo.fim}::timestamp
          AND t.status <> 'fechado'
      ),
      ${CTE_RESOLUCAO},
      metricas AS (
        SELECT
          tp.id_departamento,
          COUNT(*)                                        AS tickets_totais,
          COUNT(*) FILTER (WHERE tp.status = 'resolvido') AS tickets_resolvidos,
          AVG(EXTRACT(EPOCH FROM (r.resolvido_em - tp.created_at)) / 60) AS media_resolucao_minutos,
          COUNT(*) FILTER (
            WHERE tp.status = 'resolvido'
              AND r.resolvido_em - tp.created_at <= make_interval(mins => tp.prazo_resolucao_minutos)
          )                                               AS resolvidos_no_prazo
        FROM tickets_periodo tp
        LEFT JOIN resolucao r ON r.id_ticket = tp.id
        GROUP BY tp.id_departamento
      )
      SELECT
        d.id                               AS id_departamento,
        d.nome                             AS departamento,
        s.nome                             AS secretaria,
        COALESCE(m.tickets_totais, 0)      AS tickets_totais,
        COALESCE(m.tickets_resolvidos, 0)  AS tickets_resolvidos,
        m.media_resolucao_minutos,
        COALESCE(m.resolvidos_no_prazo, 0) AS resolvidos_no_prazo
      FROM departamentos d
      JOIN secretarias s ON s.id = d.id_secretaria
      LEFT JOIN metricas m ON m.id_departamento = d.id
      WHERE d.ativo = true
        ${filtroDepartamento}
      ORDER BY tickets_totais DESC, d.nome
    `;

    return linhas.map((linha) => {
      const ticketsResolvidos = Number(linha.tickets_resolvidos);
      const resolvidosNoPrazo = Number(linha.resolvidos_no_prazo);

      return {
        idDepartamento: linha.id_departamento,
        departamento: linha.departamento,
        secretaria: linha.secretaria,
        ticketsTotais: Number(linha.tickets_totais),
        ticketsResolvidos,
        tempoMedioResolucaoMinutos: decimalParaMinutos(linha.media_resolucao_minutos),
        resolvidosNoPrazo,
        statusGeral: classificarDesempenho(resolvidosNoPrazo, ticketsResolvidos),
      };
    });
  }
}

export const relatorioService = new RelatorioService();