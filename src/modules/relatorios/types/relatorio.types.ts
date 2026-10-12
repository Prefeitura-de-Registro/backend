import type { Prisma } from '@prisma/client';

// ---------- Linhas devolvidas pelas consultas SQL ($queryRaw) ----------

export interface ConsultaTemposMedios {
  media_resolucao_minutos: Prisma.Decimal | null;
  media_primeira_resposta_minutos: Prisma.Decimal | null;
}

export interface ConsultaVolumeSemanal {
  semana_inicio: string; // 'YYYY-MM-DD'
  abertos: bigint;
  concluidos: bigint;
}

export interface ConsultaDesempenhoDepartamento {
  id_departamento: number;
  departamento: string;
  secretaria: string;
  tickets_totais: bigint;
  tickets_resolvidos: bigint;
  media_resolucao_minutos: Prisma.Decimal | null;
  resolvidos_no_prazo: bigint;
}

// ---------- Respostas da API ----------

export interface IndicadoresResposta {
  ticketsTotais: number;
  ticketsResolvidos: number;
  temposTicket: {
    resolucaoMinutos: number | null;
    primeiraRespostaMinutos: number | null;
  };
}

export interface VolumeSemana {
  semanaInicio: string;
  abertos: number;
  concluidos: number;
}

export interface TicketsPorCategoriaResposta {
  categorias: { idCategoria: number; nome: string; quantidade: number }[];
}

export type StatusGeral = 'Excelente' | 'Bom' | 'Regular' | 'Crítico' | 'Sem dados';

export interface DesempenhoDepartamento {
  idDepartamento: number;
  departamento: string;
  secretaria: string;
  ticketsTotais: number;
  ticketsResolvidos: number;
  tempoMedioResolucaoMinutos: number | null;
  resolvidosNoPrazo: number;
  statusGeral: StatusGeral;
}