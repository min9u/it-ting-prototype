/**
 * 목 서버: 지금 메모리 저장소(data/*Store.ts)를 "가짜 서버"로 쓴다.
 * 실제 서버와 같은 모양(DTO)·같은 실패(ApiError)를 내도록 지연·실패·빈 목록·404 를 흉내 낸다.
 * 손잡이는 api/config.ts (?api=slow|fast|fail|flaky|writefail|empty|notfound|unauth)
 */
import { ApiError, withRetry } from '../client'
import { hasKnob } from '../config'

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
const serialize = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

export const notFound = (what = '찾는 내용') => new ApiError(404, 'NOT_FOUND', `${what}이(가) 없어요.`)
export const conflict = (code: string, message: string) => new ApiError(409, code, message)
export const badRequest = (code: string, message: string) => new ApiError(400, code, message)
export const forbidden = (message = '볼 수 있는 권한이 없어요.') => new ApiError(403, 'FORBIDDEN', message)

interface ReadOpts<T> {
  signal?: AbortSignal
  /** 목록: ?api=empty 면 이 값을 돌려줌 */
  empty?: () => T
  /** 상세: ?api=notfound 면 404 */
  detail?: boolean
}

function injectFailure(kind: 'read' | 'write') {
  if (hasKnob('unauth')) throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요해요. (?api=unauth)')
  if (hasKnob('fail')) throw new ApiError(503, 'MOCK_FAIL', '서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해 주세요. (?api=fail)')
  if (kind === 'write' && hasKnob('writefail')) throw new ApiError(500, 'MOCK_WRITE_FAIL', '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요. (?api=writefail)')
  if (hasKnob('flaky') && Math.random() < 0.35) throw new ApiError(503, 'MOCK_FLAKY', '연결이 잠깐 끊겼어요. (?api=flaky)')
}

/** 읽기 (GET): 실제 클라이언트처럼 재시도 규칙을 따름 */
export function mockRead<T>(fn: () => T, o: ReadOpts<T> = {}): Promise<T> {
  return withRetry(async () => {
    await wait(delayMs(), o.signal)
    injectFailure('read')
    if (o.detail && hasKnob('notfound')) throw notFound()
    if (o.empty && hasKnob('empty')) return serialize(o.empty())
    return serialize(fn())
  }, { signal: o.signal })
}

/** 쓰기 (POST·PUT·PATCH·DELETE): 재시도하지 않음. fn 이 던진 ApiError(409 등)는 그대로 */
export async function mockWrite<T>(fn: () => T, signal?: AbortSignal): Promise<T> {
  await wait(delayMs(), signal)
  injectFailure('write')
  return serialize(fn())
}

/* ===== 목록 도우미 ===== */
/** 번호 페이지 */
export function paginate<T>(all: T[], page = 1, size = 20) {
  const totalItems = all.length
  const totalPages = Math.max(1, Math.ceil(totalItems / size))
  const p = Math.min(Math.max(1, page), totalPages)
  return { items: all.slice((p - 1) * size, p * size), page: p, size, totalItems, totalPages }
}
/** 커서 페이지 (목 서버의 커서 = 다음 시작 위치. 실제 서버는 (정렬 키, id) 를 담은 불투명 문자열) */
export function cursorPage<T>(all: T[], cursor: string | null | undefined, size = 20) {
  const start = cursor ? Math.max(0, Number(atob(cursor)) || 0) : 0
  const items = all.slice(start, start + size)
  const next = start + size < all.length ? btoa(String(start + size)) : null
  return { items, nextCursor: next }
}
export const emptyPage = (size = 20) => ({ items: [], page: 1, size, totalItems: 0, totalPages: 1 })
export const emptyCursor = () => ({ items: [], nextCursor: null })
