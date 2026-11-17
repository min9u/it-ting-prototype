import { defineConfig } from 'vitest/config'

// 단위 테스트 설정 (docs/testing-ci.md)
// - vite.config.ts 와 따로 둠: 테스트는 순수 함수·JSON 위주라 React 플러그인·빌드 설정이 필요 없음
// - 시간대는 서울로 고정 (CI 우분투 러너는 UTC). 날짜 계산이 로컬 시각 기준이라 CI 와 로컬 결과를 같게
process.env.TZ = 'Asia/Seoul'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // data/ 저장소들이 localStorage · sessionStorage 를 읽어서 jsdom 으로 (없으면 try/catch 로 넘어가지만 저장 동작까지 보려고)
    environment: 'jsdom',
    // 파일마다 모듈 상태(목 저장소)를 새로
    isolate: true,
    restoreMocks: true,
  },
})
