/**
 * 목 서버 바탕: 메모리 저장소(data/*Store.ts)를 "가짜 서버"로 쓴다.
 * 실제 서버와 같은 모양(명세 DTO)·같은 실패(ApiError, 명세 code)를 내도록 지연·실패·빈 목록·404 를 흉내 낸다.
 * 손잡이는 api/config.ts (?api=slow|fast|fail|flaky|writefail|empty|notfound|unauth)
 *
 * 영역 mock.ts 에서 쓰는 법
 *   get: (id, signal) => mockRead(() => { const m = findMeetup(toAppId(id)); if (!m) throw notFound('MEETUP'); return dto(m) }, { signal, detail: 'MEETUP' })
 *   apply: (id, body) => mockWrite(() => { if (full) throw conflict('MEETUP_FULL', '정원이 찼습니다.'); … })
 *   입력 오류: throw invalidInput({ nickname: '12자를 넘을 수 없습니다.' })
 *   목록: paginate(all, q.page, q.size ?? 20) · cursorPage(all, q.cursor, q.size ?? 20) · items(all)
 */
import { ApiError, withRetry } from '../client'
import { hasKnob } from '../config'
import type { CursorPageDto, FieldError, ItemsDto, PageDto } from '../common/types'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function delayMs() {
  if (hasKnob('fast')) return 0
  if (hasKnob('slow')) return rand(1200, 2600)
  return rand(150, 400)
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((res, rej) => {
    if (signal?.aborted) { rej(new DOMException('Aborted', 'AbortError')); return }
    const t = setTimeout(res, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

/** 서버가 JSON 으로 직렬화하는 것처럼 복사 (화면이 받은 값을 고쳐도 "서버" 값은 그대로) */
const serialize = <T,>(v: T): T => (v === undefined ? (null as T) : JSON.parse(JSON.stringify(v)))

/* ===== 명세 모양의 실패 ===== */
/** 404 <대상>_NOT_FOUND (target 은 대문자 'MEETUP' · 'POST' · 'USER' …) */
export const notFound = (target: string, message = '대상을 찾을 수 없습니다.') => new ApiError(404, `${target}_NOT_FOUND`, message)
/** 409 (중복 · 정원 참 · 이미 처리됨) */
export const conflict = (code: string, message: string, detail?: Record<string, unknown>) => new ApiError(409, code, message, { detail })
/** 400 + 영역 code (INVALID_INPUT 이 아닌 400) */
export const badRequest = (code: string, message: string) => new ApiError(400, code, message)
/** 400 INVALID_INPUT + fields. { 칸: 문구 } 또는 FieldError[] */
export function invalidInput(fields: Record<string, string> | FieldError[], message = '입력값이 올바르지 않습니다.') {
  const list = Array.isArray(fields) ? fields : Object.entries(fields).map(([field, msg]) => ({ field, message: msg }))
  return new ApiError(400, 'INVALID_INPUT', message, { fields: list })
}
/** 403 (기본 FORBIDDEN) */
export const forbidden = (message = '할 수 없는 일입니다.', code = 'FORBIDDEN', detail?: Record<string, unknown>) => new ApiError(403, code, message, { detail })
/** 401 UNAUTHENTICATED */
export const unauthenticated = (message = '로그인이 필요합니다.') => new ApiError(401, 'UNAUTHENTICATED', message)

interface ReadOpts<T> {
  signal?: AbortSignal
  /** 목록: ?api=empty 면 이 값을 돌려줌 */
  empty?: () => T
  /** 상세: ?api=notfound 면 404. 문자열이면 그 대상의 코드 (<대상>_NOT_FOUND), true 면 NOT_FOUND */
  detail?: boolean | string
}

function injectFailure(kind: 'read' | 'write') {
  if (hasKnob('unauth')) throw unauthenticated('로그인이 필요합니다. (?api=unauth)')
  if (hasKnob('fail')) throw new ApiError(500, 'INTERNAL_ERROR', '서버 오류입니다. (?api=fail)')
  if (kind === 'write' && hasKnob('writefail')) throw new ApiError(500, 'INTERNAL_ERROR', '저장하지 못했습니다. (?api=writefail)')
  // 연결이 잠깐 끊긴 것처럼 (status 0 → GET 은 자동 재시도)
  if (hasKnob('flaky') && Math.random() < 0.35) throw new ApiError(0, 'NETWORK', '연결이 잠깐 끊겼어요. (?api=flaky)')
}

/** 읽기 (GET): 실제 클라이언트처럼 재시도 규칙을 따름 */
export function mockRead<T>(fn: () => T, o: ReadOpts<T> = {}): Promise<T> {
  return withRetry(async () => {
    await wait(delayMs(), o.signal)
    injectFailure('read')
    if (o.detail && hasKnob('notfound')) throw typeof o.detail === 'string' ? notFound(o.detail) : new ApiError(404, 'NOT_FOUND', '대상을 찾을 수 없습니다. (?api=notfound)')
    if (o.empty && hasKnob('empty')) return serialize(o.empty())
    return serialize(fn())
  }, { signal: o.signal })
}

/** 쓰기 (POST·PUT·PATCH·DELETE): 재시도하지 않음. fn 이 던진 ApiError(409 등)는 그대로. 돌려줄 값이 없으면 null (명세: data null) */
export async function mockWrite<T>(fn: () => T, signal?: AbortSignal): Promise<T> {
  await wait(delayMs(), signal)
  injectFailure('write')
  return serialize(fn())
}

/* ===== 목록 도우미 (명세 "목록") ===== */
/** 나누지 않는 목록 { items } */
export const items = <T,>(all: T[]): ItemsDto<T> => ({ items: all })
/** 페이지 방식. page 는 1부터, 범위를 벗어나면 가까운 쪽으로 */
export function paginate<T>(all: T[], page = 1, size = 20): PageDto<T> {
  const totalItems = all.length
  const totalPages = Math.max(1, Math.ceil(totalItems / size))
  const p = Math.min(Math.max(1, page), totalPages)
  return { items: all.slice((p - 1) * size, p * size), page: p, size, totalItems, totalPages }
}
/** 커서 방식 (목 서버의 커서 = 다음 시작 위치를 base64 로. 실제 서버의 커서는 불투명 문자열이라 프론트는 해석하지 않음) */
export function cursorPage<T>(all: T[], cursor: string | null | undefined, size = 20): CursorPageDto<T> {
  const start = cursor ? Math.max(0, Number(atob(cursor)) || 0) : 0
  const page = all.slice(start, start + size)
  const hasNext = start + size < all.length
  return { items: page, nextCursor: hasNext ? btoa(String(start + size)) : null, hasNext }
}
export const emptyPage = <T = never,>(size = 20): PageDto<T> => ({ items: [], page: 1, size, totalItems: 0, totalPages: 1 })
export const emptyCursor = <T = never,>(): CursorPageDto<T> => ({ items: [], nextCursor: null, hasNext: false })
