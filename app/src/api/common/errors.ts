/**
 * 에러 code → 화면 문구. 명세: "화면에 보여 줄 문구는 프론트엔드가 code 를 보고 정한다", message 글자로 분기하지 않는다.
 *
 * 영역마다 api/<영역>/errors.ts 에 표 하나 (ErrorTable). 화면 · 훅은 errorText(e, 영역 표) 로 문구를 얻는다.
 * 찾는 순서: 영역 표 → 공통 표(아래) → 입력 오류면 첫 칸의 message → 서버 message → 상태 코드별 기본 문구
 * (서버 message 는 "개발자가 읽는 한국어 설명"이라 표에 없을 때의 마지막 대비로만 씀)
 */
import { isApiError, messageFor } from '../client'

/** code → 문구 */
export type ErrorTable = Readonly<Record<string, string>>

/** 공통 에러 코드 (api-convention.md "공통 에러 코드") + 클라이언트가 만드는 코드 */
export const COMMON_ERRORS: ErrorTable = {
  UNAUTHENTICATED: '로그인이 필요해요. 다시 로그인해 주세요.',
  NOT_FOUND: '찾는 내용이 없어요.',
  METHOD_NOT_ALLOWED: '지금은 할 수 없는 요청이에요.',
  UNSUPPORTED_MEDIA_TYPE: '보낼 수 없는 형식이에요.',
  TOO_MANY_REQUESTS: '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  INTERNAL_ERROR: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
  // 02 인증: 어느 화면에서든 받을 수 있음
  ONBOARDING_INCOMPLETE: '온보딩을 마친 뒤에 이용할 수 있어요.',
  NEW_TERM_INCOMPLETE: '이번 학기의 캠퍼스와 층을 먼저 골라 주세요.',
  // 클라이언트 (api/client.ts)
  NETWORK: '연결이 고르지 않아요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  TIMEOUT: '응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요.',
}

/** 에러 → 화면 문구 */
export function errorText(e: unknown, table: ErrorTable = {}): string {
  if (!isApiError(e)) return '잠시 뒤 다시 시도해 주세요.'
  const byCode = table[e.code] ?? COMMON_ERRORS[e.code]
  if (byCode) return byCode
  if (e.code === 'INVALID_INPUT' && e.fields?.length) return e.fields[0].message
  return e.message || messageFor(e.status)
}

/** 입력 오류에서 그 칸의 문구 (없으면 null). field 는 요청 JSON 경로 */
export function fieldErrorText(e: unknown, field: string): string | null {
  return isApiError(e) ? e.fields?.find((f) => f.field === field)?.message ?? null : null
}
