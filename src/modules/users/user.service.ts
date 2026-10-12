import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  CreateUserDTO,
  LoginUserDTO,
  SetDepartamentosBodyDTO,
  UpdateUserBodyDTO,
  GetManyFuncionariosQueryDTO,
  CreateFuncionarioBodyDTO,
} from './dtos/user.dto.js';
import { hashPassword, comparePassword } from '../../shared/utils/hash.js';
import { getActiveDepartamentoIds } from '../../shared/authorization/department-scope.service.js';

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
  // matricula: true,
  // cargo: true,
  usuarioDepartamentos: {
    // retorna o nome dos departamentos 
    select: {
      departamento: {
        select: {
          id: true,
          nome: true,
          sigla: true
        }
      }
    }
  },
  ativo: true,
  createdAt: true,
  _count: {
    // inclui contagem dos tickets assumidos
    select: { ticketsResponsaveis: true },
  },
} satisfies Prisma.UserSelect;

// tipa retorno puro em getManyFuncionarios
type FuncionarioSelectOriginal = Prisma.UserGetPayload<{ select: typeof funcionarioSummarySelect }>

// mapeia retorno formatado em getManyFuncionarios
function toGetManyFuncionariosResponse(funcionario: FuncionarioSelectOriginal) {
  const { usuarioDepartamentos, _count, ...dados } = funcionario;
  return {
    ...dados,
    departamentos: usuarioDepartamentos.map(({ departamento }) => departamento),
    totalTickets: _count.ticketsResponsaveis
  }
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
      if (existente.ativo) {
        throw new AppError('Já existe um cadastro com esse e-mail', 409);
      }

      // Usuário tinha passado por soft delete: reativa o mesmo registro em
      // vez de criar um novo, preservando o histórico já vinculado a ele
      // (tickets, TicketHistorico, UsuarioDepartamento etc.).
      return prisma.user.update({
        where: { id: existente.id },
        data: {
          name: data.nome,
          passwordHash,
          ativo: true,
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
        // tipoUsuario: data.tipoUsuario ?? 'municipe',
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

  async update(id: number, data: UpdateUserBodyDTO) {
    const usuario = await this.findUserOrThrow(id);

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

    if (data.senha !== undefined) {
      updateData.passwordHash = await hashPassword(data.senha);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: userSummarySelect,
    });
  }

  async softDelete(id: number) {
    const usuario = await this.findUserOrThrow(id);

    if (!usuario.ativo) {
      throw new AppError('Usuário já está inativo', 409);
    }

    return prisma.user.update({
      where: { id },
      data: { ativo: false },
      select: userSummarySelect,
    });
  }

  // atualiza departamentos do funcionário
  async setDepartamentos(id: number, data: SetDepartamentosBodyDTO) {
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

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.usuarioDepartamento.deleteMany({ where: { idUsuario: id } });

      if (departamentoIds.length > 0) {
        await tx.usuarioDepartamento.createMany({
          data: departamentoIds.map((idDepartamento) => ({
            idUsuario: id,
            idDepartamento,
          })),
        });
      }

      return tx.usuarioDepartamento.findMany({
        where: { idUsuario: id },
        include: { departamento: true },
      });
    });
  }

  // consulta funcionários por nome, ou retorna todos
  async getManyFuncionarios(query: GetManyFuncionariosQueryDTO) {

    // busca APENAS funcionários
    const where: Prisma.UserWhereInput = {
      tipoUsuario: 'funcionario',
    }

    // inclui busca por nome, caso solicitado
    if (query.busca) {
      where.name = { contains: query.busca, mode: 'insensitive' }
    }

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: funcionarioSummarySelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ name: 'desc' }],
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: data.map(toGetManyFuncionariosResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      }
    }
  }

  // cadastra funcionários/gestores vinculando-os aos departamentos
  async createFuncionario(data: CreateFuncionarioBodyDTO) {
    const existente = await prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });
    const passwordHash = await hashPassword(data.senha);
    const departamentoIds = [...new Set(data.departamentoIds)];
    const ativos = await getActiveDepartamentoIds(departamentoIds);
    const invalidos = departamentoIds.filter((id) => !ativos.includes(id));
    const vinculos = departamentoIds.map((idDepartamento) => ({ idDepartamento }));


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
      return prisma.user.update({
        where: { id: existente.id },
        data: {
          name: data.nome,
          passwordHash,
          tipoUsuario: data.tipoUsuario ?? 'funcionario',
          ativo: data.status,
          usuarioDepartamentos: {
            deleteMany: {},
            createMany: { data: vinculos },
          }
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

    const funcionario = await prisma.user.create({
      data: {
        name: data.nome,
        email: data.email,
        passwordHash,
        tipoUsuario: data.tipoUsuario ?? 'funcionario',
        ativo: data.status,
        usuarioDepartamentos: {
          createMany: { data: vinculos },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        tipoUsuario: true,
        createdAt: true,
      },
    });

    return funcionario;
  }

  // helper de busca obrigatória por ID
  private async findUserOrThrow(id: number) {
    const usuario = await prisma.user.findUnique({ where: { id } });

    if (!usuario) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return usuario;
  }
}

export const userService = new UserService();