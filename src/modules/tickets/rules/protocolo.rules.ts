/**
 * Normaliza o protocolo digitado pelo munícipe para o formato do banco
 * (REG-AAAA-NNNNNN). Aceita "REG-2026-000001", "#REG-2026-000001",
 * "2026-00001" e "2026-1" (como o app mostra e o usuário costuma digitar).
 * Devolve null se o texto não parece um protocolo (ex.: é um token).
 */
export function normalizarProtocolo(entrada: string): string | null {
  const texto = entrada.trim().replace(/^#/, '').toUpperCase();
  const partes = /^(?:REG-)?(\d{4})-(\d{1,6})$/.exec(texto);

  if (!partes) {
    return null;
  }

  return `REG-${partes[1]}-${partes[2].padStart(6, '0')}`;
}
