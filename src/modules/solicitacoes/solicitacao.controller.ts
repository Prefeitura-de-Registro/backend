import type { Request, Response } from 'express';
import { arquivosDaRequisicao } from '../../shared/middlewares/upload.middleware.js';
import type {
  CreateMensagemBodyDTO,
  GetManySolicitacoesQueryDTO,
  RespondSolicitacaoBodyDTO,
  SolicitacaoIdParamsDTO,
} from './dtos/solicitacao.dto.js';
import { solicitacaoService } from './solicitacao.service.js';

class SolicitacaoController {
  getMany = async (request: Request, response: Response) => {
    const query = request.validated?.query as GetManySolicitacoesQueryDTO;

    response
      .status(200)
      .json(await solicitacaoService.getMany(request.user!, query));
  };

  getById = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as SolicitacaoIdParamsDTO;

    response
      .status(200)
      .json(await solicitacaoService.getById(request.user!, id));
  };

  getMensagens = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as SolicitacaoIdParamsDTO;

    response
      .status(200)
      .json(await solicitacaoService.getMensagens(request.user!, id));
  };

  createMensagem = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as SolicitacaoIdParamsDTO;
    const body = request.body as CreateMensagemBodyDTO;

    const mensagem = await solicitacaoService.createMensagem(
      request.user!,
      id,
      body,
      arquivosDaRequisicao(request),
    );

    response.status(201).json(mensagem);
  };

  respond = async (request: Request, response: Response) => {
    const { id } = request.validated?.params as SolicitacaoIdParamsDTO;
    const body = request.body as RespondSolicitacaoBodyDTO;

    const solicitacao = await solicitacaoService.respond(
      request.user!,
      id,
      body,
    );

    response.status(200).json(solicitacao);
  };
}

export const solicitacaoController = new SolicitacaoController();
