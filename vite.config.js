import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CashFlow Tracker',
        short_name: 'CashFlow',
        description: 'Personal finance tracker with hybrid local + AI transaction parser',
        theme_color: '#0A6B4E',
        background_color: '#FAFAF7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/\.netlify\//],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-core';
        },
      },
    },
  },
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/tests/**', 'src/main.jsx'],
    },
  },
});
