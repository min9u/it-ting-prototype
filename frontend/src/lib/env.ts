/**
 * 환경 변수는 이 파일에서만 읽는다 (docs/dev-deploy-risks.md D3, docs/frontend-hardening.md "환경 변수", docs/nextjs-migration.md).
 *
 * 왜 한 곳에서:
 * - 환경 변수 값은 **항상 문자열**이라 `NEXT_PUBLIC_X=0` 이나 `=false` 도 참이 됨 → flag() 로만 읽는다
 * - `NEXT_PUBLIC_` 로 시작하는 값은 빌드할 때 JS 에 글자 그대로 박혀 누구나 볼 수 있음 → 비밀 키·DB 주소는 절대 넣지 않는다
 * - Next.js 는 `process.env.NEXT_PUBLIC_이름` 을 **그대로 적은 곳만** 값으로 바꿔 넣음 → `const e = process.env; e.X` 처럼 쓰면 브라우저에서 비어 있음.
 *   그래서 아래에 이름마다 한 번씩 적는다
 * - 이름·기본값·뜻을 한눈에 보려고
 *
 * 파일: frontend/.env.example(목록·설명, 커밋함) · .env.local / .env.*.local(개인 설정, gitignore)
 * NEXT_PUBLIC_LABS · NEXT_PUBLIC_BUILD_STAMP 는 next.config.ts 가 정해 넣음 (next dev 면 실험실 기본 켬)
 */

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

const NODE_ENV = process.env.NODE_ENV

export const ENV = {
  /** 'development' · 'production' · 'test' */
  mode: NODE_ENV,
  /** next dev · vitest */
  dev: NODE_ENV !== 'production',
  prod: NODE_ENV === 'production',
  /** 실험실(🧪 패널 · /lab · /screens · /dev/crash)이 이 빌드에 들어 있는지. 빌드 때 정해짐 (next.config.ts) */
  labs: flag(process.env.NEXT_PUBLIC_LABS),
  /** 앱 기준 경로 (Next basePath 를 안 써서 늘 '/'. 끝에 / 가 붙은 Vite BASE_URL 과 같은 모양) */
  base: '/',
  /** 빌드마다 바뀌는 표시 (저사양 정지 그림 캐시 키, three/stills.ts) */
  buildStamp: str(process.env.NEXT_PUBLIC_BUILD_STAMP, 'dev'),
  /**
   * REST API 기준 주소. 백엔드 확정 명세(v1)의 모든 주소가 '/api/v1' 로 시작하므로 기본은 같은 출처의 '/api/v1'
   * (개발은 next.config.ts rewrites, 배포는 Nginx 가 Spring 으로 넘김 → CORS 없음). 영역 코드의 경로는 '/meetups' 처럼 이 뒤만 적는다.
   * 다른 도메인이 꼭 필요할 때만 'https://api.example.com/api/v1' 처럼 (그때는 서버 CORS·쿠키 SameSite 설정 필요)
   */
  apiBase: trimSlash(str(process.env.NEXT_PUBLIC_API_BASE, '/api/v1')),
  /** 목 서버(mock, 기본) · 실제 서버(real). 영역마다 바꾸려면 아래 두 목록 (docs/backend/api-v1-foundation.md) */
  apiMode: (str(process.env.NEXT_PUBLIC_API_MODE, 'mock') === 'real' ? 'real' : 'mock') as 'mock' | 'real',
  /** apiMode 와 관계없이 실제 서버로 부를 영역 (예: "common,auth"). 실시간 소식 연결은 이름 "events" */
  apiRealAreas: list(process.env.NEXT_PUBLIC_API_REAL_AREAS),
  /** apiMode 가 real 이어도 목으로 둘 영역 (백엔드가 아직 안 만든 영역) */
  apiMockAreas: list(process.env.NEXT_PUBLIC_API_MOCK_AREAS),
  /**
   * 로그인 검사 끄기 (시연용). 기본 거짓 = 명세대로: 비로그인 → 로그인 화면, 온보딩 안 끝남 → 온보딩, 401 → 다시 로그인.
   * 참이면 로그인이 입력과 관계없이 성공하고 비로그인으로도 모든 화면이 열림, 401 도 무시 (data/auth.ts LOGIN_FREE)
   */
  loginFree: flag(process.env.NEXT_PUBLIC_LOGIN_FREE),
} as const
