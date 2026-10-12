import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  departamento: { count: vi.fn() },
  usuarioDepartamento: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../../shared/database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../shared/utils/hash.js', () => ({
  hashPassword: vi.fn(async () => 'hash'),
  comparePassword: vi.fn(async () => true),
}));

import { app } from '../../app.js';

function tokenFor(tipoUsuario: string, id = 10) {
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
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.user.create.mockImplementation(
    async ({ data }: { data: { tipoUsuario: string } }) =>
      criadoComo(data.tipoUsuario),
  );
  prismaMock.user.update.mockImplementation(
    async ({ data }: { data: { tipoUsuario?: string } }) =>
      criadoComo(data.tipoUsuario ?? 'municipe'),
  );
});

describe('POST /api/user/register (cadastro público)', () => {
  it('cria munícipe quando tipoUsuario não é enviado', async () => {
    const res = await request(app).post('/api/user/register').send(novoUsuario);

    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo_usuario).toBe('municipe');
    expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe(
      'municipe',
    );
  });

  it.each(['funcionario', 'gestor', 'anonimo'])(
    'ignora tipoUsuario "%s" enviado pelo cliente e cria munícipe',
    async (tipoUsuario) => {
      const res = await request(app)
        .post('/api/user/register')
        .send({ ...novoUsuario, tipoUsuario });

      expect(res.status).toBe(201);
      expect(res.body.usuario.tipo_usuario).toBe('municipe');
      expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe(
        'municipe',
      );

      const payload = jwt.decode(res.body.token) as { tipoUsuario: string };
      expect(payload.tipoUsuario).toBe('municipe');
    },
  );

  it('não reativa/rebaixa conta inativa de funcionário (409)', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 5,
      email: novoUsuario.email,
      ativo: false,
      tipoUsuario: 'funcionario',
    });

    const res = await request(app).post('/api/user/register').send(novoUsuario);

    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

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
    expect(prismaMock.user.update.mock.calls[0][0].data.tipoUsuario).toBe(
      'municipe',
    );
  });

  it('retorna 409 quando o e-mail já está em uso por conta ativa', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 5,
      ativo: true,
      tipoUsuario: 'municipe',
    });

    const res = await request(app).post('/api/user/register').send(novoUsuario);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/user/funcionarios (somente gestor)', () => {
  it('401 sem token', async () => {
    const res = await request(app)
      .post('/api/user/funcionarios')
      .send(novoUsuario);

    expect(res.status).toBe(401);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it.each(['municipe', 'funcionario'])('403 para %s', async (tipo) => {
    const res = await request(app)
      .post('/api/user/funcionarios')
      .set(auth(tipo))
      .send(novoUsuario);

    expect(res.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('201 para gestor: cria funcionário e não devolve token', async () => {
    const res = await request(app)
      .post('/api/user/funcionarios')
      .set(auth('gestor'))
      .send({ ...novoUsuario, tipoUsuario: 'gestor' });

    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo_usuario).toBe('funcionario');
    expect(res.body.token).toBeUndefined();
    expect(prismaMock.user.create.mock.calls[0][0].data.tipoUsuario).toBe(
      'funcionario',
    );
  });

  it('409 para gestor quando o e-mail já pertence a uma conta ativa', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 5,
      ativo: true,
      tipoUsuario: 'funcionario',
    });

    const res = await request(app)
      .post('/api/user/funcionarios')
      .set(auth('gestor'))
      .send(novoUsuario);

    expect(res.status).toBe(409);
  });

  it('409 para gestor quando o e-mail pertence a um gestor inativo', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 5,
      ativo: false,
      tipoUsuario: 'gestor',
    });

    const res = await request(app)
      .post('/api/user/funcionarios')
      .set(auth('gestor'))
      .send(novoUsuario);

    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('400 para dados inválidos', async () => {
    const res = await request(app)
      .post('/api/user/funcionarios')
      .set(auth('gestor'))
      .send({ nome: 'a', email: 'x', senha: '1' });

    expect(res.status).toBe(400);
  });
});

describe('gestão de usuários (PATCH / DELETE / PUT departamentos)', () => {
  const rotas = [
    {
      nome: 'PATCH /:id',
      chamar: (headers: Record<string, string>) =>
        request(app)
          .patch('/api/user/7')
          .set(headers)
          .send({ tipoUsuario: 'funcionario' }),
    },
    {
      nome: 'DELETE /:id',
      chamar: (headers: Record<string, string>) =>
        request(app).delete('/api/user/7').set(headers),
    },
    {
      nome: 'PUT /:id/departamentos',
      chamar: (headers: Record<string, string>) =>
        request(app)
          .put('/api/user/7/departamentos')
          .set(headers)
          .send({ departamentoIds: [] }),
    },
  ];

  describe.each(rotas)('$nome', ({ chamar }) => {
    it('401 sem token', async () => {
      expect((await chamar({})).status).toBe(401);
    });

    it.each(['municipe', 'funcionario'])('403 para %s', async (tipo) => {
      const res = await chamar(auth(tipo));

      expect(res.status).toBe(403);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  it('PATCH /:id permite que o gestor promova um munícipe a funcionário', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 7,
      email: 'a@teste.com',
      ativo: true,
    });
    prismaMock.user.update.mockResolvedValue({
      id: 7,
      tipoUsuario: 'funcionario',
    });

    const res = await request(app)
      .patch('/api/user/7')
      .set(auth('gestor'))
      .send({ tipoUsuario: 'funcionario' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });
});
