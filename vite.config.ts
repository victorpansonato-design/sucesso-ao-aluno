import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    rollupOptions: {
      output: {
        // Split the three large, rarely-changing dependencies out of the app
        // bundle so a code change only invalidates the app chunk.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
          motion: ['motion', 'motion/react'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    // HMR is disabled in AI Studio via the DISABLE_HMR env var to prevent
    // flickering while an agent edits files.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
