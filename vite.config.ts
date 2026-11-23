import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    target: 'esnext',
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
})
