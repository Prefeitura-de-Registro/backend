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

// Em multipart/form-data todo campo chega como string; vazio vira "não enviado".
const vazioParaUndefined = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

const jsonSeString = (valor: unknown) => {
  if (typeof valor !== 'string') {
    return valor;
  }
  try {
    return JSON.parse(valor);
  } catch {
    return valor; // o z.array() acusa o formato inválido
  }
};

export const ticketIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Token do link (32 caracteres) ou protocolo ("REG-2026-000001", "#2026-1"...).
export const codigoAcompanhamentoParamsSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^#?[A-Za-z0-9_-]+$/),
});

export const arquivoPublicoParamsSchema =
  codigoAcompanhamentoParamsSchema.extend({
    idArquivo: z.coerce.number().int().positive(),
  });

export const getMeusTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  // um status ou lista separada por vírgula (ex.: "resolvido,fechado" para a aba "concluídos")
  status: z
    .preprocess(
      (valor) => (typeof valor === 'string' ? valor.split(',') : valor),
      z.array(z.enum(TICKET_STATUS_VALUES)).min(1),
    )
    .optional(),
});

export const createTicketBodySchema = z
  .object({
    idCategoria: z.coerce.number().int().positive(),
    descricao: z.preprocess(
      vazioParaUndefined,
      z.string().trim().max(2000).optional(),
    ),
    latitude: z.preprocess(
      vazioParaUndefined,
      z.coerce.number().min(-90).max(90).optional(),
    ),
    longitude: z.preprocess(
      vazioParaUndefined,
      z.coerce.number().min(-180).max(180).optional(),
    ),
    endereco: z.preprocess(
      vazioParaUndefined,
      z.string().trim().max(255).optional(),
    ),
    pontoReferencia: z.preprocess(
      vazioParaUndefined,
      z.string().trim().max(255).optional(),
    ),
    // [{ "idPergunta": 1, "valor": true }]; em multipart, enviar como JSON em texto.
    respostas: z.preprocess(
      jsonSeString,
      z
        .array(
          z.object({
            idPergunta: z.coerce.number().int().positive(),
            valor: z.boolean(),
          }),
        )
        .max(100)
        .default([]),
    ),
  })
  .refine(
    (data) => (data.latitude === undefined) === (data.longitude === undefined),
    { message: 'Informe latitude e longitude juntas', path: ['latitude'] },
  );

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

export const getManyTicketSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(25).default(20),
  status: z.enum(['open', 'in_service', 'closed']).optional(),
});
