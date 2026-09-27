import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Test files share one database, so run them sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: 'test' },
  },
});
