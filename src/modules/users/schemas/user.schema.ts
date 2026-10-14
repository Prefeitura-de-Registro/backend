import { z } from 'zod';
import { isValidCPF } from '../../../shared/utils/validate-cpf.js';
import { paginationSchema } from '../../../shared/schemas/pagination.schema.js';

const matriculaSchema = z
  .string({
    required_error: 'Matrícula é obrigatória',
    invalid_type_error: 'Matrícula deve ser enviada como texto',
  })
  .trim()
  .regex(/^\d{5}$/, 'Matrícula deve conter exatamente 5 dígitos numéricos');

const nomeSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres');

const emailSchema = z
  .string({ required_error: 'O e-mail é obrigatório' })
  .trim()
  .toLowerCase()
  .email('Informe um email válido');

const senhaSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres');

const cpfSchema = z
  .string({ required_error: 'O CPF é obrigatório' })
  .trim()
  .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF em formato inválido')
  .refine(isValidCPF, 'CPF inválido')
  .transform((cpf) => cpf.replace(/\D/g, '')); // sempre grava os 11 dígitos

const cargoSchema = z
  .string()
  .trim()
  .min(3, 'O cargo deve ter pelo menos 3 caracteres');

// const tipoUsuarioSchema = z
//   .enum(['municipe', 'funcionario', 'gestor']);

const tipoFuncionarioSchema = z
  .enum(['funcionario', 'gestor']);

// cadastro de munícipes
export const createUserSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  senha: senhaSchema,
  cpf: cpfSchema,
  // não deve receber tipoUsuario, cargo ou matrícula
});

// login de usuários
export const loginUserSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'A senha é obrigatória'),
});

// requer ID do usuário
export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// edição de funcionários/gestores
export const updateUserBodySchema = z
  .object({
    nome: nomeSchema.optional(),
    email: emailSchema.optional(),
    senha: senhaSchema.optional(),
    cargo: cargoSchema.optional(),
    tipoUsuario: tipoFuncionarioSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

// edição do próprio usuário logado
export const updateMeBodySchema = z
  .object({
    nome: nomeSchema.optional(),
    email: emailSchema.optional(),
    senha: senhaSchema.optional(),
    senhaAtual: z.string().min(1).optional(),
    // não deve permitir tipoUsuario, cargo ou matrícula
  })
  .refine(
    (d) =>
      d.nome !== undefined || d.email !== undefined || d.senha !== undefined,
    {
      message: 'Informe ao menos um campo para atualizar',
    },
  )
  .refine(
    (d) =>
      (d.email === undefined && d.senha === undefined) || Boolean(d.senhaAtual),
    {
      message: 'Informe a senha atual para alterar e-mail ou senha',
      path: ['senhaAtual'],
    },
  );

// edição de departamentos (exige lista completa e substitui vínculos atuais)
export const setDepartamentosBodySchema = z.object({
  // Mande um array vazio para remover todos os vínculos.
  departamentoIds: z.array(z.coerce.number().int().positive()),
});

// listagem de funcionários
export const getManyFuncionariosQuerySchema = paginationSchema.extend({
  busca: z.string().trim().min(3).optional(),
});

// cadastro de funcionários
export const createFuncionarioBodySchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  senha: senhaSchema,
  cpf: cpfSchema,
  cargo: cargoSchema,
  matricula: matriculaSchema,
  tipoUsuario: tipoFuncionarioSchema.default('funcionario'),
  departamentoIds: z.array(z.coerce.number().int().positive()),
  status: z.boolean().default(true),
});
