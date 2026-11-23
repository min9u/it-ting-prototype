import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 단위 테스트 설정 (docs/testing-ci.md). Vite 앱(app/vitest.config.ts)과 같은 설정 + '@/' 별칭
// - 테스트는 순수 함수·JSON 위주라 Next 설정이 필요 없음. 이미지 · glb import 는 vitest(Vite)가 파일 주소 문자열로 줌 (Next 빌드와 같은 결과)
// - 시간대는 서울로 고정 (CI 우분투 러너는 UTC). 날짜 계산이 로컬 시각 기준이라 CI 와 로컬 결과를 같게
process.env.TZ = 'Asia/Seoul'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // data/ 저장소들이 localStorage · sessionStorage 를 읽어서 jsdom 으로 (없으면 try/catch 로 넘어가지만 저장 동작까지 보려고)
    environment: 'jsdom',
    // 파일마다 모듈 상태(목 저장소)를 새로
    isolate: true,
    restoreMocks: true,
  },
})
