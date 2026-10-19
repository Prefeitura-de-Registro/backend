import { prisma } from '../../shared/database/prisma.js';

class DepartamentoService {
  /**
   * Departamentos ativos (de secretarias ativas) para escolher o destino de
   * uma solicitação. `excluir` tira o departamento do próprio ticket, pois a
   * regra proíbe solicitar ao mesmo departamento.
   */
  async list(excluir?: number) {
    return prisma.departamento.findMany({
      where: {
        ativo: true,
        secretaria: { ativo: true },
        ...(excluir ? { id: { not: excluir } } : {}),
      },
      orderBy: [{ nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        sigla: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
    });
  }
}

export const departamentoService = new DepartamentoService();
