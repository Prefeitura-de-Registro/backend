import { prisma } from "../../shared/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

class TicketService {
    async getAllTickets() {
        const tickets = Array(await prisma.ticket.findMany())

        if(!tickets) {
            throw new AppError("Nenhum ticket encontrado", 401)
        } else return tickets
    }
}

export const ticketService = new TicketService()