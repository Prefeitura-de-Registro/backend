import { getAccessibleDepartamentoIds } from '../../shared/authorization/department-scope.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { TokenPayload } from '../../shared/types/token-payload.js';

class ArquivoService {
  /**
   * Resolve o arquivo (e confere permissão) para o controller entregar.
   *
   * - Foto do ticket: dono do ticket (munícipe), ou funcionário/gestor do
   *   departamento do ticket ou de um departamento que recebeu solicitação
   *   desse ticket.
   * - Imagem de mensagem de solicitação (chat interno): somente funcionário/
   *   gestor do departamento do ticket ou do solicitado. Munícipe NUNCA.
   */
  async getFile(user: TokenPayload, id: number) {
    const arquivo = await prisma.arquivo.findUnique({
      where: { id },
      include: {
        ticket: {
          select: {
            idUsuario: true,
            idDepartamento: true,
            solicitacoes: { select: { idDepartamentoSolicitado: true } },
          },
        },
        solicitacaoMensagem: {
          select: {
            solicitacao: {
              select: {
                idDepartamentoSolicitado: true,
                ticket: { select: { idDepartamento: true } },
              },
            },
          },
        },
      },
    });

    if (!arquivo) {
      throw new AppError('Arquivo não encontrado', 404);
    }

    const ehEquipe =
      user.tipoUsuario === 'funcionario' || user.tipoUsuario === 'gestor';
    const scope = ehEquipe ? await getAccessibleDepartamentoIds(user) : [];
    const noEscopo = (...ids: number[]) =>
      scope === 'all' ||
      ids.some((idDepartamento) => scope.includes(idDepartamento));

    let permitido = false;

    if (arquivo.ticket) {
      permitido =
        arquivo.ticket.idUsuario === user.id ||
        noEscopo(
          arquivo.ticket.idDepartamento,
          ...arquivo.ticket.solicitacoes.map(
            (s: { idDepartamentoSolicitado: number }) =>
              s.idDepartamentoSolicitado,
          ),
        );
    } else if (arquivo.solicitacaoMensagem) {
      const { solicitacao } = arquivo.solicitacaoMensagem;
      permitido =
        ehEquipe &&
        noEscopo(
          solicitacao.idDepartamentoSolicitado,
          solicitacao.ticket.idDepartamento,
        );
    }

    if (!permitido) {
      throw new AppError('Você não tem acesso a este arquivo', 403);
    }

    return arquivo.path;
  }
}

export const arquivoService = new ArquivoService();
