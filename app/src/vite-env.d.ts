/// <reference types="vite/client" />

/**
 * 우리 앱이 쓰는 환경 변수 (값은 항상 문자열). 읽을 때는 import.meta.env 대신 src/lib/env.ts 의 ENV 를 쓴다.
 * 설명과 예시는 app/.env.example
 */
interface ImportMetaEnv {
  /** "1" 이면 # 라우팅 (공유 빌드) */
  readonly VITE_HASH_ROUTER?: string
  /** REST 기준 주소 (기본 /api/v1) */
  readonly VITE_API_BASE?: string
  /** API 방식: mock · real (기본 mock) */
  readonly VITE_API_MODE?: string
  /** 실제 서버로 부를 영역 목록 (쉼표, 예: common,auth,events) */
  readonly VITE_API_REAL_AREAS?: string
  /** 목으로 둘 영역 목록 (VITE_API_MODE=real 일 때) */
  readonly VITE_API_MOCK_AREAS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
