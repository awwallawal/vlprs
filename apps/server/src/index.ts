import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { runMigrations } from './db/migrate';

async function start(): Promise<void> {
  // Apply database migrations BEFORE accepting traffic
  try {
    await runMigrations();
  } catch (err) {
    logger.fatal({ err }, 'Migration failed — server cannot start');
    process.exit(1);
  }

  const server = app.listen(env.PORT, async () => {
    logger.info(`VLPRS server running on port ${env.PORT}`);

    // In development, auto-seed the database if the users table is empty.
    // This prevents the recurring "can't login" issue after Docker volume wipes.
    if (env.NODE_ENV === 'development') {
      const { devAutoSeed } = await import('./db/devAutoSeed');
      await devAutoSeed();
    }
  });

  function gracefulShutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start();
