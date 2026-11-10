import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // three.js 청크(약 530kB)는 땅굴·밭 화면에서만 따로 불러오므로 경고 기준을 조금 올림
  build: { chunkSizeWarningLimit: 600 },
})
