/**
 * Shared test setup — imported by workspace vitest configs.
 * Handles environment reset, global mocks, etc.
 */
import { resetTestEnvironment } from './helpers/resetEnv';

export function setupTestSuite(): void {
  resetTestEnvironment();
}
