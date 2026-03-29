import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    proxy: {
      '/api':        'http://localhost:8000',
      '/upload':     'http://localhost:8000',
      '/cancel':     'http://localhost:8000',
      '/video_feed': 'http://localhost:8000',
    }
  }
})
