import type { Request, Response } from "express";
import { generateToken } from "../../shared/utils/jwt.js";
import { userService } from "./user.service.js";
import { CreateUserDTO, LoginUserDTO } from "./dtos/user.dto.js";

export class UserController {
  register = async (request: Request, response: Response) => {
    const data: CreateUserDTO = request.body;

    const usuario = await userService.create(data);

    const { id, email, name, tipoUsuario } = usuario;

    const token = generateToken({ id, email, name, tipoUsuario });

    response.status(201).json({
      usuario: {
        id: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        tipo_usuario: usuario.tipoUsuario,
        created_at: usuario.createdAt,
      },
      token,
    });
  };

  login = async (request: Request, response: Response) => {
    const data: LoginUserDTO = request.body;

    const usuario = await userService.login(data);

    const { id, email, name, tipoUsuario } = usuario;

    const token = generateToken({ id, email, name, tipoUsuario });

    response.status(200).json({
      usuario: {
        id: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        tipo_usuario: usuario.tipoUsuario,
        created_at: usuario.createdAt,
      },
      token,
    });
  };

  me = async (request: Request, response: Response) => {
    response.status(200).json(request.user);
  };
}
