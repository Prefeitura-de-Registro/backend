import { prisma } from "../../shared/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { CreateUserDTO } from './dtos/user.dto.js';
import { hashPassword } from "../../shared/utils/hash.js";

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
}

export const userService = new UserService();
