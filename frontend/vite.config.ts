import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/generate-graph': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/chat-stream': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/resolve-entities': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/merge-entities': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/nodes': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/edges': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/export': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/sessions': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/analytics': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
