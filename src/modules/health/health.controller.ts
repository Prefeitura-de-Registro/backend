
import { Response } from 'express';
import { prisma } from '../../shared/database/prisma.js';

export class HealthController {
  async check(_req: unknown, res: Response) {
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
