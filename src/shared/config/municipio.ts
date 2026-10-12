// Valores que dependem do município. Os que vêm de process.env podem ser
// trocados no .env sem alterar o código.

export const CENTRO_PADRAO_MAPA = {
  lat: Number(process.env.MAPA_CENTRO_LAT ?? -24.4875),
  lng: Number(process.env.MAPA_CENTRO_LNG ?? -47.8436),
};

export const FUSO_HORARIO = 'America/Sao_Paulo';

// O Brasil não tem horário de verão desde 2019, então o deslocamento é fixo
export const OFFSET_FUSO_HORARIO = '-03:00';