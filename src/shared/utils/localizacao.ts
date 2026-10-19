import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';

export type Localizacao = { latitude: number; longitude: number } | null;

/**
 * O Prisma não lê a coluna PostGIS `geom`, então buscamos latitude/longitude
 * por SQL para um conjunto de tickets de uma vez (sem N+1).
 */
export async function buscarLocalizacoes(
  ids: number[],
): Promise<Map<number, Localizacao>> {
  const mapa = new Map<number, Localizacao>();

  if (ids.length === 0) {
    return mapa;
  }

  const linhas = await prisma.$queryRaw<
    { id: number; latitude: number | null; longitude: number | null }[]
  >(Prisma.sql`
    SELECT id,
           ST_Y(geom::geometry) AS latitude,
           ST_X(geom::geometry) AS longitude
    FROM tickets
    WHERE id IN (${Prisma.join(ids)})
  `);

  for (const linha of linhas) {
    mapa.set(
      linha.id,
      linha.latitude === null || linha.longitude === null
        ? null
        : {
            latitude: Number(linha.latitude),
            longitude: Number(linha.longitude),
          },
    );
  }

  return mapa;
}

export async function buscarLocalizacao(id: number): Promise<Localizacao> {
  return (await buscarLocalizacoes([id])).get(id) ?? null;
}
