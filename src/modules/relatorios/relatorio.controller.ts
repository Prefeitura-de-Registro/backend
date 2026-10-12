import type { Request, Response } from 'express';
import type { RelatorioQueryDTO } from './dtos/relatorio.dto.js';
import { relatorioService } from './relatorio.service.js';

class RelatorioController {
  getIndicadores = async (request: Request, response: Response) => {
    const query = request.validated?.query as RelatorioQueryDTO;

    const result = await relatorioService.getIndicadores(request.user!, query);

    response.status(200).json(result);
  };

  getVolumeSemanal = async (request: Request, response: Response) => {
    const query = request.validated?.query as RelatorioQueryDTO;

    const result = await relatorioService.getVolumeSemanal(request.user!, query);

    response.status(200).json(result);
  };

  getTicketsPorCategoria = async (request: Request, response: Response) => {
    const query = request.validated?.query as RelatorioQueryDTO;

    const result = await relatorioService.getTicketsPorCategoria(request.user!, query);

    response.status(200).json(result);
  };

  getDesempenhoPorDepartamento = async (request: Request, response: Response) => {
    const query = request.validated?.query as RelatorioQueryDTO;

    const result = await relatorioService.getDesempenhoPorDepartamento(request.user!, query);

    response.status(200).json(result);
  };
}

export const relatorioController = new RelatorioController();