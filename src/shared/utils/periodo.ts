import { FUSO_HORARIO, OFFSET_FUSO_HORARIO } from '../config/municipio.js';

export interface Periodo {
  inicio: Date; // inclusivo, instante em UTC
  fim: Date; // exclusivo, instante em UTC
}

// '2026-08-01' -> meia-noite em Brasília -> 2026-08-01T03:00:00.000Z
function meiaNoiteEmBrasilia(data: string): Date {
  return new Date(`${data}T00:00:00${OFFSET_FUSO_HORARIO}`);
}

function hojeEmBrasilia(): string {
  // 'en-CA' formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(new Date());
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// fim exclusivo = amanhã, para incluir o dia de hoje
export function periodoUltimosDias(dias: number): { inicio: string; fim: string } {
  const fim = somarDias(hojeEmBrasilia(), 1);
  return { inicio: somarDias(fim, -dias), fim };
}

export function montarPeriodo(inicio: string, fim: string): Periodo {
  return { inicio: meiaNoiteEmBrasilia(inicio), fim: meiaNoiteEmBrasilia(fim) };
}