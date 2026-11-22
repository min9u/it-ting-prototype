/**
 * id 바꾸기: DTO 는 숫자, 앱 모양(화면 · 주소 · data/*Store)은 문자열.
 *
 * 규칙 (docs/backend/api-v1-foundation.md "id")
 * - 실제 서버: 숫자 31 ↔ 문자열 "31". 그냥 String / Number
 * - 목 서버: 목 저장소(data/*)의 id 는 'm1' · 'yerin' · '서울|2' 처럼 글자라 숫자로 못 바꿈.
 *   그래서 목 서버가 DTO 를 만들 때 toDtoId('m1') 을 부르면 큰 번호(MOCK_ID_BASE 위)를 하나 정해 표에 적어 두고,
 *   mappers 가 toAppId(그 번호) 를 부르면 표에서 'm1' 을 돌려준다 (되돌릴 수 있는 표).
 *   → 화면 · 주소 · 저장소는 지금처럼 'm1' 을 쓰고, DTO 는 명세처럼 숫자만 담는다.
 * - 목 번호는 MOCK_ID_BASE(9×10¹¹) 위라 실제 서버 id 와 겹치지 않는다 (영역마다 real/mock 을 섞어 써도 안전).
 *   숫자 글자("42")는 표를 거치지 않고 42 그대로.
 * - 표는 이 탭 안에서만 유지된다. 목 번호를 주소 · 저장소에 넣지 말 것 (넣을 것은 toAppId 결과)
 */
import type { Id } from './types'

export const MOCK_ID_BASE = 900_000_000_000

const byKey = new Map<string, number>()
const byNum = new Map<number, string>()
let next = MOCK_ID_BASE + 1

const DIGITS = /^\d{1,15}$/

/** 앱 id(문자열) → DTO id(숫자). 요청 경로 · 본문에 넣을 때, 목 서버가 응답을 만들 때 */
export function toDtoId(appId: string | number): Id {
  if (typeof appId === 'number') return appId
  if (DIGITS.test(appId)) return Number(appId)
  let n = byKey.get(appId)
  if (n == null) {
    n = next++
    byKey.set(appId, n)
    byNum.set(n, appId)
  }
  return n
}

/** DTO id(숫자) → 앱 id(문자열). 목 번호면 원래 글자 id. null · undefined 는 '' */
export function toAppId(id: Id | string | null | undefined): string {
  if (id == null) return ''
  if (typeof id === 'string') return id
  return byNum.get(id) ?? String(id)
}

/** 없으면 null 그대로 (선택 칸) */
export const toAppIdOrNull = (id: Id | null | undefined): string | null => (id == null ? null : toAppId(id))
export const toDtoIdOrNull = (id: string | null | undefined): Id | null => (id == null || id === '' ? null : toDtoId(id))
