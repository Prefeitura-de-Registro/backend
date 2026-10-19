/**
 * Utilitários de CPF. O CPF é guardado só com dígitos (VARCHAR(11)) e,
 * por LGPD, nunca é devolvido completo em listagens nem escrito em logs.
 */

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function validarCpf(valor: string): boolean {
  const cpf = somenteDigitos(valor);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

/** 12345678909 -> ***.456.789-** */
export function mascararCpf(cpf: string | null | undefined): string | null {
  if (!cpf || cpf.length !== 11) {
    return null;
  }
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
