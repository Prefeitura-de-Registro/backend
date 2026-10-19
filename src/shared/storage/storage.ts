import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/app-error.js';
import { detectarTipoMidia } from '../utils/image.js';

/**
 * Armazenamento em disco local (MVP). Para trocar por S3/MinIO depois, basta
 * reimplementar estas funções: o resto do código só conhece o `path` lógico
 * (ex.: /uploads/tickets/12/<uuid>.jpg) guardado em `arquivos.path`.
 */

const PREFIXO_LOGICO = '/uploads';

export const MAX_TAMANHO_ARQUIVO_BYTES = 30 * 1024 * 1024; // 30 MB (limite exibido no app)

export function getUploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

/** Pasta temporária onde o multer grava o upload antes da validação. */
export function getUploadTmp(): string {
  return path.join(getUploadRoot(), '.tmp');
}

/** Arquivo recebido pelo multer (já gravado em disco temporário). */
export type ArquivoRecebido = { path: string; originalname: string };

export type ArquivoSalvo = {
  path: string;
  tipoMime: string;
  tipo: 'imagem' | 'video';
};

async function lerCabecalho(caminho: string): Promise<Buffer> {
  const arquivo = await open(caminho, 'r');

  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await arquivo.read(buffer, 0, 32, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await arquivo.close();
  }
}

/**
 * Valida o conteúdo REAL (bytes) e move o arquivo para a pasta definitiva com
 * nome gerado pelo servidor (o nome enviado pelo cliente é ignorado).
 * `subpasta` ex.: `tickets/12` ou `solicitacoes/3/mensagens/7`.
 */
export async function salvarMidia(
  arquivo: ArquivoRecebido,
  subpasta: string,
): Promise<ArquivoSalvo> {
  const tipo = detectarTipoMidia(await lerCabecalho(arquivo.path));

  if (!tipo) {
    throw new AppError(
      'Arquivo inválido: envie imagens (JPEG, PNG, WebP) ou vídeos (MP4, MOV, WebM)',
      400,
    );
  }

  if ((await stat(arquivo.path)).size > MAX_TAMANHO_ARQUIVO_BYTES) {
    throw new AppError('Cada arquivo pode ter no máximo 30 MB', 400);
  }

  const nome = `${randomUUID()}.${tipo.extensao}`;
  const destino = path.join(getUploadRoot(), subpasta, nome);

  await mkdir(path.dirname(destino), { recursive: true });

  try {
    await rename(arquivo.path, destino);
  } catch {
    // tmp e destino em dispositivos diferentes
    await copyFile(arquivo.path, destino);
    await unlink(arquivo.path).catch(() => undefined);
  }

  return {
    path: `${PREFIXO_LOGICO}/${subpasta}/${nome}`,
    tipoMime: tipo.mime,
    tipo: tipo.tipo,
  };
}

export async function removerArquivos(
  caminhosLogicos: string[],
): Promise<void> {
  await Promise.all(
    caminhosLogicos.map(async (caminho) => {
      const absoluto = resolverCaminho(caminho);
      if (absoluto) {
        await unlink(absoluto).catch(() => undefined);
      }
    }),
  );
}

/** Apaga os temporários do multer (sobras de requisições recusadas ou com erro). */
export async function limparTemporarios(caminhos: string[]): Promise<void> {
  await Promise.all(
    caminhos.map((caminho) => unlink(caminho).catch(() => undefined)),
  );
}

/**
 * Converte o path lógico do banco em caminho absoluto, garantindo que ele
 * fique DENTRO da pasta de uploads (bloqueia ../ e caminhos absolutos).
 */
export function resolverCaminho(caminhoLogico: string): string | null {
  if (!caminhoLogico.startsWith(`${PREFIXO_LOGICO}/`)) {
    return null;
  }

  const root = getUploadRoot();
  const absoluto = path.resolve(
    root,
    caminhoLogico.slice(PREFIXO_LOGICO.length + 1),
  );

  return absoluto.startsWith(root + path.sep) ? absoluto : null;
}
