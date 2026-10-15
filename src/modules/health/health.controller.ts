import { Request, Response } from 'express';
import { prisma } from '../../shared/database/prisma';

export class HealthController {
  async check(req: Request, res: Response) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(200).json({
        status: 'ok',
        db: 'warming_up',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
