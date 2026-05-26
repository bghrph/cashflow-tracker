import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createParseHandler } from './server/proxy.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'cashflow-ai-proxy',
        configureServer(server) {
          const handler = createParseHandler({ apiKey: env.ANTHROPIC_API_KEY });
          server.middlewares.use('/api/parse', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }
            handler(req, res);
          });
          server.middlewares.use('/api/health', (_req, res) => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, hasKey: Boolean(env.ANTHROPIC_API_KEY) }));
          });
        },
      },
    ],
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
  };
});
