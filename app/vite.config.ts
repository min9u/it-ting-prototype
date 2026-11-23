import { defineConfig, loadEnv, type Plugin } from 'vite'
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

export default defineConfig(({ mode }) => {
  // 개발 서버 프록시 (docs/dev-deploy-risks.md B6, docs/backend/api-v1-foundation.md): /api(REST · SSE /api/v1/me/event-stream)를
  // 백엔드로 넘김 → 브라우저에는 같은 출처라 CORS·쿠키 문제가 없음.
  // 기본 http://localhost:8080 (백엔드 Spring 기본 포트). 바꾸려면 app/.env.local 에 DEV_PROXY_TARGET=…, 끄려면 DEV_PROXY_TARGET=off
  // 목 모드에서는 /api 요청이 없어서 백엔드가 꺼져 있어도 상관없음. (Next.js 로 옮기면 next.config 의 rewrites 가 이 일을 함)
  const env = loadEnv(mode, '.', '')
  const target = env.DEV_PROXY_TARGET || env.API_PROXY_TARGET || 'http://localhost:8080'
  const proxy = target === 'off' ? undefined : { '/api': { target, changeOrigin: true } }
  return {
  plugins: [react(), stripAvifProbe()],
  server: { port: 5173, proxy },
  // D 시험판(땅굴 Worker, three/worker/roomWorker.ts): Worker 안에서도 동적 import(roomScene·Draco)를 쓰려면 es 형식. avif 확인 코드도 같이 뺌
  worker: { format: 'es', plugins: () => [stripAvifProbe()] },
  // public/ 은 Draco wasm 해독기(일반 빌드용)뿐. 공유 빌드는 JS 해독기를 번들에 넣으므로 복사하지 않음 (three/glb.ts)
  publicDir: mode === 'share' ? false : 'public',
  build: {
    // three.js 청크(약 530kB)는 땅굴·밭 화면에서만 따로 불러오므로 경고 기준을 조금 올림
    chunkSizeWarningLimit: 600,
    // 공유 빌드(아티팩트)는 .glb 파일을 올릴 수 없어서 두더지 모델을 data URL로 JS에 넣음
    ...(mode === 'share' ? { assetsInlineLimit: (file: string) => (file.endsWith('.glb') ? true : undefined) } : {}),
  },
  }
})
