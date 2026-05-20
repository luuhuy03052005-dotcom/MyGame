/**
 * vitest.config.js — Tách biệt khỏi vite.config.js
 * vite.config.js dùng root: 'src/renderer' cho dev server,
 * vitest cần root: '.' để tìm thấy tests/ và src/
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
})
