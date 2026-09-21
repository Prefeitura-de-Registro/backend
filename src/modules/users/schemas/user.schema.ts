import { z } from "zod";

/*
    Schemas Zod validam entradas em runtime
    Schemas Zod são aplicados no validate.middleware
*/

export const createUserSchema = z.object({
    nome: z
        .string()
        .min(3, "O nome deve ter pelo menos 3 caracteres"),

    email: z
        .string()
        .email("Informe um email válido"),

    senha: z
        .string()
        .min(8, "A senha deve ter pelo menos 8 caracteres"),

    tipoUsuario: z
        .enum(['municipe', 'funcionario'])
        .optional()
});

export const loginUserSchema = z.object({
    email: z
        .string()
        .email("Informe um email válido"),

    senha: z
        .string()
        .min(1, "A senha é obrigatória")
});