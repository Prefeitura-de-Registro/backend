import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { JWT_SECRET: 'test-secret' },
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'dist/**', 'src/server.ts'],
    },
  },
});
