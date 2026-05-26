import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    globals: true,
    setupFiles: ['src/tests/setup.js'],
    // Unit tests only — TestCafe e2e tests live in tests/e2e and run via `npm run test:e2e`
    include: ['src/tests/**/*.test.{js,jsx}'],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**', 'legacy/**'],
  },
});
