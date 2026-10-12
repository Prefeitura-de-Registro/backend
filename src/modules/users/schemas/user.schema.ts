import { z } from 'zod';

/*
    Schemas Zod validam entradas em runtime
    Schemas Zod são aplicados no validate.middleware
*/

export const createUserSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),

  email: z.string().trim().toLowerCase().email('Informe um email válido'),

  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

export const loginUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um email válido'),

  senha: z.string().min(1, 'A senha é obrigatória'),
});

export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateUserBodySchema = z
  .object({
    nome: z
      .string()
      .min(3, 'O nome deve ter pelo menos 3 caracteres')
      .optional(),
    email: z.string().trim().toLowerCase().email('Informe um email válido').optional(),
    senha: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .optional(),
    tipoUsuario: z.enum(['municipe', 'funcionario']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const setDepartamentosBodySchema = z.object({
  // Lista COMPLETA dos departamentos do usuário (substitui os vínculos atuais).
  // Mande um array vazio para remover todos os vínculos.
  departamentoIds: z.array(z.coerce.number().int().positive()),
});

export const getManyFuncionariosQuerySchema = z.object({
  // campo de busca = nome do funcionário
  // quando não existe, retorna todos os funcionários
  busca: z.string().trim().min(3).optional(),
  // parâmetros de paginação
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(25).default(20),
})

export const createFuncionarioBodySchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),

  email: z.string().trim().toLowerCase().email('Informe um email válido'),

  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),

  tipoUsuario: z.enum(['municipe', 'funcionario', 'gestor']).optional(),

  departamentoIds: z.array(z.coerce.number().int().positive()),

  status: z.boolean()

  // cargo:

  // fotoPerfil:
})