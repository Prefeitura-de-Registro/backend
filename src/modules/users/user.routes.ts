import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  validateBody,
  validateParams,
} from '../../shared/middlewares/validate.middleware.js';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireGestor } from '../../shared/middlewares/authorization.middleware.js';
import {
  createFuncionarioSchema,
  createUserSchema,
  loginUserSchema,
  setDepartamentosBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './schemas/user.schema.js';
import { UserController } from './user.controller.js';

const usersRoutes = Router();
const usersController = new UserController();

// Cadastro público: exclusivo de munícipes (o tipo é definido no service).
usersRoutes.post(
  '/register',
  validateBody(createUserSchema),
  asyncHandler(usersController.register),
);
usersRoutes.post(
  '/login',
  validateBody(loginUserSchema),
  asyncHandler(usersController.login),
);
usersRoutes.get('/me', authMiddleware, asyncHandler(usersController.me));

// Gestão de usuários: somente gestores. Isso inclui cadastrar funcionários,
// editar (inclusive trocar o tipo), desativar e vincular a departamentos.
usersRoutes.post(
  '/funcionarios',
  authMiddleware,
  requireGestor,
  validateBody(createFuncionarioSchema),
  asyncHandler(usersController.registerFuncionario),
);

usersRoutes.patch(
  '/:id',
  authMiddleware,
  requireGestor,
  validateParams(userIdParamsSchema),
  validateBody(updateUserBodySchema),
  asyncHandler(usersController.update),
);

usersRoutes.delete(
  '/:id',
  authMiddleware,
  requireGestor,
  validateParams(userIdParamsSchema),
  asyncHandler(usersController.remove),
);

usersRoutes.put(
  '/:id/departamentos',
  authMiddleware,
  requireGestor,
  validateParams(userIdParamsSchema),
  validateBody(setDepartamentosBodySchema),
  asyncHandler(usersController.setDepartamentos),
);

export { usersRoutes };
