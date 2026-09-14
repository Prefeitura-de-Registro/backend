import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validateBody } from "../../shared/middlewares/validate.middleware.js";
import { createUserSchema } from "./schemas/user.schema.js";
import { UserController } from "./user.controller.js";

const usersRoutes = Router();
const usersController = new UserController();

usersRoutes.post("/register", validateBody(createUserSchema), asyncHandler(usersController.register));


export { usersRoutes };