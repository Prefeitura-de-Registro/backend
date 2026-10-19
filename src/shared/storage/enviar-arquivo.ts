import { access } from 'node:fs/promises';
import type { Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { mimePorExtensao } from '../utils/image.js';
import { resolverCaminho } from './storage.js';

/**
 * Entrega a mídia gravada em disco (com suporte a Range para vídeo). O caminho
 * lógico vem do banco e é validado para nunca sair da pasta de uploads.
 */
export async function enviarArquivo(
  response: Response,
  caminhoLogico: string,
): Promise<void> {
  const absoluto = resolverCaminho(caminhoLogico);

  if (!absoluto) {
    throw new AppError('Arquivo não encontrado', 404);
  }

  try {
    await access(absoluto);
  } catch {
    // registro existe no banco (ex.: seed), mas o arquivo não está no disco
    throw new AppError('Arquivo não encontrado', 404);
  }

  await new Promise<void>((resolve, reject) => {
    response.sendFile(
      absoluto,
      {
        headers: {
          'Content-Type': mimePorExtensao(caminhoLogico),
          'Content-Disposition': 'inline',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=3600',
        },
      },
      (erro) => (erro ? reject(erro) : resolve()),
    );
  });
}
