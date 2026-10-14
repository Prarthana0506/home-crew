import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../../'),
  resolve: {
    alias: [
      { find: '@urbanclap/lib', replacement: path.resolve(__dirname, '../../packages/lib/src') },
      { find: '@urbanclap/ui/src', replacement: path.resolve(__dirname, '../../packages/ui/src') },
      { find: '@urbanclap/ui', replacement: path.resolve(__dirname, '../../packages/ui/src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3001
  }
});

