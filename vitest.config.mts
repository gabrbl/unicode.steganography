import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `lib/` es lógica pura y Node 22 ya trae `crypto.subtle` e `Intl.Segmenter`,
    // así que no hace falta jsdom.
    environment: 'node',
    include: ['lib/__tests__/**/*.test.ts'],
  },
});
