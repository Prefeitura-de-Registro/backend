import type { Request, Response } from 'express';
import type {
  RespondSolicitacaoBodyDTO,
  SolicitacaoIdParamsDTO,
} from './dtos/solicitacao.dto.js';
import { solicitacaoService } from './solicitacao.service.js';

class SolicitacaoController {
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
