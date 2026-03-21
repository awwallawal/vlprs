import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { queryStorage } from '../lib/queryContext';

export { queryStorage, queryCounterLogger } from '../lib/queryContext';

const QUERY_THRESHOLD = 10;

/**
 * Express middleware: wraps each request in an AsyncLocalStorage context
 * so the Drizzle logger can count queries per-request.
 *
 * On response finish, logs a warning if query count exceeds threshold.
 * Sets `req.queryCount` for test assertions.
 *
 * Only active when NODE_ENV !== 'production'.
 */
export function queryCounter(req: Request, res: Response, next: NextFunction): void {
  const ctx = { count: 0 };
  queryStorage.run(ctx, () => {
    res.on('finish', () => {
      req.queryCount = ctx.count;
      if (ctx.count > QUERY_THRESHOLD) {
        logger.warn(
          { method: req.method, url: req.originalUrl, queryCount: ctx.count, threshold: QUERY_THRESHOLD },
          'N+1 WARNING: Query threshold exceeded',
        );
      }
    });
    next();
  });
}
