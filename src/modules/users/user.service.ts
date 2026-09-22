import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  CreateUserDTO,
  LoginUserDTO,
  SetDepartamentosBodyDTO,
  UpdateUserBodyDTO,
} from "./dtos/user.dto.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  tipoUsuario: true,
  ativo: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

class UserService {
  async create(data: CreateUserDTO) {
    const existente = await prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });

    const passwordHash = await hashPassword(data.senha);

    if (existente) {
      if (existente.ativo) {
        throw new AppError("Já existe um cadastro com esse e-mail", 409);
      }

      // Usuário tinha passado por soft delete: reativa o mesmo registro em
      // vez de criar um novo, preservando o histórico já vinculado a ele
      // (tickets, TicketHistorico, UsuarioDepartamento etc.).
      return prisma.user.update({
        where: { id: existente.id },
        data: {
          name: data.nome,
          passwordHash,
          tipoUsuario: data.tipoUsuario ?? "municipe",
          ativo: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          tipoUsuario: true,
          createdAt: true,
        },
      });
    }

    const usuario = await prisma.user.create({
      data: {
        name: data.nome,
        email: data.email,
        passwordHash,
        tipoUsuario: data.tipoUsuario ?? "municipe",
      },
      select: {
        id: true,
        name: true,
        email: true,
        tipoUsuario: true,
        createdAt: true,
      },
    });

    return usuario;
  }

  async login(data: LoginUserDTO) {
    const usuario = await prisma.user.findFirst({
      where: {
        email: data.email,
        ativo: true, // apenas usuários ativos logam
      },
    });

    if (!usuario || !usuario.passwordHash) {
      throw new AppError("E-mail ou senha inválidos", 401);
    }

    const senhaValida = await comparePassword(data.senha, usuario.passwordHash);

    if (!senhaValida) {
      throw new AppError("E-mail ou senha inválidos", 401);
    }

    return usuario;
  }

  async update(id: number, data: UpdateUserBodyDTO) {
    const usuario = await this.findUserOrThrow(id);

    if (data.email && data.email !== usuario.email) {
      const emailEmUso = await prisma.user.findFirst({ where: { email: data.email } });

      if (emailEmUso) {
        throw new AppError("Já existe um cadastro com esse e-mail", 409);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.nome !== undefined) {
      updateData.name = data.nome;
    }

    if (data.email !== undefined) {
      updateData.email = data.email;
    }

    if (data.tipoUsuario !== undefined) {
      updateData.tipoUsuario = data.tipoUsuario;
    }

    if (data.senha !== undefined) {
      updateData.passwordHash = await hashPassword(data.senha);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: userSummarySelect,
    });
  }

  async softDelete(id: number) {
    const usuario = await this.findUserOrThrow(id);

    if (!usuario.ativo) {
      throw new AppError("Usuário já está inativo", 409);
    }

    return prisma.user.update({
      where: { id },
      data: { ativo: false },
      select: userSummarySelect,
    });
  }

  async setDepartamentos(id: number, data: SetDepartamentosBodyDTO) {
    await this.findUserOrThrow(id);

    const departamentoIds = [...new Set(data.departamentoIds)];

    if (departamentoIds.length > 0) {
      const existentes = await prisma.departamento.count({
        where: { id: { in: departamentoIds } },
      });

      if (existentes !== departamentoIds.length) {
        throw new AppError("Um ou mais departamentos informados não existem", 400);
      }
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.usuarioDepartamento.deleteMany({ where: { idUsuario: id } });

      if (departamentoIds.length > 0) {
        await tx.usuarioDepartamento.createMany({
          data: departamentoIds.map((idDepartamento) => ({ idUsuario: id, idDepartamento })),
        });
      }

      return tx.usuarioDepartamento.findMany({
        where: { idUsuario: id },
        include: { departamento: true },
      });
    });
  }

  private async findUserOrThrow(id: number) {
    const usuario = await prisma.user.findUnique({ where: { id } });

    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404);
    }

    return usuario;
  }
}

export const userService = new UserService();
