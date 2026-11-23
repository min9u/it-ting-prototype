/**
 * API 설정: 목(mock) ↔ 실제(real) 전환과 목 서버 손잡이(?api=…)
 *
 * - NEXT_PUBLIC_API_MODE=mock|real (기본 mock, 공유 빌드도 mock). 모든 영역의 기본값
 * - NEXT_PUBLIC_API_REAL_AREAS=common,auth  → 이 영역만 실제 서버 (백엔드가 구현한 영역부터 하나씩 켬)
 * - NEXT_PUBLIC_API_MOCK_AREAS=chat,meetups → NEXT_PUBLIC_API_MODE=real 이어도 이 영역은 목
 *   영역 이름은 AREAS. 실시간 소식 연결(SSE)은 이름 'events'
 * - NEXT_PUBLIC_API_BASE: 실제 서버 주소 (기본 '/api/v1' → 같은 출처 + next.config rewrites/Nginx). 영역 코드는 '/meetups' 처럼 뒤만 씀
 * - 손잡이: 주소에 ?api=slow 처럼 붙이면 목 서버가 느려지거나 실패한다. 여러 개는 쉼표로 (?api=slow,writefail)
 *   붙이면 이 탭(sessionStorage)에 기억해서 화면을 옮겨 다녀도 유지되고, ?api=off 로 끈다.
 *   해시 라우터(공유 빌드)에서는 #/meetups/m1?api=slow 처럼 해시 뒤에 붙여도 된다.
 */
import { ENV } from '../lib/env'

export type ApiMode = 'mock' | 'real'
/** 모든 영역의 기본 방식 */
export const API_MODE: ApiMode = ENV.apiMode
export const API_BASE: string = ENV.apiBase

/**
 * 영역 (= api/<영역>/ 폴더 하나 = 작업자 하나의 범위). 명세 문서 번호와의 관계는 docs/backend/api-v1-foundation.md
 * - common: 00 공통 (캠퍼스 · 기수) + 실시간 소식 연결
 * - auth: 02 로그인 · 회원가입 / settings: 10 설정 · 계정
 * - onboarding: 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) / burrow: 04 내 땅굴
 * - explore: 05 탐색 · 방문 (+ 00 학기) / chat: 06 / meetups: 07 / community: 08 (신고 · 사진 포함) / notifications: 09
 * - admin: 11 운영 · 관리자 (명세 보류, 그대로 둠)
 */
export const AREAS = ['common', 'auth', 'settings', 'onboarding', 'burrow', 'explore', 'chat', 'meetups', 'community', 'notifications', 'admin'] as const
export type Area = (typeof AREAS)[number]
/** 영역 + 실시간 소식 연결 */
export type ModeKey = Area | 'events'

/** 이 영역을 실제 서버로 부르는지 */
export function areaMode(key: ModeKey): ApiMode {
  if (ENV.apiRealAreas.has(key)) return 'real'
  if (ENV.apiMockAreas.has(key)) return 'mock'
  return API_MODE
}
/** 한 영역이라도 목이면 true (손잡이 배지 · 목 저장소 동기화가 이 값을 봄) */
export const ANY_MOCK = [...AREAS, 'events' as const].some((a) => areaMode(a) === 'mock')

/** 영역의 real · mock 구현 중 하나를 고름. 두 구현은 같은 타입이어야 함 (영역 api.ts 에서 한 번만 부름) */
export function selectArea<T>(area: Area, real: T, mock: T): T {
  return areaMode(area) === 'real' ? real : mock
}

/**
 * 목 서버 손잡이
 * - slow: 1.2~2.6초 지연 (스켈레톤 확인)
 * - fast: 지연 없음
 * - fail: 모든 요청 실패 500 INTERNAL_ERROR (에러 + 다시 시도 확인)
 * - flaky: 요청 셋 중 하나꼴로 연결 끊김 (GET 자동 재시도 확인)
 * - writefail: 쓰기(POST·PUT·PATCH·DELETE)만 500 INTERNAL_ERROR (낙관적 업데이트 되돌림 + 토스트 확인)
 * - empty: 목록이 모두 비어서 옴 (빈 상태 확인)
 * - notfound: 상세가 모두 404 <대상>_NOT_FOUND (진짜 없음 화면 확인)
 * - unauth: 모든 요청 401 UNAUTHENTICATED (로그인 만료 처리 확인)
 */
export const KNOBS = ['slow', 'fast', 'fail', 'flaky', 'writefail', 'empty', 'notfound', 'unauth'] as const
export type Knob = (typeof KNOBS)[number]

const KEY = 'digul.api.knobs'

function queryValue(): string | null {
  if (typeof window === 'undefined') return null
  const fromSearch = new URLSearchParams(window.location.search).get('api')
  if (fromSearch != null) return fromSearch
  const h = window.location.hash
  const i = h.indexOf('?')
  return i >= 0 ? new URLSearchParams(h.slice(i + 1)).get('api') : null
}

let cache: { raw: string; knobs: Set<Knob> } | null = null

/** 지금 켜진 손잡이 (주소 → 없으면 이 탭에 기억한 값) */
export function activeKnobs(): Set<Knob> {
  const q = queryValue()
  let raw: string
  if (q != null) {
    raw = q === 'off' || q === '' ? '' : q
    try { if (raw) sessionStorage.setItem(KEY, raw); else sessionStorage.removeItem(KEY) } catch { /* 저장소가 막힌 곳 */ }
  } else {
    try { raw = sessionStorage.getItem(KEY) ?? '' } catch { raw = '' }
  }
  if (cache?.raw === raw) return cache.knobs
  const knobs = new Set(raw.split(',').map((x) => x.trim()).filter((x): x is Knob => (KNOBS as readonly string[]).includes(x)))
  cache = { raw, knobs }
  return knobs
}
export const hasKnob = (k: Knob) => activeKnobs().has(k)
/** 손잡이 끄기 (손잡이 배지의 ✕) */
export function clearKnobs() {
  try { sessionStorage.removeItem(KEY) } catch { /* 무시 */ }
  cache = { raw: '', knobs: new Set() }
}
