import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../shared/middlewares/validate.middleware.js';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import {
  loginLimiter,
  registerLimiter,
} from '../../shared/middlewares/rate-limit.middleware.js';
import { requireGestor } from '../../shared/middlewares/authorization.middleware.js';
import { requireAutenticado } from '../../shared/middlewares/authorization.middleware.js';
import {
  createFuncionarioBodySchema,
  createUserSchema,
  getManyFuncionariosQuerySchema,
  loginUserSchema,
  setDepartamentosBodySchema,
  updateUserBodySchema,
  updateMeBodySchema,
  userIdParamsSchema,
} from './schemas/user.schema.js';
import { UserController } from './user.controller.js';

const usersRoutes = Router();
const usersController = new UserController();

// rotas públicas
usersRoutes.post(
  '/register',
  registerLimiter,
  validateBody(createUserSchema),
  asyncHandler(usersController.register),
);
usersRoutes.post(
  '/login',
  loginLimiter,
  validateBody(loginUserSchema),
  asyncHandler(usersController.login),
);

// rotas autenticadas
usersRoutes.use(authMiddleware);
usersRoutes.get('/me', asyncHandler(usersController.me));
usersRoutes.patch(
  '/me',
  requireAutenticado,
  validateBody(updateMeBodySchema),
  asyncHandler(usersController.updateMe),
);

// rotas de gestor
usersRoutes.use(requireGestor);
usersRoutes.post(
  '/',
  validateBody(createFuncionarioBodySchema),
  asyncHandler(usersController.createFuncionario),
);

// alias de POST / (mesmo handler)
usersRoutes.post(
  '/funcionarios',
  validateBody(createFuncionarioBodySchema),
  asyncHandler(usersController.createFuncionario),
);

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
  '/',
  validateQuery(getManyFuncionariosQuerySchema),
  asyncHandler(usersController.getManyFuncionarios),
);

export { usersRoutes };

usersRoutes.get(
  '/:id',
  validateParams(userIdParamsSchema),
  asyncHandler(usersController.getById),
);
