import type { Request, Response } from 'express';
import { enviarArquivo } from '../../shared/storage/enviar-arquivo.js';
import { arquivosDaRequisicao } from '../../shared/middlewares/upload.middleware.js';
import type {
  CreateSolicitacaoBodyDTO,
  CreateTicketBodyDTO,
  GetMeusTicketsQueryDTO,
  GetManyTicketsQueryDTO,
  TicketIdParamsDTO,
  UpdateTicketBodyDTO,
} from './dtos/ticket.dto.js';
import { ticketService } from './ticket.service.js';

class TicketController {
  create = async (request: Request, response: Response) => {
    const body = request.body as CreateTicketBodyDTO;

    const ticket = await ticketService.create(
      request.user!,
      body,
      arquivosDaRequisicao(request),
    );

    response.status(201).json(ticket);
  };

  getMeus = async (request: Request, response: Response) => {
    const query = request.validated?.query as GetMeusTicketsQueryDTO;

    response
      .status(200)
      .json(await ticketService.getMeus(request.user!, query));
  };

  getMeuById = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as TicketIdParamsDTO;

    response
      .status(200)
      .json(await ticketService.getMeuById(request.user!, id));
  };

  acompanhar = async (request: Request, response: Response) => {
    const { codigo } = request.validated?.params as { codigo: string };

    response.status(200).json(await ticketService.acompanhar(codigo));
  };

  getArquivoPublico = async (request: Request, response: Response) => {
    const { codigo, idArquivo } = request.validated?.params as {
      codigo: string;
      idArquivo: number;
    };

    const caminho = await ticketService.getArquivoPublico(codigo, idArquivo);

    await enviarArquivo(response, caminho);
  };

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
