import { prisma } from "../../shared/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { CreateUserDTO, LoginUserDTO } from './dtos/user.dto.js';
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";

class UserService {
  async create(data: CreateUserDTO) {
    const existente = await prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });

    if (existente) {
      throw new AppError("Já existe um cadastro com esse e-mail", 409);
    }

    const passwordHash = await hashPassword(data.senha);

    const usuario = await prisma.user.create({
      data: {
        name: data.nome,
        email: data.email,
        passwordHash,
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
}

export const userService = new UserService();
