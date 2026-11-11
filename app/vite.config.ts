import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works on any GitHub Pages path (user.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020', cssMinify: true, assetsInlineLimit: 0 },
});
