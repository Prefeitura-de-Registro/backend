import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import {
  getUploadTmp,
  limparTemporarios,
  MAX_TAMANHO_ARQUIVO_BYTES,
} from '../storage/storage.js';

export const MAX_ARQUIVOS_POR_ENVIO = 10;

const MIMES_ACEITOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

// Em disco (e não em memória): vídeos de até 30 MB x vários arquivos
// estourariam a memória do servidor.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      const pasta = getUploadTmp();
      mkdirSync(pasta, { recursive: true });
      callback(null, pasta);
    },
    filename: (_request, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: MAX_TAMANHO_ARQUIVO_BYTES,
    files: MAX_ARQUIVOS_POR_ENVIO,
    fields: 30,
    fieldSize: 100 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    // Filtro barato pelo mimetype informado; o tipo real é checado em salvarMidia().
    if (MIMES_ACEITOS.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        'Envie apenas imagens (JPEG, PNG, WebP) ou vídeos (MP4, MOV, WebM)',
        400,
      ),
    );
  },
});

/**
 * Aceita multipart/form-data com até 10 arquivos (imagem ou vídeo, 30 MB cada)
 * no campo `campo` (ex.: "fotos" ou "imagens"). Requisições JSON normais passam
 * direto, sem arquivos. Os temporários que sobrarem são apagados ao fim da
 * requisição, qualquer que seja o resultado.
 */
export function uploadImagens(campo: string) {
  const middleware = upload.array(campo, MAX_ARQUIVOS_POR_ENVIO);

  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.is('multipart/form-data')) {
      next();
      return;
    }

    response.on('close', () => {
      void limparTemporarios(arquivosDaRequisicao(request).map((f) => f.path));
    });

    middleware(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const mensagens: Record<string, string> = {
          LIMIT_FILE_SIZE: 'Cada arquivo pode ter no máximo 30 MB',
          LIMIT_FILE_COUNT: `Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos`,
          LIMIT_UNEXPECTED_FILE: `Campo de arquivo inválido: use "${campo}"`,
        };
        next(new AppError(mensagens[error.code] ?? 'Falha no upload', 400));
        return;
      }
      next(error);
    });
  };
}

export function arquivosDaRequisicao(request: Request): Express.Multer.File[] {
  return Array.isArray(request.files) ? request.files : [];
}
