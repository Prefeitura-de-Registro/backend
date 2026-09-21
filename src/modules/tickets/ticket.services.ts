import { prisma } from "../../shared/database/prisma.js";
import { GetManyTicketDTO } from "./dtos/ticket.dto.js";

export interface UserContext {
  id?: number | string;
  tipoUsuario?: "municipe" | "funcionario";
}

class TicketService {
  async getMany(filters: GetManyTicketDTO, user?: UserContext) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
    }

    // Filtros de visibilidade baseados no perfil do usuário
    if (!user) {
      // Usuários anônimos acessam apenas tickets sem usuário vinculado
      where.userId = null;
    } else if (user.tipoUsuario === "municipe") {
      // Munícipes visualizam apenas seus próprios tickets
      where.userId = Number(user.id);
    } else if (user.tipoUsuario === "funcionario") {
      // Funcionários têm acesso a todos os tickets
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const ticketService = new TicketService();