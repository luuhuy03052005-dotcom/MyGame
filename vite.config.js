import { defineConfig } from 'vite'

export default defineConfig({
  // base: './' là BẮT BUỘC để loadFile() hoạt động đúng trong production packaged app.
  // Với base: '/', Vite sinh đường dẫn tuyệt đối (/assets/...) không resolve được qua file://.
  // Với base: './', tất cả assets dùng đường dẫn tương đối → hoạt động cả dev lẫn prod.
  base: './',

  root: 'src/renderer',

  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/renderer/index.html',
    },
  },

  server: {
    port: 5173,
    strictPort: true,  // fail nếu port đã bận, không tự chuyển port
  },

  // Three.js dùng ES modules — không cần transform đặc biệt
  optimizeDeps: {
    include: ['three'],
  },
})
