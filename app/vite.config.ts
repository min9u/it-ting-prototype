import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// three.js GLTFLoader의 AVIF 지원 확인용 작은 avif 이미지(data URL)를 뺌.
// 우리 모델은 avif 텍스처를 쓰지 않고, 아티팩트 공개 공유 검토가 avif data URL을 막음 (2026-11-11 시험으로 확인).
// 빼면 확인 결과가 "지원 안 함"이 될 뿐 동작은 같음.
function stripAvifProbe(): Plugin {
  return {
    name: 'strip-avif-probe',
    renderChunk(code) {
      const next = code.replace(/data:image\/avif;base64,[A-Za-z0-9+/=]+/g, 'data:,')
      return next === code ? null : { code: next, map: null }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), stripAvifProbe()],
  server: { port: 5173 },
  build: {
    // three.js 청크(약 530kB)는 땅굴·밭 화면에서만 따로 불러오므로 경고 기준을 조금 올림
    chunkSizeWarningLimit: 600,
    // 공유 빌드(아티팩트)는 .glb 파일을 올릴 수 없어서 두더지 모델을 data URL로 JS에 넣음
    ...(mode === 'share' ? { assetsInlineLimit: (file: string) => (file.endsWith('.glb') ? true : undefined) } : {}),
  },
}))
