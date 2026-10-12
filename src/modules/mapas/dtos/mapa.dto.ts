import type { z } from 'zod';
import type { mapaTicketsQuerySchema } from '../schemas/mapa.schema.js';

export type MapaTicketsQueryDTO = z.infer<typeof mapaTicketsQuerySchema>;