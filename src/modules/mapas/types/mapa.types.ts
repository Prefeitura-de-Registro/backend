import type { TicketPrioridade, TicketStatus } from '@prisma/client';

// ---------- Linhas devolvidas pelas consultas SQL ($queryRaw) ----------

export interface ConsultaMapaTicket {
  id: number;
  status: TicketStatus;
  prioridade: TicketPrioridade;
  descricao: string | null;
  created_at: Date;
  categoria: string;
  id_departamento: number;
  departamento: string;
  lat: number;
  lng: number;
  distancia_metros: number | null;
}

// ---------- Respostas da API ----------

export interface MarcadorTicket {
  id: number;
  status: TicketStatus;
  prioridade: TicketPrioridade;
  descricao: string | null;
  createdAt: Date;
  categoria: string;
  departamento: { id: number; nome: string };
  lat: number;
  lng: number;
  distanciaMetros: number | null;
}

export type OrigemCentro = 'usuario' | 'tickets' | 'padrao';

export interface LimitesMapa {
  sul: number;
  oeste: number;
  norte: number;
  leste: number;
}

export interface MapaTicketsResposta {
  centro: { lat: number; lng: number; origem: OrigemCentro };
  limites: LimitesMapa | null;
  total: number;
  truncado: boolean; // true se havia mais tickets que o limite
  tickets: MarcadorTicket[];
}