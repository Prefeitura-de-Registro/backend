import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  categoria: { findMany: vi.fn(), findFirst: vi.fn() },
  pergunta: { findMany: vi.fn() },
  ticket: { findUnique: vi.fn(), findFirst: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('../shared/database/prisma.js', () => ({ prisma: prismaMock }));

import { app } from '../app.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rotas públicas (sem login)', () => {
  it('GET /api/categorias só consulta categorias ativas de departamentos ativos', async () => {
    prismaMock.categoria.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/categorias');

    expect(res.status).toBe(200);
    expect(prismaMock.categoria.findMany.mock.calls[0][0].where).toEqual({
      ativo: true,
      departamento: { ativo: true },
    });
  });

  it('GET /api/categorias/:id/perguntas seleciona só id, enunciado e ordem', async () => {
    prismaMock.categoria.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.pergunta.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/categorias/1/perguntas');

    expect(res.status).toBe(200);
    expect(prismaMock.pergunta.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      enunciado: true,
      ordem: true,
    });
  });

  it('GET /api/categorias/:id/perguntas 404 para categoria inativa/inexistente', async () => {
    prismaMock.categoria.findFirst.mockResolvedValue(null);

    expect((await request(app).get('/api/categorias/9/perguntas')).status).toBe(
      404,
    );
  });

  it('GET /api/tickets/acompanhar/:token funciona sem Authorization e 404 se não existir', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app).get(
      `/api/tickets/acompanhar/${'a'.repeat(32)}`,
    );

    expect(res.status).toBe(404);
    expect(prismaMock.ticket.findUnique.mock.calls[0][0].where).toEqual({
      tokenAcesso: 'a'.repeat(32),
    });
  });

  it('GET /api/tickets/acompanhar/:codigo aceita o protocolo como o app mostra (#2026-00001)', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/tickets/acompanhar/%232026-00001');

    expect(res.status).toBe(404);
    expect(prismaMock.ticket.findUnique.mock.calls[0][0].where).toEqual({
      protocolo: 'REG-2026-000001',
    });
  });

  it('GET /api/tickets/acompanhar/:codigo por protocolo NÃO devolve endereço nem localização', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 7,
      protocolo: 'REG-2026-000007',
      status: 'aberto',
      prioridade: 'normal',
      descricao: 'Buraco',
      endereco: 'Rua A, 10',
      pontoReferencia: 'Padaria',
      prazoPrimeiraRespostaMinutos: 60,
      prazoResolucaoMinutos: 120,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      categoria: { id: 1, nome: 'Buraco' },
      departamento: { id: 1, nome: 'Vias', sigla: 'VIAS' },
      respostas: [
        { valor: true, pergunta: { id: 1, enunciado: 'Grande?', ordem: 1 } },
      ],
      arquivos: [
        {
          id: 9,
          tipo: 'video_abertura',
          path: '/uploads/tickets/7/x.mp4',
          createdAt: new Date(),
        },
      ],
      historicos: [],
    });

    const res = await request(app).get(
      '/api/tickets/acompanhar/REG-2026-000007',
    );

    expect(res.status).toBe(200);
    expect(res.body.endereco).toBeUndefined();
    expect(res.body.pontoReferencia).toBeUndefined();
    expect(res.body.localizacao).toBeUndefined();
    expect(res.body.descricao).toBe('Buraco');
    expect(res.body.respostas[0].pergunta.enunciado).toBe('Grande?');
    expect(res.body.arquivos[0]).toMatchObject({
      id: 9,
      mime: 'video/mp4',
      url: '/api/tickets/acompanhar/REG-2026-000007/arquivos/9',
    });
    expect(res.body.arquivos[0].path).toBeUndefined();
  });

  it('GET /api/tickets/acompanhar/:codigo/arquivos/:id 404 se o arquivo não é do chamado', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 7,
      arquivos: [],
    });

    const res = await request(app).get(
      '/api/tickets/acompanhar/REG-2026-000007/arquivos/99',
    );

    expect(res.status).toBe(404);
  });

  it('GET /api/tickets/acompanhar/:codigo 400 para código com caracteres inválidos', async () => {
    const res = await request(app).get('/api/tickets/acompanhar/a%20b!');

    expect(res.status).toBe(400);
    expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
  });

  it.each(['/api/tickets/meus', '/api/tickets/meus/1', '/api/arquivos/1'])(
    '401 sem login em %s',
    async (rota) => {
      expect((await request(app).get(rota)).status).toBe(401);
    },
  );

  it.each([
    '/api/departamentos',
    '/api/notificacoes',
    '/api/solicitacoes',
    '/api/solicitacoes/1',
    '/api/solicitacoes/1/mensagens',
  ])('401 sem login em %s (rota operacional)', async (rota) => {
    expect((await request(app).get(rota)).status).toBe(401);
  });

  it('POST /api/tickets valida o corpo (categoria obrigatória)', async () => {
    const res = await request(app).post('/api/tickets').send({});

    expect(res.status).toBe(400);
  });
});
