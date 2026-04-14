// reload trigger 2
import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { runMigrations } from './db/migrate';
import { seedReferenceMdas } from './db/seedReferenceMdas';
import { startIntegrityChecker, stopIntegrityChecker } from './services/integrityChecker';
import { startInactiveLoanScheduler, stopInactiveLoanScheduler } from './services/inactiveLoanDetector';
import { startMetricSnapshotScheduler, stopMetricSnapshotScheduler } from './services/metricSnapshotService';
import { startAutoStopScheduler, stopAutoStopScheduler } from './services/autoStopService';

async function start(): Promise<void> {
  // Apply database migrations BEFORE accepting traffic
  try {
    await runMigrations();
  } catch (err) {
    logger.fatal({ err }, 'Migration failed — server cannot start');
    process.exit(1);
  }

  // Seed MDA reference data (all environments — idempotent)
  try {
    await seedReferenceMdas();
  } catch (err) {
    logger.error({ err }, 'seedReferenceMdas failed — server will start but MDA data may be missing');
  }

  const server = app.listen(env.PORT, async () => {
    logger.info(`VLPRS server running on port ${env.PORT}`);

    // Start background integrity checker (30s delay, then every 15 minutes)
    startIntegrityChecker();

    // Start inactive loan detection scheduler (5min delay, then every 6 hours)
    startInactiveLoanScheduler();

    // Start metric snapshot scheduler (5min delay, then daily check)
    startMetricSnapshotScheduler();

    // Start auto-stop detection scheduler (3min delay, then every 6 hours)
    startAutoStopScheduler();

    // In development, auto-seed the database if the users table is empty.
    // This prevents the recurring "can't login" issue after Docker volume wipes.
    if (env.NODE_ENV === 'development') {
      const { devAutoSeed } = await import('./db/devAutoSeed');
      await devAutoSeed();
    }
  });

  function gracefulShutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);
    stopIntegrityChecker();
    stopInactiveLoanScheduler();
    stopMetricSnapshotScheduler();
    stopAutoStopScheduler();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start();
