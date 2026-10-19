import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { requireAutenticado } from '../../shared/middlewares/authorization.middleware.js';
import { validateParams } from '../../shared/middlewares/validate.middleware.js';
import { enviarArquivo } from '../../shared/storage/enviar-arquivo.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { arquivoService } from './arquivo.service.js';

const arquivoIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const arquivoRoutes = Router();

arquivoRoutes.use(authMiddleware, requireAutenticado);

arquivoRoutes.get(
  '/:id',
  validateParams(arquivoIdParamsSchema),
  asyncHandler(async (request, response) => {
    const { id } = request.validated?.params as z.infer<
      typeof arquivoIdParamsSchema
    >;

    const caminho = await arquivoService.getFile(request.user!, id);

    await enviarArquivo(response, caminho);
  }),
);

export { arquivoRoutes };
