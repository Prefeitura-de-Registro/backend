import { ticketService as portalTicketService } from './ticket.services.js';
import type { Request, Response } from 'express';
import type {
  GetManyTicketDTO,
  CreateSolicitacaoBodyDTO,
  GetManyTicketsQueryDTO,
  TicketIdParamsDTO,
  UpdateTicketBodyDTO,
} from './dtos/ticket.dto.js';
import { ticketService } from './ticket.service.js';

class TicketController {
  getMany = async (request: Request, response: Response) => {
    const query = request.validated?.query as GetManyTicketsQueryDTO;

    const result = await ticketService.getMany(request.user!, query);

    response.status(200).json(result);
  };

  getById = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;

    const ticket = await ticketService.getById(request.user!, id);

    response.status(200).json(ticket);
  };

  assume = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;

    const ticket = await ticketService.assume(request.user!, id);

    response.status(200).json(ticket);
  };

  update = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;
    const body = request.body as UpdateTicketBodyDTO;

    const ticket = await ticketService.update(request.user!, id, body);

    response.status(200).json(ticket);
  };

  createSolicitacao = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;
    const body = request.body as CreateSolicitacaoBodyDTO;

    const solicitacao = await ticketService.createSolicitacao(
      request.user!,
      id,
      body,
    );

    response.status(201).json(solicitacao);
  };

  getSolicitacoes = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;

    const solicitacoes = await ticketService.getSolicitacoes(request.user!, id);

    response.status(200).json(solicitacoes);
  };
}

export const ticketController = new TicketController();

export class TicketsController {
  getMany = async (request: Request, response: Response): Promise<void> => {
    const filters = request.validated?.query as GetManyTicketDTO;
    const user = request.user;

    const result = await portalTicketService.getMany(filters, user);

    response.status(200).json(result);
  };
}
