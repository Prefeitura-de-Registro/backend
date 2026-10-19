export type CategoriaSla = {
  tempoPrimeiraRespostaMinutos: number;
  tempoMaximoResolucaoMinutos: number;
  tempoMinimoResolucaoMinutos: number;
  tempoResolucaoUrgenteMinutos: number;
};

export type PerguntaSla = {
  id: number;
  reducaoMinutos: number;
  critica: boolean;
};

export type ResultadoSla = {
  prioridade: 'normal' | 'urgente';
  prazoPrimeiraRespostaMinutos: number;
  prazoResolucaoMinutos: number;
};

/**
 * Cálculo do SLA na criação do ticket (documentação do banco, seção 6):
 * 1) qualquer pergunta crítica respondida "sim" -> urgente + prazo urgente da categoria;
 * 2) senão, prazo = max(máximo - soma das reduções "sim", mínimo);
 * 3) primeira resposta é sempre copiada da categoria.
 */
export function calcularSla(
  categoria: CategoriaSla,
  perguntas: PerguntaSla[],
  respostasSim: Set<number>,
): ResultadoSla {
  const prazoPrimeiraRespostaMinutos = categoria.tempoPrimeiraRespostaMinutos;
  const respondidasSim = perguntas.filter((pergunta) =>
    respostasSim.has(pergunta.id),
  );

  if (respondidasSim.some((pergunta) => pergunta.critica)) {
    return {
      prioridade: 'urgente',
      prazoPrimeiraRespostaMinutos,
      prazoResolucaoMinutos: categoria.tempoResolucaoUrgenteMinutos,
    };
  }

  const reducoes = respondidasSim.reduce(
    (soma, pergunta) => soma + Math.max(pergunta.reducaoMinutos, 0),
    0,
  );

  return {
    prioridade: 'normal',
    prazoPrimeiraRespostaMinutos,
    prazoResolucaoMinutos: Math.max(
      categoria.tempoMaximoResolucaoMinutos - reducoes,
      categoria.tempoMinimoResolucaoMinutos,
    ),
  };
}
