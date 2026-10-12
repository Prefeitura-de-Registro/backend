import type { Request, Response } from 'express';
import type { MapaTicketsQueryDTO } from './dtos/mapa.dto.js';
import { mapaService } from './mapa.service.js';

class MapaController {
  getTickets = async (request: Request, response: Response) => {
    const query = request.validated?.query as MapaTicketsQueryDTO;

    const result = await mapaService.getTickets(request.user!, query);

    response.status(200).json(result);
  };
}

export const mapaController = new MapaController();