import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger';

/**
 * Structured request/response logging with pino.
 * Generates a unique X-Request-Id per request.
 * Mounted globally (before routes, after body parsing).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const externalId = req.headers['x-request-id'] as string | undefined;
  const requestId = (externalId && externalId.length <= 128 && /^[\w\-.]+$/.test(externalId)) ? externalId : randomUUID();
  const startTime = process.hrtime.bigint();

  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userId: req.user?.userId,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
}
