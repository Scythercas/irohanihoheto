import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // itch.io の HTML5 配信は相対パス必須。GitHub Pages でもサブパスに置けるよう './' 固定。
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
