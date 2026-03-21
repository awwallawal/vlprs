import { AsyncLocalStorage } from 'node:async_hooks';

export interface QueryContext {
  count: number;
}

export const queryStorage = new AsyncLocalStorage<QueryContext>();

/**
 * Drizzle custom logger that increments the per-request query counter.
 * Plugged into `drizzle()` via the `logger` option in db/index.ts.
 *
 * Lives in lib/ (not middleware/) so that db/index.ts can import it
 * without an inverted db → middleware dependency.
 */
export const queryCounterLogger = {
  logQuery(_query: string, _params: unknown[]) {
    const ctx = queryStorage.getStore();
    if (ctx) ctx.count++;
  },
};
