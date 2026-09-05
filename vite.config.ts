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
        // Tennis group sign up sheet, served at /tennis/.
        tennisLogin: resolve(__dirname, 'tennis/index.html'),
        tennisSheet: resolve(__dirname, 'tennis/sheet.html'),
        tennisContact: resolve(__dirname, 'tennis/contact.html'),
        tennisHelp: resolve(__dirname, 'tennis/help.html'),
        tennisMaint: resolve(__dirname, 'tennis/maint.html'),
      },
    },
  },
});
