import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { TokenPayload } from '../types/token-payload.js';

/**
 * Responsável por responder "quais departamentos/tickets esse usuário pode acessar?".
 *
 * - `gestor`: supervisiona tudo -> `"all"` (não depende dos vínculos, então um
 *   departamento novo já fica visível para ele).
 * - `funcionario`: lista de departamentos vinculados em `UsuarioDepartamento`.
 *
 * Todos os services consultam o escopo por aqui.
 */
export type DepartmentScope = number[] | 'all';

export async function getAccessibleDepartamentoIds(
  user: TokenPayload,
): Promise<DepartmentScope> {
  if (user.tipoUsuario === 'gestor') {
    return 'all';
  }

  const vinculos = await prisma.usuarioDepartamento.findMany({
    where: { idUsuario: user.id },
    select: { idDepartamento: true },
  });

  return vinculos.map(
    (vinculo: { idDepartamento: number }) => vinculo.idDepartamento,
  );
}

export async function assertDepartmentAccess(
  user: TokenPayload,
  idDepartamento: number,
): Promise<void> {
  const scope = await getAccessibleDepartamentoIds(user);

  if (scope === 'all') {
    return;
  }

  if (!scope.includes(idDepartamento)) {
    throw new AppError('Você não tem acesso a este departamento', 403);
  }
}

export async function assertFuncionarioPertenceAoDepartamento(
  idUsuario: number,
  idDepartamento: number,
): Promise<void> {
  const vinculo = await prisma.usuarioDepartamento.findFirst({
    where: { idUsuario, idDepartamento },
  });

  if (!vinculo) {
    throw new AppError(
      'O funcionário informado não pertence ao departamento do ticket',
      400,
    );
  }
}

// verifica IDs dos departamentos ativos
export async function getActiveDepartamentoIds(
  departamentoIds: number[],
): Promise<number[]> {
  const idsUnicos = [...new Set(departamentoIds)];

  if (idsUnicos.length === 0) {
    return [];
  }

  const departamentos = await prisma.departamento.findMany({
    where: { id: { in: idsUnicos }, ativo: true },
    select: { id: true },
  });

  return departamentos.map((departamento: { id: number }) => departamento.id);
}
