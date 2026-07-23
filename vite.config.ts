import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// User/organization GitHub Pages site is served from the domain root,
// so the base path stays '/'.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        work: resolve(__dirname, 'work.html'),
        projects: resolve(__dirname, 'projects.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
    },
  },
});
