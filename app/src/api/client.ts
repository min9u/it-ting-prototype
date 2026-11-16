/**
 * fetch 래퍼 (실제 서버용). 목 모드에서는 쓰지 않지만 에러 모양(ApiError)·재시도 규칙은 목 서버도 같이 씀.
 *
 * - 주소: API_BASE + 경로 (기본 '/api', 같은 출처 추천 → 위험 B6)
 * - JSON 주고받기, credentials: 'include' (HttpOnly 쿠키 세션을 가정. Bearer 로 정하면 authHeader 훅만 채우면 됨)
 * - 타임아웃(기본 10초) + 호출한 쪽 AbortSignal (react-query 가 화면을 떠나면 취소)
 * - 실패는 모두 ApiError{status, code, message} 로 맞춤. 네트워크 끊김 status 0 / code NETWORK, 타임아웃 code TIMEOUT
 * - 401: 리프레시를 한 번만 시도(동시에 여러 요청이 401 이어도 리프레시는 하나) → 실패하면 onUnauthorized 훅
 * - 재시도: GET 만, 네트워크·타임아웃·502/503/504 일 때 2번까지 (0.3초 → 0.9초). 쓰기는 재시도하지 않음(중복 등록 방지, 위험 B11)
 */
import { API_BASE } from './config'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string
  readonly fieldErrors?: ApiErrorBody['fieldErrors']
  readonly detail?: unknown
  constructor(status: number, code: string, message: string, extra: { traceId?: string; fieldErrors?: ApiErrorBody['fieldErrors']; detail?: unknown } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.traceId = extra.traceId
    this.fieldErrors = extra.fieldErrors
    this.detail = extra.detail
  }
}

/** 화면에서 쓰는 판별 */
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
export const isNotFound = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 410)
export const isUnauthorized = (e: unknown) => isApiError(e) && e.status === 401
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
/** 다시 시도해 볼 만한 실패 (네트워크·타임아웃·서버 과부하) */
export const isRetryable = (e: unknown) => isApiError(e) && (e.status === 0 || e.status === 408 || e.status === 429 || e.status === 502 || e.status === 503 || e.status === 504)

/** 상태 코드별 기본 문구 (서버가 message 를 안 줬을 때) */
const FALLBACK: Record<number, string> = {
  0: '연결이 고르지 않아요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  400: '입력한 내용을 다시 확인해 주세요.',
  401: '로그인이 필요해요.',
  403: '볼 수 있는 권한이 없어요.',
  404: '찾는 내용이 없어요.',
  409: '방금 다른 곳에서 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',
  413: '파일이 너무 커요.',
  429: '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  500: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
}
export const messageFor = (status: number) => FALLBACK[status] ?? FALLBACK[status >= 500 ? 500 : 400]

/** 응답 본문 → ApiError (서버가 규약과 다른 모양을 줘도 깨지지 않게) */
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body && typeof body === 'object' ? body : {}) as Partial<ApiErrorBody> & { error?: string }
  const code = typeof b.code === 'string' ? b.code : status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : `HTTP_${status}`
  const message = typeof b.message === 'string' && b.message ? b.message : messageFor(status)
  return new ApiError(status, code, message, { traceId: b.traceId, fieldErrors: b.fieldErrors, detail: body })
}

/* ===== 훅 (앱이 시작할 때 채움) ===== */
let onUnauthorized: (() => void) | null = null
/** 401 이 리프레시로도 안 풀리면 부름 (로그인 화면으로 보내기 등) */
export function setUnauthorizedHandler(f: (() => void) | null) { onUnauthorized = f }
/** 목 서버(?api=unauth)·react-query 전역 에러에서도 같은 처리를 부를 때 */
export function notifyUnauthorized() { onUnauthorized?.() }
let authHeader: (() => string | null) | null = null
/** Bearer 방식으로 정하면 여기서 "Bearer …" 를 돌려줌 (쿠키 방식이면 비워 둠) */
export function setAuthHeaderProvider(f: (() => string | null) | null) { authHeader = f }

/* ===== 재시도 (GET 만) ===== */
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')) }, { once: true })
})
export async function withRetry<T>(run: () => Promise<T>, opts: { retries?: number; signal?: AbortSignal } = {}): Promise<T> {
  const retries = opts.retries ?? 2
  for (let i = 0; ; i++) {
    try { return await run() } catch (e) {
      if (i >= retries || !isRetryable(e) || opts.signal?.aborted) throw e
      await sleep(300 * 3 ** i, opts.signal)
    }
  }
}

/* ===== 요청 ===== */
type QueryValue = string | number | boolean | null | undefined | (string | number)[]
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  /** 쓰기 중복 방지 (서버가 지원하면). 같은 동작을 다시 보낼 때 같은 값 */
  idempotencyKey?: string
  /** 401 이어도 리프레시를 시도하지 않음 (로그인·리프레시 자신) */
  skipAuthRefresh?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v == null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)))
    else qs.set(k, String(v))
  }
  const s = qs.toString()
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${s ? `?${s}` : ''}`
}

/** 바깥 signal + 타임아웃을 하나로 */
function linkSignals(outer: AbortSignal | undefined, timeoutMs: number) {
  const ctrl = new AbortController()
  let timedOut = false
  const t = setTimeout(() => { timedOut = true; ctrl.abort() }, timeoutMs)
  const onAbort = () => ctrl.abort()
  if (outer) { if (outer.aborted) ctrl.abort(); else outer.addEventListener('abort', onAbort, { once: true }) }
  return { signal: ctrl.signal, timedOut: () => timedOut, done: () => { clearTimeout(t); outer?.removeEventListener('abort', onAbort) } }
}

async function once<T>(path: string, o: RequestOptions): Promise<T> {
  const method = o.method ?? 'GET'
  const link = linkSignals(o.signal, o.timeoutMs ?? 10_000)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (o.body !== undefined) headers['Content-Type'] = 'application/json'
  if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey
  const auth = authHeader?.()
  if (auth) headers.Authorization = auth
  let res: Response
  try {
    res = await fetch(buildUrl(path, o.query), {
      method, headers, credentials: 'include', signal: link.signal,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    })
  } catch (e) {
    if (link.timedOut()) throw new ApiError(0, 'TIMEOUT', '응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요.')
    if (isAbort(e)) throw e
    throw new ApiError(0, 'NETWORK', messageFor(0))
  } finally {
    link.done()
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let body: unknown = null
  if (text) { try { body = JSON.parse(text) } catch { body = text } }
  if (!res.ok) throw toApiError(res.status, body)
  return body as T
}

/* 리프레시: 동시에 여러 요청이 401 이어도 하나만 (위험 B5) */
let refreshing: Promise<boolean> | null = null
function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    const p = once<void>('/auth/refresh', { method: 'POST', skipAuthRefresh: true }).then(() => true, () => false)
    refreshing = p
    void p.then(() => { refreshing = null })
  }
  return refreshing
}

export async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
  const method = o.method ?? 'GET'
  const run = async () => {
    try { return await once<T>(path, o) } catch (e) {
      if (!isUnauthorized(e) || o.skipAuthRefresh) throw e
      if (await refreshOnce()) return once<T>(path, o)
      onUnauthorized?.()
      throw e
    }
  }
  return method === 'GET' ? withRetry(run, { signal: o.signal }) : run()
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, o: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...o, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, o: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...o, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, o: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...o, method: 'PATCH', body }),
  delete: <T = void>(path: string, o: Omit<RequestOptions, 'method'> = {}) => request<T>(path, { ...o, method: 'DELETE' }),
}

/** 같은 동작을 다시 보낼 때 같은 값을 쓰도록 화면에서 만들어 둠 */
export const newIdempotencyKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
