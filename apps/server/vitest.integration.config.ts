import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    include: ['**/*.integration.test.ts'],
    globalSetup: './src/test/globalSetup.ts',
  },
});
