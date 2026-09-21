import type { Request, Response } from "express";
import { ticketService } from "./ticket.services.js";
import { GetManyTicketDTO } from "./dtos/ticket.dto.js";

export class TicketsController {
  getMany = async (request: Request, response: Response): Promise<void> => {
    const filters = request.query as unknown as GetManyTicketDTO;
    const user = request.user;

    const result = await ticketService.getMany(filters, user);

    response.status(200).json(result);
  };
}