import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Vitest globalSetup — runs once before any test file.
 * Pings PostgreSQL and aborts immediately with a clear message if unreachable.
 * Saves ~8 minutes of waiting for 36 integration tests to each fail with ECONNREFUSED.
 */
export async function setup(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      '\n\n╔══════════════════════════════════════════════════════════════╗\n' +
        '║  DATABASE_URL is not set.                                   ║\n' +
        '║  Integration tests require a PostgreSQL connection.         ║\n' +
        '║                                                             ║\n' +
        '║  Run unit tests only:  pnpm test:unit                      ║\n' +
        '╚══════════════════════════════════════════════════════════════╝\n',
    );
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch {
    throw new Error(
      '\n\n╔══════════════════════════════════════════════════════════════╗\n' +
        '║  Cannot reach PostgreSQL                                    ║\n' +
        '║                                                             ║\n' +
        `║  URL: ${url.replace(/\/\/.*@/, '//***@').padEnd(53)}║\n` +
        '║                                                             ║\n' +
        '║  Possible causes:                                           ║\n' +
        '║    • Docker Desktop is not running                          ║\n' +
        '║    • WiFi change broke Docker port bindings                 ║\n' +
        '║      → run: docker restart vlprs-db-1                       ║\n' +
        '║                                                             ║\n' +
        '║  To run unit tests only (no DB needed):                     ║\n' +
        '║    pnpm test:unit                                           ║\n' +
        '╚══════════════════════════════════════════════════════════════╝\n',
    );
  } finally {
    await client.end().catch(() => {});
  }
}
