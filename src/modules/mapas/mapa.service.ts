import { Prisma } from '@prisma/client';
import {
  assertDepartmentAccess,
  getAccessibleDepartamentoIds,
  type DepartmentScope,
} from '../../shared/authorization/department-scope.service.js';
import { CENTRO_PADRAO_MAPA } from '../../shared/config/municipio.js';
import { prisma } from '../../shared/database/prisma.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import { montarPeriodo } from '../../shared/utils/periodo.js';
import type { MapaTicketsQueryDTO } from './dtos/mapa.dto.js';
import type {
  ConsultaMapaTicket,
  LimitesMapa,
  MapaTicketsResposta,
  MarcadorTicket,
} from './types/mapa.types.js';

class MapaService {
  async getTickets(user: TokenPayload, query: MapaTicketsQueryDTO): Promise<MapaTicketsResposta> {
    const { inicio, fim, status, idDepartamento, busca, lat, lng, raioKm, limite } = query;
    const periodo = montarPeriodo(inicio, fim);

    // Departamentos que o usuário pode ver (ou só o pedido, se tiver acesso a ele)
    let escopo: DepartmentScope;
    if (idDepartamento !== undefined) {
      await assertDepartmentAccess(user, idDepartamento);
      escopo = [idDepartamento];
    } else {
      escopo = await getAccessibleDepartamentoIds(user);
    }

    // ATENÇÃO: ST_MakePoint recebe (longitude, latitude), nessa ordem
    const pontoUsuario =
      lat !== undefined && lng !== undefined
        ? Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography`
        : null;

    const condicoes: Prisma.Sql[] = [
      Prisma.sql`t.geom IS NOT NULL`,
      Prisma.sql`t.created_at >= ${periodo.inicio}::timestamp`,
      Prisma.sql`t.created_at <  ${periodo.fim}::timestamp`,
    ];

    if (escopo !== 'all') {
      condicoes.push(Prisma.sql`t.id_departamento = ANY(${escopo}::int[])`);
    }

    if (status?.length) {
      condicoes.push(Prisma.sql`t.status::text = ANY(${status}::text[])`);
    }
    if (busca) {
      condicoes.push(this.filtroBusca(busca));
    }
    if (pontoUsuario && raioKm !== undefined) {
      // Com geography, a distância é em metros
      condicoes.push(Prisma.sql`ST_DWithin(t.geom, ${pontoUsuario}, ${raioKm * 1000}::double precision)`);
    }

    const distancia = pontoUsuario
      ? Prisma.sql`ST_Distance(t.geom, ${pontoUsuario})`
      : Prisma.sql`NULL::double precision`;
    const ordem = pontoUsuario ? Prisma.sql`distancia_metros ASC` : Prisma.sql`t.created_at DESC`;

    // limite + 1 para saber se havia mais tickets do que o retornado
    const linhas = await prisma.$queryRaw<ConsultaMapaTicket[]>`
      SELECT
        t.id,
        t.status,
        t.prioridade,
        t.descricao,
        t.created_at,
        c.nome                 AS categoria,
        d.id                   AS id_departamento,
        d.nome                 AS departamento,
        ST_Y(t.geom::geometry) AS lat,
        ST_X(t.geom::geometry) AS lng,
        ${distancia}           AS distancia_metros
      FROM tickets t
      JOIN categorias c    ON c.id = t.id_categoria
      JOIN departamentos d ON d.id = t.id_departamento
      WHERE ${Prisma.join(condicoes, ' AND ')}
      ORDER BY ${ordem}
      LIMIT ${limite + 1}
    `;

    const truncado = linhas.length > limite;
    const tickets: MarcadorTicket[] = linhas.slice(0, limite).map((linha) => ({
      id: linha.id,
      status: linha.status,
      prioridade: linha.prioridade,
      descricao: linha.descricao,
      createdAt: linha.created_at,
      categoria: linha.categoria,
      departamento: { id: linha.id_departamento, nome: linha.departamento },
      lat: linha.lat,
      lng: linha.lng,
      distanciaMetros: linha.distancia_metros === null ? null : Math.round(linha.distancia_metros),
    }));

    const limites = this.calcularLimites(tickets);

    return {
      centro: this.definirCentro(lat, lng, limites),
      limites,
      total: tickets.length,
      truncado,
      tickets,
    };
  }

  private filtroBusca(busca: string): Prisma.Sql {
    // Escapa os curingas do LIKE para que '%' e '_' digitados sejam literais
    const termo = `%${busca.replace(/[\\%_]/g, '\\$&')}%`;
    const protocolo = /^#?\d{1,9}$/.test(busca) ? Number(busca.replace('#', '')) : null;
    const filtroProtocolo = protocolo !== null ? Prisma.sql`OR t.id = ${protocolo}` : Prisma.empty;

    return Prisma.sql`(
      t.descricao ILIKE ${termo}
      OR c.nome   ILIKE ${termo}
      OR d.nome   ILIKE ${termo}
      ${filtroProtocolo}
    )`;
  }

  private calcularLimites(tickets: MarcadorTicket[]): LimitesMapa | null {
    if (tickets.length === 0) return null;
    const lats = tickets.map((t) => t.lat);
    const lngs = tickets.map((t) => t.lng);
    return {
      sul: Math.min(...lats),
      norte: Math.max(...lats),
      oeste: Math.min(...lngs),
      leste: Math.max(...lngs),
    };
  }

  private definirCentro(
    lat: number | undefined,
    lng: number | undefined,
    limites: LimitesMapa | null,
  ): MapaTicketsResposta['centro'] {
    if (lat !== undefined && lng !== undefined) {
      return { lat, lng, origem: 'usuario' };
    }
    if (limites) {
      return {
        lat: (limites.sul + limites.norte) / 2,
        lng: (limites.oeste + limites.leste) / 2,
        origem: 'tickets',
      };
    }
    return { ...CENTRO_PADRAO_MAPA, origem: 'padrao' };
  }
}

export const mapaService = new MapaService();