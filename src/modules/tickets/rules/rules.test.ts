import { describe, expect, it } from 'vitest';
import { normalizarProtocolo } from './protocolo.rules.js';
import { calcularSla } from './sla.rules.js';
import { statusAnteriorAoPendente } from './status-reversao.rules.js';

// Exemplo da documentação do banco (seção 6): categoria "Buraco na via"
const categoria = {
  tempoPrimeiraRespostaMinutos: 1440,
  tempoMaximoResolucaoMinutos: 10080,
  tempoMinimoResolucaoMinutos: 720,
  tempoResolucaoUrgenteMinutos: 1440,
};

const perguntas = [
  { id: 1, reducaoMinutos: 0, critica: true },
  { id: 2, reducaoMinutos: 2880, critica: false },
  { id: 3, reducaoMinutos: 1440, critica: false },
  { id: 4, reducaoMinutos: 30, critica: false },
];

describe('calcularSla', () => {
  it('sem respostas "sim": prazo máximo da categoria', () => {
    expect(calcularSla(categoria, perguntas, new Set())).toEqual({
      prioridade: 'normal',
      prazoPrimeiraRespostaMinutos: 1440,
      prazoResolucaoMinutos: 10080,
    });
  });

  it('soma as reduções (exemplo da documentação: 10080 - 2880 - 30 = 7170)', () => {
    expect(calcularSla(categoria, perguntas, new Set([2, 4]))).toMatchObject({
      prioridade: 'normal',
      prazoResolucaoMinutos: 7170,
    });
  });

  it('pergunta crítica "sim": urgente, prazo urgente e ignora as reduções', () => {
    expect(calcularSla(categoria, perguntas, new Set([1, 2, 3]))).toEqual({
      prioridade: 'urgente',
      prazoPrimeiraRespostaMinutos: 1440,
      prazoResolucaoMinutos: 1440,
    });
  });

  it('nunca fica abaixo do prazo mínimo', () => {
    const muitoReduzivel = [
      { id: 1, reducaoMinutos: 9000, critica: false },
      { id: 2, reducaoMinutos: 9000, critica: false },
    ];

    expect(
      calcularSla(categoria, muitoReduzivel, new Set([1, 2]))
        .prazoResolucaoMinutos,
    ).toBe(720);
  });

  it('pergunta crítica respondida "não" não deixa urgente', () => {
    expect(calcularSla(categoria, perguntas, new Set([3])).prioridade).toBe(
      'normal',
    );
  });
});

describe('statusAnteriorAoPendente', () => {
  it('volta ao status de antes do pendente', () => {
    expect(
      statusAnteriorAoPendente(['pendente', 'em_andamento', 'aberto']),
    ).toBe('em_andamento');
  });

  it('ignora vários pendentes seguidos', () => {
    expect(
      statusAnteriorAoPendente([
        'pendente',
        'pendente',
        'em_analise',
        'aberto',
      ]),
    ).toBe('em_analise');
  });

  it('não reverte se o funcionário já mudou o status depois do pendente', () => {
    expect(
      statusAnteriorAoPendente(['em_andamento', 'pendente', 'aberto']),
    ).toBeNull();
  });

  it('sem status anterior (ticket nasceu pendente): volta para aberto', () => {
    expect(statusAnteriorAoPendente(['pendente'])).toBe('aberto');
  });

  it('histórico vazio: nada a reverter', () => {
    expect(statusAnteriorAoPendente([])).toBeNull();
  });
});

describe('normalizarProtocolo', () => {
  it.each([
    ['REG-2026-000001', 'REG-2026-000001'],
    ['reg-2026-000001', 'REG-2026-000001'],
    ['#REG-2026-000042', 'REG-2026-000042'],
    ['2026-00001', 'REG-2026-000001'],
    ['#2026-00001', 'REG-2026-000001'],
    ['  2026-1 ', 'REG-2026-000001'],
  ])('"%s" -> %s', (entrada, esperado) => {
    expect(normalizarProtocolo(entrada)).toBe(esperado);
  });

  it('não confunde token com protocolo', () => {
    expect(normalizarProtocolo('a'.repeat(32))).toBeNull();
    expect(normalizarProtocolo('3f2a9c1be0d44e7f8a6b5c4d3e2f1a0b')).toBeNull();
    expect(normalizarProtocolo('REG-26-1')).toBeNull();
    expect(normalizarProtocolo('')).toBeNull();
  });
});
