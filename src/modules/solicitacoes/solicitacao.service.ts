import { SolicitacaoStatus } from '@prisma/client';
import { assertDepartmentAccess } from '../../shared/authorization/department-scope.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';
import type { RespondSolicitacaoBodyDTO } from './dtos/solicitacao.dto.js';

class SolicitacaoService {
  async respond(
    user: TokenPayload,
    id: number,
    body: RespondSolicitacaoBodyDTO,
  ) {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    // O funcionário que responde precisa pertencer ao departamento
    // SOLICITADO, não ao departamento responsável pelo ticket original.
    await assertDepartmentAccess(user, solicitacao.idDepartamentoSolicitado);

    if (
      solicitacao.status === SolicitacaoStatus.respondida ||
      solicitacao.status === SolicitacaoStatus.recusada
    ) {
      throw new AppError('Esta solicitação já foi finalizada', 409);
    }

    const finalizando =
      body.status === 'respondida' || body.status === 'recusada';

    return prisma.solicitacao.update({
      where: { id },
      data: {
        status: body.status,
        resposta: body.resposta ?? solicitacao.resposta,
        respondidoPor: finalizando ? user.id : solicitacao.respondidoPor,
        respondidoEm: finalizando ? new Date() : solicitacao.respondidoEm,
      },
      include: {
        departamentoSolicitado: true,
        ticket: true,
        usuarioRespondedor: { select: { id: true, name: true } },
      },
    });
  }
}

export const solicitacaoService = new SolicitacaoService();
