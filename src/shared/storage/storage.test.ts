import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { removerArquivos, resolverCaminho, salvarMidia } from './storage.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypisom'),
  Buffer.alloc(16),
]);
let pasta: string;

async function tmp(conteudo: Buffer): Promise<string> {
  const arquivo = path.join(pasta, `up-${Math.random().toString(36).slice(2)}`);
  await writeFile(arquivo, conteudo);
  return arquivo;
}

beforeAll(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'uploads-'));
  process.env.UPLOAD_DIR = pasta;
});

afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

describe('storage', () => {
  it('salva com nome gerado pelo servidor, ignorando o nome do cliente', async () => {
    const origem = await tmp(PNG);
    const salvo = await salvarMidia(
      { path: origem, originalname: '../../etc/passwd.png' },
      'tickets/1',
    );

    expect(salvo.path).toMatch(/^\/uploads\/tickets\/1\/[0-9a-f-]{36}\.png$/);
    expect(salvo.path).not.toContain('passwd');
    expect(salvo.tipo).toBe('imagem');

    const absoluto = resolverCaminho(salvo.path)!;
    expect(absoluto.startsWith(pasta)).toBe(true);
    expect((await readFile(absoluto)).equals(PNG)).toBe(true);
    // o temporário foi movido (não sobra cópia)
    await expect(stat(origem)).rejects.toThrow();

    await removerArquivos([salvo.path]);
    await expect(readFile(absoluto)).rejects.toThrow();
  });

  it('aceita vídeo MP4 e identifica como vídeo', async () => {
    const salvo = await salvarMidia(
      { path: await tmp(MP4), originalname: 'v.mp4' },
      'tickets/2',
    );

    expect(salvo.tipo).toBe('video');
    expect(salvo.tipoMime).toBe('video/mp4');
    expect(salvo.path).toMatch(/\.mp4$/);
  });

  it('recusa conteúdo que não é imagem nem vídeo', async () => {
    await expect(
      salvarMidia(
        {
          path: await tmp(Buffer.from('<?php echo 1;')),
          originalname: 'a.png',
        },
        'x',
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('bloqueia path traversal e caminhos fora de /uploads', () => {
    expect(resolverCaminho('/uploads/../../etc/passwd')).toBeNull();
    expect(resolverCaminho('/etc/passwd')).toBeNull();
    expect(resolverCaminho('/uploads/../secret')).toBeNull();
  });
});
