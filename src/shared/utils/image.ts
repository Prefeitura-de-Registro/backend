export type TipoMidia = {
  mime: string;
  extensao: string;
  tipo: 'imagem' | 'video';
};

// Marcas "ftyp" de vídeo MP4/MOV. HEIC/HEIF (foto de iPhone) também usa "ftyp",
// mas com outras marcas (heic, heix, mif1...): essas NÃO são vídeo.
const MARCAS_MP4 = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'M4VH',
  'MSNV',
  'dash',
  '3gp4',
  '3gp5',
  '3gp6',
]);

/**
 * Descobre o tipo REAL do arquivo pelos primeiros bytes (magic numbers),
 * sem confiar no mimetype/nome enviados pelo cliente.
 * Aceita imagem (jpeg, png, webp) e vídeo (mp4, mov, webm).
 */
export function detectarTipoMidia(buffer: Buffer): TipoMidia | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: 'image/jpeg', extensao: 'jpg', tipo: 'imagem' };
  }

  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', extensao: 'png', tipo: 'imagem' };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', extensao: 'webp', tipo: 'imagem' };
  }

  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) {
    return { mime: 'video/webm', extensao: 'webm', tipo: 'video' };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  ) {
    const marca = buffer.subarray(8, 12).toString('latin1');

    if (marca === 'qt  ') {
      return { mime: 'video/quicktime', extensao: 'mov', tipo: 'video' };
    }

    if (MARCAS_MP4.has(marca)) {
      return { mime: 'video/mp4', extensao: 'mp4', tipo: 'video' };
    }
  }

  return null;
}

/** Só imagens (jpeg, png, webp). */
export function detectarTipoImagem(buffer: Buffer): TipoMidia | null {
  const tipo = detectarTipoMidia(buffer);
  return tipo?.tipo === 'imagem' ? tipo : null;
}

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export function mimePorExtensao(caminho: string): string {
  const extensao = caminho.split('.').pop()?.toLowerCase() ?? '';
  return MIME_POR_EXTENSAO[extensao] ?? 'application/octet-stream';
}
