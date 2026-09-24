import type { z } from 'zod';
import type {
  getManyTicketSchema,
  createSolicitacaoBodySchema,
  getManyTicketsQuerySchema,
  ticketIdParamsSchema,
  updateTicketBodySchema,
} from '../schemas/ticket.schema.js';

export type TicketIdParamsDTO = z.infer<typeof ticketIdParamsSchema>;
export type GetManyTicketsQueryDTO = z.infer<typeof getManyTicketsQuerySchema>;
export type UpdateTicketBodyDTO = z.infer<typeof updateTicketBodySchema>;
export type CreateSolicitacaoBodyDTO = z.infer<
  typeof createSolicitacaoBodySchema
>;

export type GetManyTicketDTO = z.infer<typeof getManyTicketSchema>;
