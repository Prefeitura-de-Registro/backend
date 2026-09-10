import type { Request, Response } from "express";
import { prisma } from "../../shared/database/prisma.js";

export class HealthController {
  check = async (_request: Request, response: Response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: "ok", database: "connected" });
  };
}
