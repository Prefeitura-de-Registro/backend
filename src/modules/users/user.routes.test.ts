import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  departamento: { count: vi.fn(), findMany: vi.fn() },
  usuarioDepartamento: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const hashMock = vi.hoisted(() => ({
  hashPassword: vi.fn(async () => 'hash'),
  comparePassword: vi.fn(async () => true),
}));

vi.mock('../../shared/database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../shared/utils/hash.js', () => hashMock);

import { app } from '../../app.js';

// ---------------------------------------------------------------------------
// "Banco" em memória: o authMiddleware busca o usuário do token por id
// (findUnique), então cada tipo de usuário tem um id fixo.
// ---------------------------------------------------------------------------

const ID_POR_TIPO: Record<string, number> = { municipe: 11, funcionario: 12, gestor: 13 };

type UsuarioFake = {
  id: number;
  email: string | null;
  name: string | null;
  tipoUsuario: string;
  ativo: boolean;
  reservado?: boolean;
  passwordHash?: string | null;
};

let usuariosNoBanco: Map<number, UsuarioFake>;

function popularBanco() {
  usuariosNoBanco = new Map<number, UsuarioFake>([
    // linha reservada do usuário anônimo
    [1, { id: 1, email: null, name: null, tipoUsuario: 'municipe', ativo: true, reservado: true, passwordHash: null }],
    // usuário comum que o gestor administra nos testes
    [7, { id: 7, email: 'a@teste.com', name: 'Alvo', tipoUsuario: 'municipe', ativo: true, reservado: false, passwordHash: 'hash-atual' }],
  ]);

  for (const [tipoUsuario, id] of Object.entries(ID_POR_TIPO)) {
    usuariosNoBanco.set(id, {
      id,
      email: `${tipoUsuario}@teste.com`,
      name: 'Teste',
      tipoUsuario,
      ativo: true,
      reservado: false,
      passwordHash: 'hash-atual',
    });
  }
}

function tokenFor(tipoUsuario: string, id = ID_POR_TIPO[tipoUsuario]) {
  return jwt.sign(
    { id, email: `${tipoUsuario}@teste.com`, name: 'Teste', tipoUsuario },
    process.env.JWT_SECRET as string,
  );
}

const auth = (tipo: string) => ({ Authorization: `Bearer ${tokenFor(tipo)}` });

const novoUsuario = {
  nome: 'Fulano de Tal',
  email: 'fulano@teste.com',
  senha: 'senha-segura-123',
};

const novoFuncionario = {
  ...novoUsuario,
  departamentoIds: [1],
  status: true,
};

function criadoComo(tipoUsuario: string) {
  return {
    id: 99,
    name: novoUsuario.nome,
    email: novoUsuario.email,
    tipoUsuario,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  popularBanco();

  prismaMock.user.findUnique.mockImplementation(
    async ({ where }: { where: { id: number } }) => usuariosNoBanco.get(where.id) ?? null,
  );
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.user.create.mockImplementation(
    async ({ data }: { data: { tipoUsuario: string } }) => criadoComo(data.tipoUsuario),
  );
  prismaMock.user.update.mockImplementation(
    async ({ data }: { data: { tipoUsuario?: string } }) =>
      criadoComo(data.tipoUsuario ?? 'municipe'),
  );
  prismaMock.departamento.findMany.mockResolvedValue([{ id: 1 }]);
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  hashMock.comparePassword.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------

describe('POST /api/user/register (cadastro público)', () => {
  it('cria munícipe quando tipoUsuario não é enviado', async () => {
    const res = await request(app).post('/api/user/register').send(novoUsuario);

    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo_usuario).toBe('municipe');
    expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe('municipe');
  });

  it.each(['funcionario', 'gestor', 'anonimo'])(
    'ignora tipoUsuario "%s" enviado pelo cliente e cria munícipe',
    async (tipoUsuario) => {
      const res = await request(app)
        .post('/api/user/register')
        .send({ ...novoUsuario, tipoUsuario });

      expect(res.status).toBe(201);
      expect(res.body.usuario.tipo_usuario).toBe('municipe');
      expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe('municipe');

      const payload = jwt.decode(res.body.token) as { tipoUsuario: string };
      expect(payload.tipoUsuario).toBe('municipe');
    },
  );

  it.each(['funcionario', 'gestor'])(
    'não reativa conta inativa de %s (409)',
    async (tipoUsuario) => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 5,
        email: novoUsuario.email,
        ativo: false,
        tipoUsuario,
      });

      const res = await request(app).post('/api/user/register').send(novoUsuario);

      expect(res.status).toBe(409);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    },
  );

  it('reativa conta inativa de munícipe como munícipe', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 5,
      email: novoUsuario.email,
      ativo: false,
      tipoUsuario: 'municipe',
    });

    const res = await request(app)
      .post('/api/user/register')
      .send({ ...novoUsuario, tipoUsuario: 'funcionario' });

    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo_usuario).toBe('municipe');
    expect(prismaMock.user.update.mock.calls[0][0].data.tipoUsuario).toBe('municipe');
  });

  it('retorna 409 quando o e-mail já está em uso por conta ativa', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 5, ativo: true, tipoUsuario: 'municipe' });

    const res = await request(app).post('/api/user/register').send(novoUsuario);

    expect(res.status).toBe(409);
  });
});

describe('autenticação', () => {
  it('GET /me sem token devolve o usuário anônimo', async () => {
    const res = await request(app).get('/api/user/me');

    expect(res.status).toBe(200);
    expect(res.body.tipoUsuario).toBe('anonimo');
  });

  it('401 com header Authorization malformado', async () => {
    const res = await request(app).get('/api/user/me').set({ Authorization: 'Token abc' });

    expect(res.status).toBe(401);
  });

  it('401 com token de usuário desativado', async () => {
    usuariosNoBanco.get(ID_POR_TIPO.gestor)!.ativo = false;

    const res = await request(app).get('/api/user').set(auth('gestor'));

    expect(res.status).toBe(401);
  });

  it('usa o tipo do banco, não o do token (gestor rebaixado perde acesso)', async () => {
    usuariosNoBanco.get(ID_POR_TIPO.gestor)!.tipoUsuario = 'funcionario';

    const res = await request(app).get('/api/user').set(auth('gestor'));

    expect(res.status).toBe(403);
  });
});

describe('POST /api/user (cadastro de funcionário, somente gestor)', () => {
  it('401 sem token', async () => {
    const res = await request(app).post('/api/user').send(novoFuncionario);

    expect(res.status).toBe(401);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it.each(['municipe', 'funcionario'])('403 para %s', async (tipo) => {
    const res = await request(app).post('/api/user').set(auth(tipo)).send(novoFuncionario);

    expect(res.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('201 para gestor: cria funcionário vinculado aos departamentos, sem token', async () => {
    const res = await request(app).post('/api/user').set(auth('gestor')).send(novoFuncionario);

    expect(res.status).toBe(201);
    expect(res.body.tipoUsuario).toBe('funcionario');
    expect(res.body.token).toBeUndefined();

    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data.tipoUsuario).toBe('funcionario');
    expect(data.ativo).toBe(true);
    expect(data.usuarioDepartamentos.createMany.data).toEqual([{ idDepartamento: 1 }]);
  });

  // Regra atual: o gestor pode definir o tipo (inclusive gestor). Pendente de validação do squad.
  it('respeita o tipoUsuario informado pelo gestor', async () => {
    const res = await request(app)
      .post('/api/user')
      .set(auth('gestor'))
      .send({ ...novoFuncionario, tipoUsuario: 'gestor' });

    expect(res.status).toBe(201);
    expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe('gestor');
  });

  it('400 para departamento inexistente ou inativo', async () => {
    prismaMock.departamento.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/user')
      .set(auth('gestor'))
      .send({ ...novoFuncionario, departamentoIds: [42] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('42');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('409 quando o e-mail já pertence a uma conta ativa', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 5, ativo: true, tipoUsuario: 'funcionario' });

    const res = await request(app).post('/api/user').set(auth('gestor')).send(novoFuncionario);

    expect(res.status).toBe(409);
  });

  it('reativa conta inativa substituindo os departamentos', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 5, ativo: false, tipoUsuario: 'funcionario' });

    const res = await request(app).post('/api/user').set(auth('gestor')).send(novoFuncionario);

    expect(res.status).toBe(201);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    const { where, data } = prismaMock.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 5 });
    expect(data.usuarioDepartamentos.deleteMany).toEqual({});
    expect(data.usuarioDepartamentos.createMany.data).toEqual([{ idDepartamento: 1 }]);
  });

  it('400 para dados inválidos', async () => {
    const res = await request(app)
      .post('/api/user')
      .set(auth('gestor'))
      .send({ nome: 'a', email: 'x', senha: '1' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/user (listagem de funcionários, somente gestor)', () => {
  it('403 para funcionário', async () => {
    const res = await request(app).get('/api/user').set(auth('funcionario'));

    expect(res.status).toBe(403);
  });

  it('200 para gestor, com departamentos e total de tickets formatados', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 20,
        name: 'Func Vias',
        ativo: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        usuarioDepartamentos: [{ departamento: { id: 1, nome: 'Vias', sigla: 'VIAS' } }],
        _count: { ticketsResponsaveis: 3 },
      },
    ]);
    prismaMock.user.count.mockResolvedValue(1);

    const res = await request(app).get('/api/user?page=1&limit=10').set(auth('gestor'));

    expect(res.status).toBe(200);
    expect(res.body.data[0].departamentos).toEqual([{ id: 1, nome: 'Vias', sigla: 'VIAS' }]);
    expect(res.body.data[0].totalTickets).toBe(3);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(prismaMock.user.findMany.mock.calls[0][0].where.tipoUsuario).toBe('funcionario');
  });

  it('400 para busca com menos de 3 caracteres', async () => {
    const res = await request(app).get('/api/user?busca=ab').set(auth('gestor'));

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/user/me (edição dos próprios dados)', () => {
  it('401 sem token', async () => {
    const res = await request(app).patch('/api/user/me').send({ nome: 'Novo Nome' });

    expect(res.status).toBe(401);
  });

  it('200 para munícipe alterando o nome; tipoUsuario enviado é ignorado', async () => {
    const res = await request(app)
      .patch('/api/user/me')
      .set(auth('municipe'))
      .send({ nome: 'Novo Nome', tipoUsuario: 'gestor' });

    expect(res.status).toBe(200);

    const { where, data } = prismaMock.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: ID_POR_TIPO.municipe });
    expect(data.name).toBe('Novo Nome');
    expect(data.tipoUsuario).toBeUndefined();
  });

  it('400 ao trocar a senha sem informar a senha atual', async () => {
    const res = await request(app)
      .patch('/api/user/me')
      .set(auth('municipe'))
      .send({ senha: 'nova-senha-123' });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('400 quando a senha atual está incorreta', async () => {
    hashMock.comparePassword.mockResolvedValue(false);

    const res = await request(app)
      .patch('/api/user/me')
      .set(auth('municipe'))
      .send({ senhaAtual: 'errada', senha: 'nova-senha-123' });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('200 ao trocar a senha com a senha atual correta', async () => {
    const res = await request(app)
      .patch('/api/user/me')
      .set(auth('funcionario'))
      .send({ senhaAtual: 'senha-atual', senha: 'nova-senha-123' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update.mock.calls[0][0].data.passwordHash).toBe('hash');
  });
});

describe('gestão de usuários (PATCH / DELETE / PUT departamentos)', () => {
  const rotas = [
    {
      nome: 'PATCH /:id',
      chamar: (id: number, headers: Record<string, string>) =>
        request(app).patch(`/api/user/${id}`).set(headers).send({ tipoUsuario: 'funcionario' }),
    },
    {
      nome: 'DELETE /:id',
      chamar: (id: number, headers: Record<string, string>) =>
        request(app).delete(`/api/user/${id}`).set(headers),
    },
    {
      nome: 'PUT /:id/departamentos',
      chamar: (id: number, headers: Record<string, string>) =>
        request(app).put(`/api/user/${id}/departamentos`).set(headers).send({ departamentoIds: [] }),
    },
  ];

  describe.each(rotas)('$nome', ({ chamar }) => {
    it('401 sem token', async () => {
      expect((await chamar(7, {})).status).toBe(401);
    });

    it.each(['municipe', 'funcionario'])('403 para %s', async (tipo) => {
      const res = await chamar(7, auth(tipo));

      expect(res.status).toBe(403);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('403 no usuário reservado (id 1), mesmo para gestor', async () => {
      const res = await chamar(1, auth('gestor'));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Este usuário é reservado pelo sistema');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.usuarioDepartamento.deleteMany).not.toHaveBeenCalled();
    });
  });

  it('PATCH /:id permite que o gestor promova um munícipe a funcionário', async () => {
    const res = await request(app)
      .patch('/api/user/7')
      .set(auth('gestor'))
      .send({ tipoUsuario: 'funcionario' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update.mock.calls[0][0].data.tipoUsuario).toBe('funcionario');
  });
});