import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { authMiddleware } from '../../shared/middlewares/authenticate.middleware.js';
import { authorizeMiddleware } from '../../shared/middlewares/authorize.middleware.js';
import {
  createFuncionarioBodySchema,
  createUserSchema,
  getManyFuncionariosQuerySchema,
  loginUserSchema,
  setDepartamentosBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './schemas/user.schema.js';
import { UserController } from './user.controller.js';

const usersRoutes = Router();
const usersController = new UserController();

// rotas públicas
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

// autenticadas
usersRoutes.use(authMiddleware);
usersRoutes.get('/me', asyncHandler(usersController.me));

// gestor
usersRoutes.use(authorizeMiddleware('gestor'));
usersRoutes.post(
  '/funcionario',
  validateBody(createFuncionarioBodySchema),
  asyncHandler(usersController.createFuncionario)
)

usersRoutes.patch(
  '/:id',
  validateParams(userIdParamsSchema),
  validateBody(updateUserBodySchema),
  asyncHandler(usersController.update),
);

usersRoutes.delete(
  '/:id',
  validateParams(userIdParamsSchema),
  asyncHandler(usersController.remove),
);

usersRoutes.put(
  '/:id/departamentos',
  validateParams(userIdParamsSchema),
  validateBody(setDepartamentosBodySchema),
  asyncHandler(usersController.setDepartamentos),
);

usersRoutes.get(
  '/funcionario',
  validateQuery(getManyFuncionariosQuerySchema),
  asyncHandler(usersController.getManyFuncionarios),
)

export { usersRoutes };