/// <reference types="vite/client" />

/**
 * 우리 앱이 쓰는 환경 변수 (값은 항상 문자열). 읽을 때는 import.meta.env 대신 src/lib/env.ts 의 ENV 를 쓴다.
 * 설명과 예시는 app/.env.example
 */
interface ImportMetaEnv {
  /** "1" 이면 # 라우팅 (공유 빌드) */
  readonly VITE_HASH_ROUTER?: string
  /** REST 기준 주소 (기본 /api) */
  readonly VITE_API_BASE?: string
  /** WebSocket 주소 (기본 /ws) */
  readonly VITE_WS_URL?: string
  /** 실시간 연결 방식: mock · stomp (기본 mock) */
  readonly VITE_REALTIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
