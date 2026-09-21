import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validateBody } from "../../shared/middlewares/validate.middleware.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { createUserSchema, loginUserSchema } from "./schemas/user.schema.js";
import { UserController } from "./user.controller.js";

const usersRoutes = Router();
const usersController = new UserController();

usersRoutes.post("/register", validateBody(createUserSchema), asyncHandler(usersController.register));
usersRoutes.post("/login", validateBody(loginUserSchema), asyncHandler(usersController.login));
usersRoutes.get("/me", authMiddleware, asyncHandler(usersController.me))

export { usersRoutes };