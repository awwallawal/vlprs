import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';
import { applyTriggers } from './triggers';

async function main(): Promise<void> {
  const db = drizzle(env.DATABASE_URL);
  try {
    await applyTriggers(db);
    console.log('Triggers applied successfully');
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply triggers:', err);
  process.exit(1);
});
