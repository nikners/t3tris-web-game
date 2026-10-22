import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
