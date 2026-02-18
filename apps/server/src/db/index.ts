import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://vlprs:vlprs_dev@localhost:5432/vlprs_dev';

export const db = drizzle(databaseUrl, { schema });
