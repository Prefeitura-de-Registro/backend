import { Prisma } from "@prisma/client";

export function decimalParaMinutos(valor: Prisma.Decimal | null): number | null {
    return valor === null ? null : Math.round(Number(valor));
}