import { z } from 'zod';

const TICKET_STATUS_VALUES = [
  'aberto',
  'em_analise',
  'em_andamento',
  'pendente',
  'resolvido',
  'fechado',
] as const;

const TICKET_PRIORIDADE_VALUES = ['normal', 'urgente'] as const;

export const ticketIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getManyTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  prioridade: z.enum(TICKET_PRIORIDADE_VALUES).optional(),
  idDepartamento: z.coerce.number().int().positive().optional(),
  busca: z.string().trim().min(1).optional(),
});

export const updateTicketBodySchema = z
  .object({
    status: z.enum(TICKET_STATUS_VALUES).optional(),
    prioridade: z.enum(TICKET_PRIORIDADE_VALUES).optional(),
    descricao: z.string().trim().min(1).optional(),
    prazoPrimeiraRespostaMinutos: z.coerce.number().int().positive().optional(),
    prazoResolucaoMinutos: z.coerce.number().int().positive().optional(),
    idFuncionarioResponsavel: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const createSolicitacaoBodySchema = z.object({
  idDepartamentoSolicitado: z.coerce.number().int().positive(),
  descricao: z.string().trim().min(1),
});
