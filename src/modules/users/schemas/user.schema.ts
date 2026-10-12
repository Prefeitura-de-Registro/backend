import { z } from 'zod';

/*
    Schemas Zod validam entradas em runtime
    Schemas Zod são aplicados no validate.middleware
*/

/*
    Cadastro público (POST /register): é exclusivo de munícipes.
    O campo `tipoUsuario` NÃO faz parte deste schema de propósito: o Zod
    descarta chaves desconhecidas, então qualquer `tipoUsuario` enviado pelo
    cliente é ignorado e o service define o tipo (sempre `municipe`).
*/
export const createUserSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),

  email: z.string().email('Informe um email válido'),

  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

/*
    Cadastro de funcionários (POST /funcionarios): rota restrita a gestores.
    O tipo também é definido pelo service, nunca pelo corpo da requisição.
*/
export const createFuncionarioSchema = createUserSchema;

export const loginUserSchema = z.object({
  email: z.string().email('Informe um email válido'),

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
    email: z.string().email('Informe um email válido').optional(),
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
