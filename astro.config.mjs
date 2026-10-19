// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// When running in Vercel CI/CD, use official Vercel adapter.
// In local development / Windows testing, use Node standalone adapter.
const isVercel = Boolean(process.env.VERCEL);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isVercel
    ? vercel()
    : node({
        mode: 'standalone',
      }),
  vite: {
    plugins: [tailwindcss()],
  },
});
