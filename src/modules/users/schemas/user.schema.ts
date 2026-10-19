import { z } from 'zod';
import { somenteDigitos, validarCpf } from '../../../shared/utils/cpf.js';

/*
    Schemas Zod validam entradas em runtime
    Schemas Zod são aplicados no validate.middleware
*/

// Aceita com ou sem máscara; valida os dígitos verificadores e guarda só dígitos.
const cpfSchema = z
  .string()
  .trim()
  .refine(validarCpf, 'Informe um CPF válido')
  .transform(somenteDigitos);

const matriculaSchema = z.string().trim().min(1).max(30);
const cargoSchema = z.string().trim().min(1).max(100);

// O app envia nomeCompleto, CPF e confirmarSenha: aceitamos esses nomes além de
// nome, cpf e senha (que são os nomes da API).
const aliasesDoCadastro = (corpo: unknown) => {
  if (typeof corpo !== 'object' || corpo === null) {
    return corpo;
  }

  const { nomeCompleto, CPF, ...resto } = corpo as Record<string, unknown>;

  return {
    ...resto,
    nome: resto.nome ?? nomeCompleto,
    cpf: resto.cpf ?? CPF,
  };
};

export const createUserSchema = z.preprocess(
  aliasesDoCadastro,
  z
    .object({
      nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),

      email: z.string().trim().toLowerCase().email('Informe um email válido'),

      senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),

      // opcional: contas já existentes não têm CPF
      cpf: cpfSchema.optional(),

      // opcional: se vier, precisa ser igual à senha
      confirmarSenha: z.string().optional(),
    })
    .refine(
      (dados) =>
        dados.confirmarSenha === undefined ||
        dados.confirmarSenha === dados.senha,
      { message: 'As senhas não coincidem', path: ['confirmarSenha'] },
    ),
);

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
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Informe um email válido')
      .optional(),
    senha: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .optional(),
    tipoUsuario: z.enum(['municipe', 'funcionario', 'gestor']).optional(),
    cpf: cpfSchema.optional(),
    matricula: matriculaSchema.optional(),
    cargo: cargoSchema.optional(),
    ativo: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const updateMeBodySchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, 'O nome deve ter pelo menos 3 caracteres')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Informe um email válido')
      .optional(),
    senha: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .optional(),
    senhaAtual: z.string().min(1).optional(),
    // sem tipoUsuario: campos desconhecidos são descartados pelo Zod
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

export const setDepartamentosBodySchema = z.object({
  // Lista COMPLETA dos departamentos do usuário (substitui os vínculos atuais).
  // Mande um array vazio para remover todos os vínculos.
  departamentoIds: z.array(z.coerce.number().int().positive()),
});

const TIPOS_USUARIO = ['municipe', 'funcionario', 'gestor'] as const;

export const getManyFuncionariosQuerySchema = z.object({
  // busca por nome, e-mail, matrícula ou CPF completo (11 dígitos)
  busca: z.string().trim().min(3).optional(),
  // filtro por tipo: "funcionario", "gestor" ou lista "funcionario,gestor"
  // (sem o filtro, lista apenas funcionários, como antes)
  tipo: z
    .preprocess(
      (valor) => (typeof valor === 'string' ? valor.split(',') : valor),
      z.array(z.enum(TIPOS_USUARIO)).min(1),
    )
    .default(['funcionario']),
  // filtro por ativo/inativo; sem o filtro, retorna os dois
  ativo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
  // parâmetros de paginação
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(25).default(20),
});

export const createFuncionarioBodySchema = z
  .object({
    nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),

    email: z.string().trim().toLowerCase().email('Informe um email válido'),

    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),

    tipoUsuario: z.enum(TIPOS_USUARIO).optional(),

    departamentoIds: z.array(z.coerce.number().int().positive()),

    status: z.boolean(),

    cpf: cpfSchema.optional(),

    matricula: matriculaSchema.optional(),

    cargo: cargoSchema.optional(),
  })
  // funcionário e gestor precisam de matrícula e cargo
  .superRefine((data, contexto) => {
    if ((data.tipoUsuario ?? 'funcionario') === 'municipe') {
      return;
    }

    for (const campo of ['matricula', 'cargo'] as const) {
      if (!data[campo]) {
        contexto.addIssue({
          code: 'custom',
          path: [campo],
          message: `${campo === 'matricula' ? 'A matrícula' : 'O cargo'} é obrigatório para funcionário e gestor`,
        });
      }
    }
  });
