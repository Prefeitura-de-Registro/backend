import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  CreateUserDTO,
  LoginUserDTO,
  SetDepartamentosBodyDTO,
  UpdateUserBodyDTO,
  UpdateMeBodyDTO,
  GetManyFuncionariosQueryDTO,
  CreateFuncionarioBodyDTO,
} from './dtos/user.dto.js';
import { hashPassword, comparePassword } from '../../shared/utils/hash.js';
import { getActiveDepartamentoIds } from '../../shared/authorization/department-scope.service.js';
import { registrarAuditoria } from '../../shared/utils/auditoria.js';
import { mascararCpf, somenteDigitos } from '../../shared/utils/cpf.js';

// atributos retornados em update, softDelete
const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  tipoUsuario: true,
  ativo: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

// atributos retornados em getManyFuncionarios
const funcionarioSummarySelect = {
  id: true,
  name: true,
  email: true,
  tipoUsuario: true,
  matricula: true,
  cargo: true,
  cpf: true, // só para mascarar na resposta; nunca sai completo na listagem
  usuarioDepartamentos: {
    // retorna o nome dos departamentos
    select: {
      departamento: {
        select: {
          id: true,
          nome: true,
          sigla: true,
        },
      },
    },
  },
  ativo: true,
  createdAt: true,
  _count: {
    // inclui contagem dos tickets assumidos
    select: { ticketsResponsaveis: true },
  },
} satisfies Prisma.UserSelect;

// tipa retorno puro em getManyFuncionarios
type FuncionarioSelectOriginal = Prisma.UserGetPayload<{
  select: typeof funcionarioSummarySelect;
}>;

// mapeia retorno formatado em getManyFuncionarios
function toGetManyFuncionariosResponse(funcionario: FuncionarioSelectOriginal) {
  const { usuarioDepartamentos, _count, cpf, ...dados } = funcionario;
  return {
    ...dados,
    cpf: mascararCpf(cpf), // LGPD: ***.123.456-**
    departamentos: usuarioDepartamentos.map(({ departamento }) => departamento),
    totalTickets: _count.ticketsResponsaveis,
  };
}

class UserService {
  async create(data: CreateUserDTO) {
    const existente = await prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });

    const passwordHash = await hashPassword(data.senha);

    if (existente) {
      // Conta ativa, ou conta inativa de funcionário/gestor: o cadastro público NUNCA reativa
      if (existente.ativo || existente.tipoUsuario !== 'municipe') {
        throw new AppError('Já existe um cadastro com esse e-mail', 409);
      }

      // Munícipe tinha passado por soft delete: reativa o mesmo registro
      return prisma.user.update({
        where: { id: existente.id },
        data: {
          name: data.nome,
          passwordHash,
          tipoUsuario: 'municipe',
          ativo: true,
          ...(data.cpf ? { cpf: data.cpf } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          tipoUsuario: true,
          createdAt: true,
        },
      });
    }

    const usuario = await prisma.user.create({
      data: {
        name: data.nome,
        email: data.email,
        passwordHash,
        tipoUsuario: 'municipe',
        cpf: data.cpf ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        tipoUsuario: true,
        createdAt: true,
      },
    });

    return usuario;
  }

  async login(data: LoginUserDTO) {
    const usuario = await prisma.user.findFirst({
      where: {
        email: data.email,
        ativo: true, // apenas usuários ativos logam
      },
    });

    if (!usuario || !usuario.passwordHash) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const senhaValida = await comparePassword(data.senha, usuario.passwordHash);

    if (!senhaValida) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    return usuario;
  }

  /**
   * `actorId` só é informado nas ações do gestor sobre outro cadastro: ativa a
   * proteção contra auto-rebaixamento/auto-desativação e grava auditoria.
   */
  async update(id: number, data: UpdateUserBodyDTO, actorId?: number) {
    const usuario = await this.findUserOrThrow(id);

    if (actorId === id) {
      if (data.tipoUsuario !== undefined && data.tipoUsuario !== 'gestor') {
        throw new AppError('Você não pode rebaixar o próprio perfil', 403);
      }
      if (data.ativo === false) {
        throw new AppError('Você não pode desativar a si mesmo', 403);
      }
    }

    if (data.email && data.email !== usuario.email) {
      const emailEmUso = await prisma.user.findFirst({
        where: { email: data.email },
      });

      if (emailEmUso) {
        throw new AppError('Já existe um cadastro com esse e-mail', 409);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.nome !== undefined) {
      updateData.name = data.nome;
    }

    if (data.email !== undefined) {
      updateData.email = data.email;
    }

    if (data.tipoUsuario !== undefined) {
      updateData.tipoUsuario = data.tipoUsuario;
    }

    if (data.cpf !== undefined) {
      updateData.cpf = data.cpf;
    }

    if (data.matricula !== undefined) {
      updateData.matricula = data.matricula;
    }

    if (data.cargo !== undefined) {
      updateData.cargo = data.cargo;
    }

    if (data.ativo !== undefined) {
      updateData.ativo = data.ativo;
    }

    if (data.senha !== undefined) {
      updateData.passwordHash = await hashPassword(data.senha);
    }

    const atualizado = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSummarySelect,
    });

    if (actorId !== undefined) {
      // Auditoria guarda só o NOME dos campos (nunca CPF/senha: LGPD).
      const camposAlterados = Object.keys(data);
      const tipoMudou =
        data.tipoUsuario !== undefined &&
        data.tipoUsuario !== usuario.tipoUsuario;

      await registrarAuditoria({
        idUsuario: actorId,
        acao: tipoMudou ? 'tipo_usuario_alterado' : 'usuario_alterado',
        entidadeTipo: 'usuarios',
        entidadeId: id,
        dadosAntigos: tipoMudou
          ? { tipoUsuario: usuario.tipoUsuario }
          : { campos: camposAlterados },
        dadosNovos: tipoMudou
          ? { tipoUsuario: data.tipoUsuario }
          : { campos: camposAlterados },
      });
    }

    return atualizado;
  }

  async updateMe(id: number, data: UpdateMeBodyDTO) {
    const { senhaAtual, ...campos } = data;

    if (campos.email !== undefined || campos.senha !== undefined) {
      const usuario = await this.findUserOrThrow(id);

      const senhaValida =
        usuario.passwordHash !== null &&
        (await comparePassword(senhaAtual!, usuario.passwordHash));

      if (!senhaValida) {
        // 400 e não 401, para o front não confundir com sessão expirada e deslogar
        throw new AppError('Senha atual incorreta', 400);
      }
    }

    // campos não tem tipoUsuario, então não há como mudar o próprio papel
    return this.update(id, campos);
  }

  async softDelete(id: number, actorId?: number) {
    if (actorId === id) {
      throw new AppError('Você não pode desativar a si mesmo', 403);
    }

    const usuario = await this.findUserOrThrow(id);

    if (!usuario.ativo) {
      throw new AppError('Usuário já está inativo', 409);
    }

    const desativado = await prisma.user.update({
      where: { id },
      data: { ativo: false },
      select: userSummarySelect,
    });

    if (actorId !== undefined) {
      await registrarAuditoria({
        idUsuario: actorId,
        acao: 'usuario_excluido',
        entidadeTipo: 'usuarios',
        entidadeId: id,
        dadosAntigos: { ativo: true },
        dadosNovos: { ativo: false },
      });
    }

    return desativado;
  }

  // atualiza departamentos do funcionário
  async setDepartamentos(
    id: number,
    data: SetDepartamentosBodyDTO,
    actorId?: number,
  ) {
    await this.findUserOrThrow(id);

    const departamentoIds = [...new Set(data.departamentoIds)];

    if (departamentoIds.length > 0) {
      const existentes = await prisma.departamento.count({
        where: { id: { in: departamentoIds } },
      });

      if (existentes !== departamentoIds.length) {
        throw new AppError(
          'Um ou mais departamentos informados não existem',
          400,
        );
      }
    }

    const vinculos = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const anteriores = await tx.usuarioDepartamento.findMany({
          where: { idUsuario: id },
          select: { idDepartamento: true },
        });
        await tx.usuarioDepartamento.deleteMany({ where: { idUsuario: id } });

        if (departamentoIds.length > 0) {
          await tx.usuarioDepartamento.createMany({
            data: departamentoIds.map((idDepartamento) => ({
              idUsuario: id,
              idDepartamento,
            })),
          });
        }

        if (actorId !== undefined) {
          await registrarAuditoria(
            {
              idUsuario: actorId,
              acao: 'departamentos_alterados',
              entidadeTipo: 'usuarios',
              entidadeId: id,
              dadosAntigos: {
                departamentoIds: anteriores.map(
                  (v: { idDepartamento: number }) => v.idDepartamento,
                ),
              },
              dadosNovos: { departamentoIds },
            },
            tx,
          );
        }

        return tx.usuarioDepartamento.findMany({
          where: { idUsuario: id },
          include: { departamento: true },
        });
      },
    );

    return vinculos;
  }

  // consulta funcionários por nome, ou retorna todos
  async getManyFuncionarios(query: GetManyFuncionariosQueryDTO) {
    // nunca lista a linha reservada (anônimo); por padrão só funcionários
    const where: Prisma.UserWhereInput = {
      tipoUsuario: { in: query.tipo },
      reservado: false,
      ...(query.ativo !== undefined ? { ativo: query.ativo } : {}),
    };

    // busca por nome, e-mail, matrícula ou CPF completo
    if (query.busca) {
      const digitos = somenteDigitos(query.busca);

      where.OR = [
        { name: { contains: query.busca, mode: 'insensitive' } },
        { email: { contains: query.busca, mode: 'insensitive' } },
        { matricula: { contains: query.busca, mode: 'insensitive' } },
        ...(digitos.length === 11 ? [{ cpf: digitos }] : []),
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: funcionarioSummarySelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ name: 'desc' }],
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: data.map(toGetManyFuncionariosResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // detalhe para a tela do gestor (inclui departamentos vinculados e CPF completo)
  async getById(id: number) {
    await this.findUserOrThrow(id);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        tipoUsuario: true,
        cpf: true,
        matricula: true,
        cargo: true,
        ativo: true,
        createdAt: true,
        usuarioDepartamentos: {
          select: {
            departamento: {
              select: {
                id: true,
                nome: true,
                sigla: true,
                secretaria: { select: { id: true, nome: true, sigla: true } },
              },
            },
          },
        },
        _count: { select: { ticketsResponsaveis: true } },
      },
    });

    const { usuarioDepartamentos, _count, ...dados } = usuario;

    return {
      ...dados,
      departamentos: usuarioDepartamentos.map(
        ({ departamento }: { departamento: unknown }) => departamento,
      ),
      totalTickets: _count.ticketsResponsaveis,
    };
  }

  // cadastra funcionários/gestores vinculando-os aos departamentos
  async createFuncionario(data: CreateFuncionarioBodyDTO, actorId?: number) {
    const existente = await prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });
    const passwordHash = await hashPassword(data.senha);
    const departamentoIds = [...new Set(data.departamentoIds)];
    const ativos = await getActiveDepartamentoIds(departamentoIds);
    const invalidos = departamentoIds.filter((id) => !ativos.includes(id));
    const vinculos = departamentoIds.map((idDepartamento) => ({
      idDepartamento,
    }));

    if (invalidos.length > 0) {
      throw new AppError(
        `Departamentos inválidos ou inativos: ${invalidos.join(', ')}`,
        400,
      );
    }

    if (existente) {
      if (existente.ativo) {
        throw new AppError('Já existe um cadastro com esse e-mail', 409);
      }

      // Usuário tinha passado por soft delete: reativa o mesmo registro em
      // vez de criar um novo, preservando o histórico já vinculado a ele
      // (tickets, TicketHistorico, UsuarioDepartamento etc.).
      return prisma.user
        .update({
          where: { id: existente.id },
          data: {
            name: data.nome,
            passwordHash,
            tipoUsuario: data.tipoUsuario ?? 'funcionario',
            ativo: data.status,
            ...(data.cpf ? { cpf: data.cpf } : {}),
            ...(data.matricula ? { matricula: data.matricula } : {}),
            ...(data.cargo ? { cargo: data.cargo } : {}),
            usuarioDepartamentos: {
              deleteMany: {},
              createMany: { data: vinculos },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            tipoUsuario: true,
            matricula: true,
            cargo: true,
            createdAt: true,
          },
        })
        .then((reativado) => this.auditarCriacao(actorId, reativado, true));
    }

    const funcionario = await prisma.user.create({
      data: {
        name: data.nome,
        email: data.email,
        passwordHash,
        tipoUsuario: data.tipoUsuario ?? 'funcionario',
        ativo: data.status,
        cpf: data.cpf ?? null,
        matricula: data.matricula ?? null,
        cargo: data.cargo ?? null,
        usuarioDepartamentos: {
          createMany: { data: vinculos },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        tipoUsuario: true,
        matricula: true,
        cargo: true,
        createdAt: true,
      },
    });

    return this.auditarCriacao(actorId, funcionario, false);
  }

  private async auditarCriacao<T extends { id: number; tipoUsuario: string }>(
    actorId: number | undefined,
    usuario: T,
    reativado: boolean,
  ): Promise<T> {
    if (actorId !== undefined) {
      await registrarAuditoria({
        idUsuario: actorId,
        acao: 'usuario_criado',
        entidadeTipo: 'usuarios',
        entidadeId: usuario.id,
        dadosNovos: { tipoUsuario: usuario.tipoUsuario, reativado },
      });
    }

    return usuario;
  }

  // helper de busca obrigatória por ID
  private async findUserOrThrow(id: number) {
    const usuario = await prisma.user.findUnique({ where: { id } });

    if (!usuario) {
      throw new AppError('Usuário não encontrado', 404);
    }

    if (usuario.reservado) {
      throw new AppError('Este usuário é reservado pelo sistema', 403);
    }

    return usuario;
  }
}

export const userService = new UserService();
