import { z } from 'zod';

export const solicitacaoIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const respondSolicitacaoBodySchema = z
  .object({
    status: z.enum(['em_analise', 'respondida', 'recusada']),
    resposta: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.status === 'em_analise' || Boolean(data.resposta), {
    message: 'Informe a resposta ao finalizar a solicitação',
    path: ['resposta'],
  });

export const getManySolicitacoesQuerySchema = z.object({
  tipo: z.enum(['recebidas', 'enviadas']).default('recebidas'),
  status: z
    .enum(['pendente', 'em_analise', 'respondida', 'recusada'])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createMensagemBodySchema = z.object({
  mensagem: z.string().trim().min(1).max(4000),
});
