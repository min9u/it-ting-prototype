import { LOGIN_FREE, START_PATHS, setAuthState } from '../data/auth'
import { queryClient } from '../api/queryClient'

/**
 * 인증 흐름 (명세 v1: api-convention "로그인", 02 "다음에 갈 화면").
 * 세션은 쿠키(ITTING_SESSION, 14일, 쓸 때마다 연장)이고 갱신 API 가 없다 → 401 이면 바로 로그인 화면.
 *
 * 1. 로그인 영역에 들어갈 때: GET /me (screens/start/Guards.tsx RequireLogin)
 *    401 → 로그인 화면 (가려던 주소 기억) / nextStep ONBOARDING → 온보딩 1 / 그 밖 → 그대로 (NEW_TERM 의 새 학기 안내는 05 탐색 영역)
 * 2. 쓰는 중에 어느 API 든 401 (세션 만료 · 다른 기기에서 비밀번호 재설정 등), 실시간 연결의 인증 실패 → handleUnauthorized()
 *    → 내 계정 캐시를 "로그인 안 함"으로, 지금 주소를 기억하고, /login 으로 (주소창 기록을 덮어씀)
 * 3. 로그인 성공 → takeReturnTo() 로 기억한 주소 (nextStep 이 HOME 일 때만, api/auth pathAfterLogin)
 * LOGIN_FREE(지금, 팀 공유 빌드)인 동안은 1 · 2 가 동작하지 않는다 (401 이 와도 기록만)
 *
 * 화면 이동은 라우터를 직접 import 하면 순환 참조가 생겨서, main.tsx 가 registerNavigator(router.navigate) 로 넣어 줌.
 * 로그아웃 · 탈퇴 뒤 정리는 lib/signOut.ts
 */
type Nav = (to: string, opts?: { replace?: boolean; state?: unknown }) => void
let navigateFn: Nav | null = null
export function registerNavigator(fn: Nav) { navigateFn = fn }

const RETURN_KEY = 'digul.returnTo'
/** api/auth authKeys.me 와 같은 키 (여기서 api/auth 를 불러오면 고리가 생겨서 글자로) */
const ME_KEY = ['auth', 'me'] as const

/** 앱 안 주소 (해시 라우터면 # 뒤, 아니면 경로 + 쿼리) */
export function currentAppPath(): string {
  if (typeof window === 'undefined') return '/'
  const h = window.location.hash
  if (h.startsWith('#/')) return h.slice(1)
  return `${window.location.pathname}${window.location.search}`
}

const isStart = (p: string) => p === '/' || START_PATHS.some((s) => p === s || p.startsWith(`${s}/`) || p.startsWith(`${s}?`))

/** 돌아갈 주소로 써도 되는지: 앱 안 경로만 (//evil.com · https:// 같은 바깥 주소 막기), 시작 화면 · 온보딩은 빼기 */
export function safeReturnPath(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return null
  const path = p.split('?')[0]
  return isStart(path) || path.startsWith('/onboarding') ? null : p
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

/** 계정마다 다른 서버 데이터를 모두 버림 (내 계정 ['auth','me'] 과 공개 목록 ['common', …] 은 남김). 401 · 로그인 성공 때 */
export function dropUserData() {
  queryClient.removeQueries({ predicate: (q) => !(q.queryKey[0] === 'common' || (q.queryKey[0] === ME_KEY[0] && q.queryKey[1] === ME_KEY[1])) })
}

let handling = false
/**
 * 인증이 풀렸을 때 (REST 401, 실시간 연결의 인증 실패).
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
  setAuthState('guest') // 목 세션도 같이 (실제 서버에서는 쿠키가 이미 없음)
  queryClient.setQueryData(ME_KEY, null)
  rememberReturnTo(from)
  if (!isStart(from.split('?')[0])) {
    const state = { from: safeReturnPath(from) ?? undefined, toast: '다시 로그인해 주세요' }
    if (navigateFn) navigateFn('/login', { replace: true, state })
    else if (typeof window !== 'undefined') window.location.assign(window.location.hash.startsWith('#/') ? '#/login' : '/login')
  }
  // 이전 계정의 데이터를 다음 사람에게 보이지 않게: 화면이 로그인으로 넘어간 뒤(떠 있던 화면이 다시 불러와 401 을 또 받지 않게)
  // 받는 중인 요청을 멈추고 내 계정(null) · 공개 목록(common) 말고 모두 버림. 로그아웃은 lib/signOut afterSignOut 이 비움
  setTimeout(() => { void queryClient.cancelQueries(); dropUserData() }, 0)
  setTimeout(() => { handling = false }, 1000)
}

/**
 * 403 ONBOARDING_INCOMPLETE (02 "온보딩을 마치지 않은 계정"): 어느 API 에서 와도 온보딩 1 로.
 * 공용 QueryCache · MutationCache 의 onError 가 부름 (api/queryClient.ts onApiError, main.tsx 에서 끼움)
 */
export function handleOnboardingIncomplete() {
  if (LOGIN_FREE) return
  void queryClient.invalidateQueries({ queryKey: ME_KEY })
  if (!currentAppPath().startsWith('/onboarding')) navigateFn?.('/onboarding/name', { replace: true })
}
