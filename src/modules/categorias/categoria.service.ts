import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

/**
 * Rotas PÚBLICAS: alimentam o formulário de abertura de chamado.
 * Nunca expor `reducaoMinutos`, `critica`, prazos ou o departamento
 * solicitado das perguntas (isso é regra interna de SLA/roteamento).
 */
class CategoriaService {
  async list() {
    return prisma.categoria.findMany({
      where: { ativo: true, departamento: { ativo: true } },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        departamento: { select: { id: true, nome: true, sigla: true } },
      },
    });
  }

  async listPerguntas(idCategoria: number) {
    const categoria = await prisma.categoria.findFirst({
      where: { id: idCategoria, ativo: true, departamento: { ativo: true } },
      select: { id: true },
    });

    if (!categoria) {
      throw new AppError('Categoria não encontrada', 404);
    }

    return prisma.pergunta.findMany({
      where: { idCategoria },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      select: { id: true, enunciado: true, ordem: true },
    });
  }
}

export const categoriaService = new CategoriaService();
