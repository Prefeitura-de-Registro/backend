import { describe, expect, it } from 'vitest';
import { calcularSla } from './sla.rules.js';

const categoria = {
  tempoPrimeiraRespostaMinutos: 1440,
  tempoMaximoResolucaoMinutos: 10080,
  tempoMinimoResolucaoMinutos: 720,
  tempoResolucaoUrgenteMinutos: 1440,
};

const perguntas = [
  { id: 1, reducaoMinutos: 0, critica: true },
  { id: 2, reducaoMinutos: 2880, critica: false },
  { id: 3, reducaoMinutos: 20000, critica: false },
];

describe('calcularSla', () => {
  it('marca o ticket como urgente quando uma resposta crítica é positiva', () => {
    expect(calcularSla(categoria, perguntas, new Set([1]))).toEqual({
      prioridade: 'urgente',
      prazoPrimeiraRespostaMinutos: 1440,
      prazoResolucaoMinutos: 1440,
    });
  });

  it('reduz o prazo normal de acordo com as respostas positivas', () => {
    expect(calcularSla(categoria, perguntas, new Set([2]))).toEqual({
      prioridade: 'normal',
      prazoPrimeiraRespostaMinutos: 1440,
      prazoResolucaoMinutos: 7200,
    });
  });

  it('não reduz o prazo abaixo do mínimo da categoria', () => {
    expect(calcularSla(categoria, perguntas, new Set([3]))).toEqual({
      prioridade: 'normal',
      prazoPrimeiraRespostaMinutos: 1440,
      prazoResolucaoMinutos: 720,
    });
  });
});
