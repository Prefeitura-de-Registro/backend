import type { Request, Response } from 'express';
import { generateToken } from '../../shared/utils/jwt.js';
import { userService } from './user.service.js';
import type {
  CreateFuncionarioBodyDTO,
  CreateUserDTO,
  GetManyFuncionariosQueryDTO,
  LoginUserDTO,
  SetDepartamentosBodyDTO,
  UpdateUserBodyDTO,
  UpdateMeBodyDTO,
  UserIdParamsDTO,
} from './dtos/user.dto.js';

export class UserController {
  register = async (request: Request, response: Response) => {
    const data = request.validated?.body as CreateUserDTO;

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
    const data = request.validated?.body as LoginUserDTO;

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
    const data = request.validated?.body as UpdateUserBodyDTO;

    const usuario = await userService.update(id, data, request.user!.id);

    response.status(200).json(usuario);
  };

  updateMe = async (request: Request, response: Response) => {
    const data = request.validated?.body as UpdateMeBodyDTO;

    const usuario = await userService.updateMe(request.user!.id, data);

    response.status(200).json(usuario);
  };

  remove = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;

    const usuario = await userService.softDelete(id, request.user!.id);

    response.status(200).json(usuario);
  };

  setDepartamentos = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;
    const data = request.body as SetDepartamentosBodyDTO;

    const vinculos = await userService.setDepartamentos(
      id,
      data,
      request.user!.id,
    );

    response.status(200).json(vinculos);
  };

  getManyFuncionarios = async (request: Request, response: Response) => {
    const query = request.validated?.query as GetManyFuncionariosQueryDTO;

    const result = await userService.getManyFuncionarios(query);

    response.status(200).json(result);
  };

  getById = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as UserIdParamsDTO;

    response.status(200).json(await userService.getById(id));
  };

  createFuncionario = async (request: Request, response: Response) => {
    const body = request.validated?.body as CreateFuncionarioBodyDTO;

    const result = await userService.createFuncionario(body, request.user!.id);

    response.status(201).json(result);
  };
}
