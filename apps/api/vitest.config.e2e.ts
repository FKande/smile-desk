import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    env: { DB_PATH: ':memory:' },
    include: ['**/*.e2e-spec.ts'],
  },
});
