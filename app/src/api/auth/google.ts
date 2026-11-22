/**
 * Google 로그인 · 확인의 "브라우저 이동" 부분 (02 GET /oauth/google · /oauth/google/callback, 10 GET /oauth/google/verify).
 * JSON API 가 아니라 브라우저가 서버 주소로 갔다가 Google 을 거쳐 서버 콜백 → 프론트 주소로 돌아온다.
 *
 * - 실제 서버: real.googleLoginUrl() = '/api/v1/oauth/google' 로 location 이동 (페이지가 새로 열림)
 * - 목 서버: 주소가 앱 안의 흉내 Google 화면('/oauth/mock-google?purpose=…')이라 라우터로 이동 (메모리의 목 상태 유지)
 *
 * 콜백이 돌려보내는 프론트 주소는 명세가 "정해진 주소"라고만 해서(02 "구현 단계로 넘기는 것") 여기서 정했다 → 백엔드에 알려 줄 것
 * 이 파일은 불러올 때 window 를 만지지 않는다 (Next.js 이전 대비)
 */
import { API_BASE } from '../config'
import type { GooglePurpose } from './types'

/** 콜백 뒤 프론트 주소 (서버 설정과 같아야 함) */
export const GOOGLE_RETURN = {
  /** 이미 가입한 계정이 로그인됨 → GET /me 의 nextStep 으로 이동 */
  loggedIn: '/auth/google',
  /** 처음 쓰는 Google 계정 → 회원가입 3 (진행 표시 없이) */
  newAccount: '/signup/ssafy?via=google',
  /** 로그인 못 함 (정지 · 취소) → /login?error=<code> */
  loginFailed: (code: string, extra?: Record<string, string>) => `/login?${new URLSearchParams({ error: code, ...extra })}`,
  /** 설정에서 연동 확인됨 → PUT /me/google-link */
  linkVerified: '/settings/google?verified=true',
  /** 탈퇴 전 본인 확인됨 → GET /me/withdrawal-check 의 isGoogleVerified */
  withdrawVerified: '/settings/leave',
  /** 설정에서 확인 못 함 → 시작한 화면?error=<code> */
  verifyFailed: (purpose: Exclude<GooglePurpose, 'LOGIN'>, code: string) => `${purpose === 'LINK' ? '/settings/google' : '/settings/leave'}?error=${encodeURIComponent(code)}`,
  /** 로그인이 풀려 있음 */
  login: '/login',
} as const

/** 서버로 가는 주소인지 (실제 서버 · 다른 사이트면 location 이동, 아니면 앱 안 라우터 이동) */
export const isServerUrl = (url: string) => url.startsWith(API_BASE) || /^https?:\/\//.test(url)

/**
 * Google 로 가기: 실제 서버면 페이지 이동, 목이면 라우터 이동.
 * navigate 는 react-router 의 useNavigate() 결과
 */
export function goGoogle(url: string, navigate: (to: string) => void) {
  if (isServerUrl(url)) {
    if (typeof window !== 'undefined') window.location.assign(url)
    return
  }
  navigate(url)
}

/** 정지 계정의 Google 로그인: 돌아온 주소의 reason · endsAt (있으면). 명세 미정이라 둘 다 없을 수 있음 */
export function suspendedFromQuery(q: URLSearchParams): { reason: string | null; endsAt: string | null } {
  return { reason: q.get('reason'), endsAt: q.get('endsAt') }
}
