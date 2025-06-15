/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TradeRepublicConnector',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        'ws', 
        'axios', 
        'dotenv', 
        'winston',
        'fs/promises',
        'path',
        'os'
      ],
      output: {
        globals: {
          ws: 'WebSocket',
          axios: 'axios',
          dotenv: 'dotenv',
          winston: 'winston',
          'fs/promises': 'fs',
          path: 'path',
          os: 'os'
        }
      }
    },
    target: 'node18',
    sourcemap: true,
    ssr: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/config': resolve(__dirname, 'src/config'),
      '@/auth': resolve(__dirname, 'src/auth'),
      '@/ws': resolve(__dirname, 'src/websocket'),
      '@/api': resolve(__dirname, 'src/api'),
      '@/utils': resolve(__dirname, 'src/utils')
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
})
