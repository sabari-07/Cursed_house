import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': '/src' },
  },
  test: {
    // jsdom gives us a real localStorage for the save round-trip tests.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
