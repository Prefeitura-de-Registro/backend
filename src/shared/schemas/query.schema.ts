import { z } from 'zod';

// Helpers genéricos para parâmetros de query string (não conhecem nenhuma entidade)

// Sem isso, '?lat=' vira 0 no z.coerce.number, que é uma coordenada válida no oceano
export const vazioParaUndefined = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

// Aceita ?status=aberto,pendente e ?status=aberto&status=pendente
export const listaDaQuery = (valor: unknown) => {
  if (valor === undefined || valor === '') return undefined;
  const itens = Array.isArray(valor) ? valor : [valor];
  return itens
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

// Id opcional vindo da query (?idDepartamento=3). '?idDepartamento=' é tratado como ausente.
export const idOpcionalSchema = z.preprocess(
  vazioParaUndefined,
  z.coerce.number().int().positive().optional(),
);