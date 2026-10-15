import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { TokenPayload } from '../types/token-payload.js';

/**
 * Autorização por escopo de departamento.
 *
 * Este é o ÚNICO arquivo que decide se um usuário pode acessar, agir ou
 * ser responsável em um departamento. Os services não consultam
 * UsuarioDepartamento diretamente para isso: usam as funções abaixo.
 *
 * Padrão de nomes:
 * - get...    → calcula o escopo ou um filtro; nunca lança erro
 * - scope...  → função pura sobre um escopo já calculado; não consulta o banco
 * - assert... → valida e lança AppError quando o usuário está fora do escopo
 */

export type DepartamentoScope = number[] | 'all';

// basta id e tipo: serve tanto para o usuário do token quanto para um usuário lido do banco
type UsuarioScope = Pick<TokenPayload, 'id' | 'tipoUsuario'>;

/**
 * "Quais departamentos esse usuário pode acessar?"
 *
 * - gestor: todos ('all')
 * - funcionário: apenas vinculados em UsuarioDepartamento ([n])
 * - munícipe, anônimo: nenhum ([])
 */
export async function getDepartamentoScope(
  usuario: UsuarioScope,
): Promise<DepartamentoScope> {
  if (usuario.tipoUsuario === 'gestor') {
    return 'all';
  }

  if (usuario.tipoUsuario !== 'funcionario') {
    return [];
  }

  const vinculos = await prisma.usuarioDepartamento.findMany({
    where: { idUsuario: usuario.id },
    select: { idDepartamento: true },
  });

  return vinculos.map(
    (vinculo: { idDepartamento: number }) => vinculo.idDepartamento,
  );
}

/**
 * "Este departamento está dentro do escopo?"
 *
 * - Verdadeiro se o escopo for 'all' ou incluir o departamento requisitado
 */
export function scopeIncludesDepartamento(
  scope: DepartamentoScope,
  idDepartamento: number,
): boolean {
  return scope === 'all' || scope.includes(idDepartamento);
}

/**
 * Responde "como filtrar uma consulta Prisma pelo escopo?"
 *
 * - 'all' → undefined (Prisma ignora o filtro)
 * - lista → { in: [...] } (lista vazia não retorna nada)
 *
 * Funciona com qualquer campo de departamento:
 *   where: { idDepartamento: scopeFilter(scope) }
 *   where: { idDepartamentoSolicitado: scopeFilter(scope) }
 */
export function scopeFilter(
  scope: DepartamentoScope,
): { in: number[] } | undefined {
  return scope === 'all' ? undefined : { in: scope };
}

/**
 * Responde "como filtrar uma consulta $queryRaw pelo escopo?".
 *
 * - 'all' → TRUE (sem filtro)
 * - lista vazia → FALSE (nenhuma linha)
 * - lista → coluna IN (...)
 *
 * A coluna deve ser um identificador fixo do código, nunca entrada do usuário:
 *   Prisma.sql`... WHERE ${scopeSql(scope, Prisma.raw('t.id_departamento'))}`
 */
export function scopeSql(
  scope: DepartamentoScope,
  coluna: Prisma.Sql,
): Prisma.Sql {
  if (scope === 'all') {
    return Prisma.sql`TRUE`;
  }

  if (scope.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`${coluna} IN (${Prisma.join(scope)})`;
}

/**
 * Responde "quem faz a requisição pode agir neste departamento?"
 *
 * - Se estiver fora do escopo, lança erro (403)
 * - Se estiver no escopo, passa
 */
export async function assertDepartamentoAccess(
  usuario: UsuarioScope,
  idDepartamento: number,
): Promise<void> {
  const scope = await getDepartamentoScope(usuario);

  if (!scopeIncludesDepartamento(scope, idDepartamento)) {
    throw new AppError('Você não tem acesso a este departamento', 403);
  }
}

/**
 * Responde "o usuário informado pode ser responsável
 * por um ticket deste departamento?".
 *
 * Valida o usuário que RECEBE o ticket, não quem faz a requisição;
 * por isso os erros são 400 (dado inválido), e não 403.
 *
 * - Precisa existir e ser funcionário (gestor não assume ticket)
 * - Precisa estar ativo
 * - O departamento do ticket precisa estar no escopo dele
 */
export async function assertResponsavelInScope(
  idUsuario: number,
  idDepartamento: number,
): Promise<void> {
  const responsavel = await prisma.user.findUnique({
    where: { id: idUsuario },
    select: { id: true, tipoUsuario: true, ativo: true },
  });

  if (!responsavel || responsavel.tipoUsuario !== 'funcionario') {
    throw new AppError('O responsável informado deve ser um funcionário', 400);
  }

  if (!responsavel.ativo) {
    throw new AppError('O responsável informado está inativo', 400);
  }

  const scope = await getDepartamentoScope(responsavel);

  if (!scopeIncludesDepartamento(scope, idDepartamento)) {
    throw new AppError(
      'O funcionário informado não pertence ao departamento do ticket',
      400,
    );
  }
}

/**
 * "Desta lista, quais departamentos estão ativos?"
 *
 * Retorna um array com os IDs dos departamentos ativos
 */
async function getActiveDepartamentoIds(
  departamentoIds: number[],
): Promise<number[]> {
  if (departamentoIds.length === 0) {
    return [];
  }
 
  const departamentos = await prisma.departamento.findMany({
    where: { id: { in: departamentoIds }, ativo: true },
    select: { id: true },
  });
 
  return departamentos.map((departamento: { id: number }) => departamento.id);
}
 
/**
 * Regra única para vincular usuários a departamentos:
 * remove duplicatas, exige que todos existam e estejam ativos.
 * Lista vazia é permitida e retorna [].
 */
export async function resolveActiveDepartamentoIds(
  departamentoIds: number[],
): Promise<number[]> {
  const idsUnicos = [...new Set(departamentoIds)];
  const ativos = await getActiveDepartamentoIds(idsUnicos);
  const invalidos = idsUnicos.filter((id) => !ativos.includes(id));
 
  if (invalidos.length > 0) {
    throw new AppError(
      `Departamentos inexistentes ou inativos: ${invalidos.join(', ')}`,
      400,
    );
  }
 
  return idsUnicos;
}