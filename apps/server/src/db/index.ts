import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { env } from '../config/env';
import { queryCounterLogger } from '../lib/queryContext';

export const db = drizzle(env.DATABASE_URL, {
  schema,
  logger: env.NODE_ENV !== 'production' ? queryCounterLogger : false,
});
