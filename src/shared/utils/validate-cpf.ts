/**
 * - Valida formatos de CPF
 * - Aceita string com ou sem pontuação
 * - Retorno booleano
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;

    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }

    const remainder = (sum * 10) % 11;

    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(9);
  const secondDigit = calculateDigit(10);

  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
}
