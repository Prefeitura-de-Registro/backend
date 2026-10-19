import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/app-error.js';

let cache: number | null = null;

/** Id da linha reservada (usuário anônimo) criada no seed do banco. */
export async function getUsuarioAnonimoId(): Promise<number> {
  if (cache !== null) {
    return cache;
  }

  const reservado = await prisma.user.findFirst({
    where: { reservado: true },
    select: { id: true },
  });

  if (!reservado) {
    throw new AppError(
      'Usuário anônimo não configurado no banco (rode o seed)',
      500,
    );
  }

  cache = reservado.id;
  return cache;
}
