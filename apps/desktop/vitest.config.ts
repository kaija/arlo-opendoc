import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@arlo-doc/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@arlo-doc/client/ipc': resolve(__dirname, '../../packages/client/src/ipc.ts'),
    },
  },
});
