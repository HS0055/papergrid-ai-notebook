import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: 'localhost',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@papergrid/core': path.resolve(__dirname, '../core/src'),
      },
    },
    css: {
      postcss: path.resolve(__dirname, 'postcss.config.js'),
    },
  };
});
