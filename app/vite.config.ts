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
  // 개발 서버 프록시 (docs/dev-deploy-risks.md B6): DEV_PROXY_TARGET=http://localhost:8080 을 app/.env.local 에 두면
  // /api 와 /ws(WebSocket) 를 백엔드로 넘김 → 브라우저에는 같은 출처라 CORS·쿠키 SameSite 문제가 없음. 비우면 프록시 없음
  const env = loadEnv(mode, '.', '')
  const target = env.DEV_PROXY_TARGET || env.API_PROXY_TARGET
  const proxy = target ? { '/api': { target, changeOrigin: true }, '/ws': { target, ws: true, changeOrigin: true } } : undefined
  return {
  plugins: [react(), stripAvifProbe()],
  server: { port: 5173, proxy },
  // D 시험판(땅굴 Worker, three/worker/roomWorker.ts): Worker 안에서도 동적 import(roomScene·Draco)를 쓰려면 es 형식. avif 확인 코드도 같이 뺌
  // Worker 는 메인과 따로 묶여 three.js 본체를 한 벌 더 품음(청크 이름 roomScene 의 313KB 가 이것). 본체를 'three-worker' 로 따로 떼어 화면 코드와 갈라 둠(합계는 같고, 본체는 잘 안 바뀌어 캐시에 유리)
  worker: { format: 'es', plugins: () => [stripAvifProbe()], rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'three-worker', test: /node_modules[\\/]three[\\/]/ }] } } } },
  // public/ 은 Draco wasm 해독기(일반 빌드용)뿐. 공유 빌드는 JS 해독기를 번들에 넣으므로 복사하지 않음 (three/glb.ts)
  publicDir: mode === 'share' ? false : 'public',
  build: {
    // three.js 청크(약 530kB)는 땅굴·밭 화면에서만 따로 불러오므로 경고 기준을 조금 올림
    chunkSizeWarningLimit: 600,
    // three.js 본체는 이름 붙인 별도 청크 하나로 (땅굴·탐색·채팅 3D 화면이 같이 씀). 화면 코드와 섞이면 화면 청크가 "roomScene" 처럼 three 크기를 업고 다니고 예산 확인이 흐려짐
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] } } },
    // 공유 빌드(아티팩트)는 .glb 파일을 올릴 수 없어서 두더지 모델을 data URL로 JS에 넣음
    ...(mode === 'share' ? { assetsInlineLimit: (file: string) => (file.endsWith('.glb') ? true : undefined) } : {}),
  },
  }
})
