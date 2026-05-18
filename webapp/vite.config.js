import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/docx')) return 'docx';
          if (id.includes('node_modules/file-saver')) return 'file-saver';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
