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
