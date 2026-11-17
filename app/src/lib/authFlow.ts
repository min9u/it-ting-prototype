import { LOGIN_FREE, START_PATHS, setAuthState } from '../data/auth'

/**
 * 인증 흐름 뼈대 (docs/dev-deploy-risks.md B5, docs/frontend-hardening.md "인증 흐름").
 * 서버가 아직 없어서 지금은 "자리"만 만든다. LOGIN_FREE = true 인 동안은 동작이 바뀌지 않음 (401 이 와도 기록만).
 *
 * 흐름 (LOGIN_FREE = false 가 되면)
 * 1. REST 응답 401 → refreshSessionOnce() 로 갱신을 **한 번만** 시도 (동시에 여러 요청이 401 이어도 갱신 요청은 하나)
 * 2. 갱신 실패 또는 WebSocket 이 인증 문제로 끊김 → handleUnauthorized()
 *    → 비로그인으로 바꾸고, 지금 주소를 기억하고, /login 으로 (주소창 기록을 덮어씀)
 * 3. 로그인 성공 → takeReturnTo() 로 기억한 주소로 돌아감 (없으면 내 땅굴)
 *
 * 화면 이동은 라우터를 직접 import 하면 순환 참조가 생겨서, main.tsx 가 registerNavigator(router.navigate) 로 넣어 줌
 */
type Nav = (to: string, opts?: { replace?: boolean; state?: unknown }) => void
let navigateFn: Nav | null = null
export function registerNavigator(fn: Nav) { navigateFn = fn }

const RETURN_KEY = 'digul.returnTo'

/** 앱 안 주소 (해시 라우터면 # 뒤, 아니면 경로 + 쿼리) */
export function currentAppPath(): string {
  if (typeof window === 'undefined') return '/'
  const h = window.location.hash
  if (h.startsWith('#/')) return h.slice(1)
  return `${window.location.pathname}${window.location.search}`
}

const isStart = (p: string) => p === '/' || START_PATHS.some((s) => p === s || p.startsWith(`${s}/`) || p.startsWith(`${s}?`))

/** 돌아갈 주소로 써도 되는지: 앱 안 경로만 (//evil.com · https:// 같은 바깥 주소 막기), 시작 화면은 빼기 */
export function safeReturnPath(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return null
  return isStart(p.split('?')[0]) ? null : p
}

export function rememberReturnTo(path: string = currentAppPath()) {
  const p = safeReturnPath(path)
  if (!p) return
  try { sessionStorage.setItem(RETURN_KEY, p) } catch { /* 저장소가 막힌 곳 */ }
}

/** 기억한 주소를 꺼냄 (한 번 쓰면 지움). 라우터 state.from 이 있으면 그걸 먼저 */
export function takeReturnTo(stateFrom?: unknown): string | null {
  let saved: string | null = null
  try { saved = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY) } catch { /* 무시 */ }
  return safeReturnPath(stateFrom) ?? safeReturnPath(saved)
}

let handling = false
/**
 * 인증이 풀렸을 때 (REST 401 이 갱신 뒤에도 401, 또는 실시간 연결이 인증 문제로 끊김).
 * LOGIN_FREE 인 지금은 기록만 하고 아무것도 바꾸지 않음
 */
export function handleUnauthorized(reason = 'unauthorized') {
  if (LOGIN_FREE) {
    console.info('[인증] 로그인이 필요하다는 응답을 받았지만 LOGIN_FREE 라 그대로 둠:', reason)
    return
  }
  if (handling) return
  handling = true
  const from = currentAppPath()
  setAuthState('guest')
  rememberReturnTo(from)
  const state = { from: safeReturnPath(from) ?? undefined, toast: '다시 로그인해 주세요' }
  if (navigateFn) navigateFn('/login', { replace: true, state })
  else if (typeof window !== 'undefined') window.location.assign(window.location.hash.startsWith('#/') ? '#/login' : '/login')
  setTimeout(() => { handling = false }, 1000)
}

let refreshing: Promise<boolean> | null = null
/**
 * 세션 갱신을 한 번만: 진행 중인 갱신이 있으면 그 Promise 를 같이 기다림.
 * doRefresh 는 API 계층이 넣음 (예: POST /api/auth/refresh → ok 면 true). 실패하면 handleUnauthorized
 */
export function refreshSessionOnce(doRefresh: () => Promise<boolean>): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh()
      .catch(() => false)
      .then((ok) => { if (!ok) handleUnauthorized('refresh failed'); return ok })
      .finally(() => { setTimeout(() => { refreshing = null }, 0) })
  }
  return refreshing
}
