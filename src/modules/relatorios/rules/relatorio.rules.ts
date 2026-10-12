import type { StatusGeral } from '../types/relatorio.types.js';

// Faixas pelo % de tickets resolvidos dentro do prazo.
// Os valores devem ser combinados com o PO.
const FAIXAS_STATUS: { minimo: number; status: StatusGeral }[] = [
    { minimo: 90, status: 'Excelente' },
    { minimo: 70, status: 'Bom' },
    { minimo: 50, status: 'Regular' },
];

export function classificarDesempenho(resolvidosNoPrazo: number, ticketsResolvidos: number): StatusGeral {
    if (ticketsResolvidos === 0) return 'Sem dados';

    const percentualNoPrazo = (resolvidosNoPrazo / ticketsResolvidos) * 100;
    const faixa = FAIXAS_STATUS.find((f) => percentualNoPrazo >= f.minimo);

    return faixa?.status ?? 'Crítico';
}