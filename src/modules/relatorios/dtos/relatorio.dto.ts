import type { z } from 'zod';
import type { relatorioQuerySchema } from '../schemas/relatorio.schema.js';

export type RelatorioQueryDTO = z.infer<typeof relatorioQuerySchema>;