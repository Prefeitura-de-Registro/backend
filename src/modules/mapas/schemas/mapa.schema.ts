import { TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { dataSchema, validarPeriodo } from '../../../shared/schemas/periodo.schema.js';
import {
  idOpcionalSchema,
  listaDaQuery,
  vazioParaUndefined,
} from '../../../shared/schemas/query.schema.js';
import { periodoUltimosDias } from '../../../shared/utils/periodo.js';

// Valores padrão e limites exclusivos do mapa
const DIAS_PADRAO_MAPA = 30;
const LIMITE_PADRAO_MAPA = 500;
const LIMITE_MAXIMO_MAPA = 2000;
const RAIO_MAXIMO_KM = 50;

export const mapaTicketsQuerySchema = z
  .object({
    inicio: dataSchema.optional(),
    fim: dataSchema.optional(), // exclusivo, como nos relatórios
    status: z.preprocess(listaDaQuery, z.array(z.nativeEnum(TicketStatus)).optional()),
    idDepartamento: idOpcionalSchema,
    busca: z.preprocess(
      vazioParaUndefined,
      z.string().trim().min(2, 'A busca precisa de ao menos 2 caracteres').max(100).optional(),
    ),
    lat: z.preprocess(vazioParaUndefined, z.coerce.number().min(-90).max(90).optional()),
    lng: z.preprocess(vazioParaUndefined, z.coerce.number().min(-180).max(180).optional()),
    raioKm: z.preprocess(
      vazioParaUndefined,
      z.coerce.number().positive().max(RAIO_MAXIMO_KM).optional(),
    ),
    limite: z.preprocess(
      vazioParaUndefined,
      z.coerce.number().int().positive().max(LIMITE_MAXIMO_MAPA).default(LIMITE_PADRAO_MAPA),
    ),
  })
  .superRefine(validarPeriodo)
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
    message: 'Informe lat e lng juntos',
    path: ['lng'],
  })
  .refine((q) => q.raioKm === undefined || q.lat !== undefined, {
    message: 'raioKm exige lat e lng',
    path: ['raioKm'],
  })
  // Sem datas na query, usa os últimos DIAS_PADRAO_MAPA dias
  .transform((q) => {
    const periodo =
      q.inicio && q.fim ? { inicio: q.inicio, fim: q.fim } : periodoUltimosDias(DIAS_PADRAO_MAPA);
    return { ...q, ...periodo };
  });