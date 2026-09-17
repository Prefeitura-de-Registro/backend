import { Router } from "express";
import { TicketsController } from "./ticket.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { getManyTicketSchema } from "./schemas/ticket.schema.js";
import { validateQuery } from "../../shared/middlewares/validate.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";

const ticketsRoutes = Router();
const ticketsController = new TicketsController();

ticketsRoutes.get("/tickets", authMiddleware, validateQuery(getManyTicketSchema), asyncHandler(ticketsController.getMany))
