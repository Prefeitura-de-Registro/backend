import type { Request, Response } from "express";
import { ticketService } from "./ticket.services.js";

export class TicketsController {
    getMany = async (request: Request, response: Response) : Promise<void> => {
        response.status(200).json({ message: "OK" });
    }
}