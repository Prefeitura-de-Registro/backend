import { describe, expect, it } from 'vitest';
import { mascararCpf, somenteDigitos, validarCpf } from './cpf.js';
import { detectarTipoImagem, detectarTipoMidia } from './image.js';

describe('cpf', () => {
  it.each(['529.982.247-25', '52998224725', '123.456.789-09'])(
    'aceita CPF válido %s',
    (cpf) => expect(validarCpf(cpf)).toBe(true),
  );

  it.each([
    '',
    '123',
    '111.111.111-11',
    '000.000.000-00',
    '529.982.247-24', // dígito verificador errado
    'abcdefghijk',
  ])('rejeita CPF inválido "%s"', (cpf) => expect(validarCpf(cpf)).toBe(false));

  it('guarda só dígitos', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
  });

  it('mascara sem expor o CPF completo (LGPD)', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**');
    expect(mascararCpf(null)).toBeNull();
    expect(mascararCpf('123')).toBeNull();
  });
});

describe('detectarTipoImagem (pelos bytes, não pelo nome/mimetype)', () => {
  it('reconhece jpeg, png e webp', () => {
    expect(
      detectarTipoImagem(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime,
    ).toBe('image/jpeg');
    expect(
      detectarTipoImagem(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      )?.extensao,
    ).toBe('png');
    expect(
      detectarTipoImagem(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary'))?.mime,
    ).toBe('image/webp');
  });

  it('rejeita script, pdf, svg e buffer vazio mesmo que o cliente diga "image/png"', () => {
    expect(detectarTipoImagem(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(detectarTipoImagem(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(detectarTipoImagem(Buffer.from('<svg onload="x()"/>'))).toBeNull();
    expect(detectarTipoImagem(Buffer.alloc(0))).toBeNull();
  });
});

describe('detectarTipoMidia (vídeo)', () => {
  const ftyp = (marca: string) =>
    Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from(`ftyp${marca}`),
      Buffer.alloc(8),
    ]);

  it('reconhece mp4, mov e webm como vídeo', () => {
    expect(detectarTipoMidia(ftyp('isom'))).toMatchObject({
      mime: 'video/mp4',
      tipo: 'video',
    });
    expect(detectarTipoMidia(ftyp('mp42'))?.extensao).toBe('mp4');
    expect(detectarTipoMidia(ftyp('qt  '))).toMatchObject({
      mime: 'video/quicktime',
      extensao: 'mov',
    });
    expect(
      detectarTipoMidia(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0])),
    ).toMatchObject({
      mime: 'video/webm',
    });
  });

  it('HEIC/HEIF (foto de iPhone) também usa ftyp, mas NÃO é aceito como vídeo', () => {
    expect(detectarTipoMidia(ftyp('heic'))).toBeNull();
    expect(detectarTipoMidia(ftyp('mif1'))).toBeNull();
  });

  it('detectarTipoImagem não aceita vídeo', () => {
    expect(detectarTipoImagem(ftyp('isom'))).toBeNull();
  });
});
