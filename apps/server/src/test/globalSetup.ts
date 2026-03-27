import net from 'net';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Vitest globalSetup — runs once before any test file.
 * Pings PostgreSQL with a raw TCP check and aborts immediately with a
 * clear message if unreachable. Avoids importing `pg` directly so we
 * don't need @types/pg as a devDependency.
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

  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = Number(parsed.port) || 5432;

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 3_000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.once('error', (err) => {
      socket.destroy();
      reject(err);
    });
  }).catch(() => {
    const masked = url.replace(/\/\/.*@/, '//***@');
    throw new Error(
      '\n\n╔══════════════════════════════════════════════════════════════╗\n' +
        '║  Cannot reach PostgreSQL                                    ║\n' +
        '║                                                             ║\n' +
        `║  URL: ${masked.padEnd(53)}║\n` +
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
  });
}
