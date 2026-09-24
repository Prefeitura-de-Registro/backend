import type { Request, Response } from 'express';
import { generateToken } from '../../shared/utils/jwt.js';
import { userService } from './user.service.js';
import type {
  CreateUserDTO,
  LoginUserDTO,
  SetDepartamentosBodyDTO,
  UpdateUserBodyDTO,
  UserIdParamsDTO,
} from './dtos/user.dto.js';

export class UserController {
  register = async (request: Request, response: Response) => {
    const data = request.body as CreateUserDTO;

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
    const data = request.body as LoginUserDTO;

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

  update = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;
    const data = request.body as UpdateUserBodyDTO;

    const usuario = await userService.update(id, data);

    response.status(200).json(usuario);
  };

  remove = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;

    const usuario = await userService.softDelete(id);

    response.status(200).json(usuario);
  };

  setDepartamentos = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;
    const data = request.body as SetDepartamentosBodyDTO;

    const vinculos = await userService.setDepartamentos(id, data);

    response.status(200).json(vinculos);
  };
}
