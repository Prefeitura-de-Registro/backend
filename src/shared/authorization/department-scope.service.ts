import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { TokenPayload } from '../types/token-payload.js';

/**
 * Responsável por responder "quais departamentos/tickets esse usuário pode acessar?".
 *
 * Hoje só existe o tipo `funcionario`, então o escopo é sempre a lista de
 * departamentos vinculados em `UsuarioDepartamento`. Quando o tipo `admin`
 * for introduzido no banco (fora do escopo desta Issue), esta função poderá
 * retornar `"all"` para ele, e nenhum service de ticket/solicitação precisará
 * ser alterado, pois todos consultam o escopo por aqui.
 */
export type DepartmentScope = number[] | 'all';

export async function getAccessibleDepartamentoIds(
  user: TokenPayload,
): Promise<DepartmentScope> {
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
