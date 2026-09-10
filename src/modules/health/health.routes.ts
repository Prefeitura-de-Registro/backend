import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { HealthController } from "./health.controller.js";

const healthRoutes = Router();
const healthController = new HealthController();

healthRoutes.get("/", asyncHandler(healthController.check));

export { healthRoutes };
