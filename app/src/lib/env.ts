/**
 * 환경 변수는 이 파일에서만 읽는다 (docs/dev-deploy-risks.md D3, docs/frontend-hardening.md "환경 변수").
 *
 * 왜 한 곳에서:
 * - import.meta.env 의 값은 **항상 문자열**이라 `VITE_X=0` 이나 `=false` 도 참이 됨 → flag() 로만 읽는다
 * - `VITE_` 로 시작하는 값은 빌드할 때 JS 에 글자 그대로 박혀 누구나 볼 수 있음 → 비밀 키·DB 주소는 절대 넣지 않는다
 * - 이름·기본값·뜻을 한눈에 보려고
 *
 * 파일: app/.env.example(목록·설명, 커밋함) · .env.share(공유 빌드) · .env.local / .env.*.local(개인 설정, gitignore)
 * 타입: app/src/vite-env.d.ts 의 ImportMetaEnv
 */

const raw = import.meta.env

/** "1"·"true"·"yes"·"on" 만 참. 비었거나 없으면 기본값. "0"·"false"·"off" 는 거짓 */
export function flag(v: string | boolean | undefined, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (v == null || v.trim() === '') return fallback
  return /^(1|true|yes|on)$/i.test(v.trim())
}

/** 문자열 값 (앞뒤 공백 정리, 비었으면 기본값) */
function str(v: string | undefined, fallback: string): string {
  const t = v?.trim()
  return t ? t : fallback
}

/** 끝의 / 를 뗌 ('/api/' → '/api') */
const trimSlash = (s: string) => (s.length > 1 ? s.replace(/\/+$/, '') : s)

/** 쉼표 목록 → 소문자 이름 집합 ("common, auth" → {common, auth}) */
const list = (v: string | undefined) => new Set((v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))

export const ENV = {
  /** vite 모드 ('development' · 'production' · 'share') */
  mode: raw.MODE,
  dev: raw.DEV,
  prod: raw.PROD,
  /** 팀 공유 빌드(아티팩트): 해시 라우터 · glb data URL · Draco JS 해독기 */
  share: raw.MODE === 'share',
  /** vite base (공유 빌드는 './') */
  base: raw.BASE_URL,
  /** # 라우팅 (주소 경로를 못 바꾸는 곳에 올릴 때). VITE_HASH_ROUTER=1 */
  hashRouter: flag(raw.VITE_HASH_ROUTER),
  /**
   * REST API 기준 주소. 백엔드 확정 명세(v1)의 모든 주소가 '/api/v1' 로 시작하므로 기본은 같은 출처의 '/api/v1'
   * (개발은 vite 프록시, 배포는 Nginx 가 Spring 으로 넘김 → CORS 없음). 영역 코드의 경로는 '/meetups' 처럼 이 뒤만 적는다.
   * 다른 도메인이 꼭 필요할 때만 'https://api.example.com/api/v1' 처럼 (그때는 서버 CORS·쿠키 SameSite 설정 필요)
   */
  apiBase: trimSlash(str(raw.VITE_API_BASE, '/api/v1')),
  /** 목 서버(mock, 기본) · 실제 서버(real). 영역마다 바꾸려면 아래 두 목록 (docs/backend/api-v1-foundation.md) */
  apiMode: (str(raw.VITE_API_MODE, 'mock') === 'real' ? 'real' : 'mock') as 'mock' | 'real',
  /** apiMode 와 관계없이 실제 서버로 부를 영역 (예: "common,auth"). 실시간 소식 연결은 이름 "events" */
  apiRealAreas: list(raw.VITE_API_REAL_AREAS),
  /** apiMode 가 real 이어도 목으로 둘 영역 (백엔드가 아직 안 만든 영역) */
  apiMockAreas: list(raw.VITE_API_MOCK_AREAS),
} as const
