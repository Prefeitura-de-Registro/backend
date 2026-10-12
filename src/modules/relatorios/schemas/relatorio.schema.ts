import { z } from 'zod';
import { dataSchema, validarPeriodo } from '../../../shared/schemas/periodo.schema.js';
import { idOpcionalSchema } from '../../../shared/schemas/query.schema.js';

export const relatorioQuerySchema = z
  .object({
    inicio: dataSchema,
    fim: dataSchema, // exclusivo: para agosto inteiro, fim = 2026-09-01
    idDepartamento: idOpcionalSchema,
  })
  .superRefine(validarPeriodo);