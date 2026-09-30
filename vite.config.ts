import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Su GitHub Pages l'app vive in /<nome-repo>/: il workflow imposta BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // I font sono inclusi nell'app: così funziona tutto anche offline.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'] },
      manifest: {
        name: 'Gutty – diario del colon irritabile',
        short_name: 'Gutty',
        description: 'Registra sintomi e alimenti ogni giorno e scopri cosa li peggiora.',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#f4efe6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
