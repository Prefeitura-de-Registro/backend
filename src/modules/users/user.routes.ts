import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validateBody, validateParams } from "../../shared/middlewares/validate.middleware.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { requireFuncionario } from "../../shared/middlewares/authorization.middleware.js";
import {
  createUserSchema,
  loginUserSchema,
  setDepartamentosBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from "./schemas/user.schema.js";
import { UserController } from "./user.controller.js";

const usersRoutes = Router();
const usersController = new UserController();

usersRoutes.post("/register", validateBody(createUserSchema), asyncHandler(usersController.register));
usersRoutes.post("/login", validateBody(loginUserSchema), asyncHandler(usersController.login));
usersRoutes.get("/me", authMiddleware, asyncHandler(usersController.me));

// Gestão de usuários. Ainda não existe um tipo "admin" no banco (ver Issue #11),
// então por ora exigimos apenas estar autenticado como funcionário. Quando o
// tipo admin existir, troque requireFuncionario por um requireAdmin aqui.
usersRoutes.patch(
  "/:id",
  authMiddleware,
  requireFuncionario,
  validateParams(userIdParamsSchema),
  validateBody(updateUserBodySchema),
  asyncHandler(usersController.update),
);

usersRoutes.delete(
  "/:id",
  authMiddleware,
  requireFuncionario,
  validateParams(userIdParamsSchema),
  asyncHandler(usersController.remove),
);

usersRoutes.put(
  "/:id/departamentos",
  authMiddleware,
  requireFuncionario,
  validateParams(userIdParamsSchema),
  validateBody(setDepartamentosBodySchema),
  asyncHandler(usersController.setDepartamentos),
);

export { usersRoutes };
