import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes.js";
import { usersRoutes } from "../modules/users/user.routes.js";

const routes = Router();

routes.use("/health", healthRoutes);
routes.use("/api/user/", usersRoutes);

export { routes };
