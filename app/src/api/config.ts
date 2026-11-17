/**
 * API 설정: 목(mock) ↔ 실제(real) 전환과 목 서버 손잡이(?api=…)
 *
 * - VITE_API_MODE=mock|real (기본 mock, 공유 빌드도 mock). real 이면 api/client.ts 로 실제 서버를 부름
 * - VITE_API_BASE: 실제 서버 주소 (기본 '/api' → 같은 출처 + Vite 프록시/Nginx 로 넘기는 것을 추천, 위험 B6)
 * - 손잡이: 주소에 ?api=slow 처럼 붙이면 목 서버가 느려지거나 실패한다. 여러 개는 쉼표로 (?api=slow,writefail)
 *   붙이면 이 탭(sessionStorage)에 기억해서 화면을 옮겨 다녀도 유지되고, ?api=off 로 끈다.
 *   해시 라우터(공유 빌드)에서는 #/meetups/m1?api=slow 처럼 해시 뒤에 붙여도 된다.
 */
import { ENV } from '../lib/env'

export type ApiMode = 'mock' | 'real'
export const API_MODE: ApiMode = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock'
export const API_BASE: string = ENV.apiBase
/** 실시간(STOMP) 주소 자리. 실시간 연결은 다른 작업에서 붙임 */
export const WS_URL: string = ENV.wsPath

/**
 * 목 서버 손잡이
 * - slow: 1.2~2.6초 지연 (스켈레톤 확인)
 * - fast: 지연 없음
 * - fail: 모든 요청 실패 (에러 + 다시 시도 확인)
 * - flaky: 요청 셋 중 하나꼴로 실패 (GET 자동 재시도 확인)
 * - writefail: 쓰기(POST·PUT·PATCH·DELETE)만 실패 (낙관적 업데이트 되돌림 + 토스트 확인)
 * - empty: 목록이 모두 비어서 옴 (빈 상태 확인)
 * - notfound: 상세가 모두 404 (진짜 없음 화면 확인)
 * - unauth: 모든 요청 401 (로그인 만료 처리 확인)
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
