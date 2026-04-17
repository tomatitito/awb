import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  root: path.resolve(__dirname, 'src/web'),
  plugins: [react()],
  server: {
    allowedHosts: ['mcbk0468.tail74fc7b.ts.net'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
  },
})
