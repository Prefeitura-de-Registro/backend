import { z } from 'zod';

// Tamanho máximo de qualquer consulta por período (relatórios e mapa)
export const DIAS_MAXIMOS_PERIODO = 366;

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((valor) => {
    const data = new Date(valor);
    // Rejeita datas inexistentes, como 2026-02-31, que o JS "corrigiria" para março
    return !isNaN(data.getTime()) && data.toISOString().startsWith(valor);
  }, 'Data inválida');

export function diasEntre(inicio: string, fim: string): number {
  return (new Date(fim).getTime() - new Date(inicio).getTime()) / UM_DIA_MS;
}

/**
 * Regras de período compartilhadas (fim exclusivo). Uso: .superRefine(validarPeriodo)
 * Ordem e tamanho só são conferidos quando as duas datas foram informadas.
 */
export function validarPeriodo(
  query: { inicio?: string; fim?: string },
  ctx: z.RefinementCtx,
) {
  const { inicio, fim } = query;

  if ((inicio === undefined) !== (fim === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Informe inicio e fim juntos', path: ['fim'] });
    return;
  }

  if (inicio === undefined || fim === undefined) return;

  if (inicio >= fim) {
    ctx.addIssue({
      code: 'custom',
      message: 'A data final deve ser posterior à data inicial',
      path: ['fim'],
    });
  } else if (diasEntre(inicio, fim) > DIAS_MAXIMOS_PERIODO) {
    ctx.addIssue({
      code: 'custom',
      message: `O período não pode passar de ${DIAS_MAXIMOS_PERIODO} dias`,
      path: ['fim'],
    });
  }
}