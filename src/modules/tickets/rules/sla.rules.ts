export interface CategoriaSla {
  tempoPrimeiraRespostaMinutos: number;
  tempoMaximoResolucaoMinutos: number;
  tempoMinimoResolucaoMinutos: number;
  tempoResolucaoUrgenteMinutos: number;
}

export interface PerguntaSla {
  id: number;
  reducaoMinutos: number;
  critica: boolean;
}

export function calcularSla(
  categoria: CategoriaSla,
  perguntas: PerguntaSla[],
  respostasSim: Set<number>,
) {
  const respondidasSim = perguntas.filter((pergunta) =>
    respostasSim.has(pergunta.id),
  );

  if (respondidasSim.some((pergunta) => pergunta.critica)) {
    return {
      prioridade: 'urgente' as const,
      prazoPrimeiraRespostaMinutos: categoria.tempoPrimeiraRespostaMinutos,
      prazoResolucaoMinutos: categoria.tempoResolucaoUrgenteMinutos,
    };
  }

  const reducaoTotal = respondidasSim.reduce(
    (total, pergunta) => total + Math.max(pergunta.reducaoMinutos, 0),
    0,
  );

  return {
    prioridade: 'normal' as const,
    prazoPrimeiraRespostaMinutos: categoria.tempoPrimeiraRespostaMinutos,
    prazoResolucaoMinutos: Math.max(
      categoria.tempoMaximoResolucaoMinutos - reducaoTotal,
      categoria.tempoMinimoResolucaoMinutos,
    ),
  };
}
