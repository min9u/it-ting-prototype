import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // three.js 청크(약 530kB)는 땅굴·밭 화면에서만 따로 불러오므로 경고 기준을 조금 올림
    chunkSizeWarningLimit: 600,
    // 공유 빌드(아티팩트)는 .glb 파일을 올릴 수 없어서 두더지 모델을 data URL로 JS에 넣음
    ...(mode === 'share' ? { assetsInlineLimit: (file: string) => (file.endsWith('.glb') ? true : undefined) } : {}),
  },
}))
