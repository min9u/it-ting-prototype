/**
 * HTTP 클라이언트 (실제 서버용). 목 모드에서는 쓰지 않지만 에러 모양(ApiError)·재시도 규칙은 목 서버도 같이 씀.
 * 백엔드 확정 명세 v1 (docs/backend/team-spec/api-convention.md)
 *
 * - 주소: API_BASE(기본 '/api/v1') + 경로. 영역 코드는 '/meetups/12' 처럼 '/api/v1' 뒤만 쓴다
 * - credentials: 'include' (세션 쿠키 ITTING_SESSION). 토큰 · localStorage 는 쓰지 않음
 * - 응답 틀 { success, data, error } 를 풀어서 data 만 돌려줌. 목록도 data 그대로 ({ items, … })
 * - 실패는 모두 ApiError{status, code, message, fields, detail}. 네트워크 끊김 status 0 / code NETWORK, 타임아웃 status 0 / code TIMEOUT
 * - 401: 갱신 API 가 없으므로(세션은 쓸 때마다 14일 연장) 바로 onUnauthorized 훅 → 로그인 화면 (lib/authFlow)
 * - 재시도: GET 만, 네트워크·타임아웃·408/429/502/503/504 일 때 2번까지 (0.3초 → 0.9초). 쓰기는 재시도하지 않음(중복 등록 방지)
 */
import { API_BASE } from './config'
import type { ApiErrorBody, FieldError } from './common/types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** 입력 오류(400 INVALID_INPUT)일 때 칸마다 */
  readonly fields: FieldError[] | null
  /** 실패에 딸린 화면 값 (예: ACCOUNT_SUSPENDED 의 { reason, endsAt }) */
  readonly detail: Record<string, unknown> | null
  constructor(status: number, code: string, message: string, extra: { fields?: FieldError[] | null; detail?: Record<string, unknown> | null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = extra.fields ?? null
    this.detail = extra.detail ?? null
  }
}

/** 화면에서 쓰는 판별 */
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
/** 404 (대상 없음. 코드는 <대상>_NOT_FOUND) */
export const isNotFound = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 410)
export const isUnauthorized = (e: unknown) => isApiError(e) && e.status === 401
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
/** 다시 시도해 볼 만한 실패 (네트워크·타임아웃·서버 과부하) */
export const isRetryable = (e: unknown) => isApiError(e) && (e.status === 0 || e.status === 408 || e.status === 429 || e.status === 502 || e.status === 503 || e.status === 504)

/** 상태 코드별 기본 문구 (code 로 문구를 못 찾을 때. api/common/errors.ts 가 씀) */
const FALLBACK: Record<number, string> = {
  0: '연결이 고르지 않아요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  400: '입력한 내용을 다시 확인해 주세요.',
  401: '로그인이 필요해요.',
  403: '할 수 없는 일이에요.',
  404: '찾는 내용이 없어요.',
  409: '방금 다른 곳에서 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',
  413: '파일이 너무 커요.',
  429: '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  500: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
}
export const messageFor = (status: number) => FALLBACK[status] ?? FALLBACK[status >= 500 ? 500 : 400]

/** 상태 코드만 있을 때의 공통 코드 (명세 "공통 에러 코드") */
function codeForStatus(status: number) {
  switch (status) {
    case 400: return 'INVALID_INPUT'
    case 401: return 'UNAUTHENTICATED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 405: return 'METHOD_NOT_ALLOWED'
    case 415: return 'UNSUPPORTED_MEDIA_TYPE'
    case 429: return 'TOO_MANY_REQUESTS'
    default: return status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`
  }
}

/**
 * 실패 응답 본문 → ApiError. 명세의 틀 { success:false, data:null, error:{code,message,fields,detail} } 을 읽고,
 * 틀이 아닌 본문(Nginx 502 HTML 등)이어도 깨지지 않게 상태 코드로 채운다.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const env = (body && typeof body === 'object' ? body : {}) as { error?: Partial<ApiErrorBody> | null }
  const err = env.error && typeof env.error === 'object' ? env.error : {}
  const code = typeof err.code === 'string' && err.code ? err.code : codeForStatus(status)
  const message = typeof err.message === 'string' && err.message ? err.message : messageFor(status)
  const fields = Array.isArray(err.fields) ? err.fields : null
  const detail = err.detail && typeof err.detail === 'object' ? err.detail : null
  return new ApiError(status, code, message, { fields, detail })
}

/* ===== 훅 (앱이 시작할 때 채움) ===== */
let onUnauthorized: (() => void) | null = null
/** 401 을 받으면 부름 (로그인 화면으로 보내기 등. main.tsx 가 lib/authFlow 로 채움) */
export function setUnauthorizedHandler(f: (() => void) | null) { onUnauthorized = f }
/** 목 서버(?api=unauth)·react-query 전역 에러·실시간 연결에서도 같은 처리를 부를 때 */
export function notifyUnauthorized() { onUnauthorized?.() }

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
  /** JSON 본문. FormData 면 multipart 로 그대로 보냄 (POST /images) */
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  /** 401 이어도 onUnauthorized 를 부르지 않음 (로그인 · 내 계정 확인처럼 401 이 "로그인 안 함"이라는 답일 때) */
  quiet401?: boolean
}

/** 주소 만들기 (실시간 소식 연결도 씀). 배열 값은 같은 이름을 여러 번 (?categories=A&categories=B) */
export function buildUrl(path: string, query?: RequestOptions['query']) {
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
  const form = typeof FormData !== 'undefined' && o.body instanceof FormData
  if (o.body !== undefined && !form) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(buildUrl(path, o.query), {
      method, headers, credentials: 'include', signal: link.signal,
      body: o.body === undefined ? undefined : form ? (o.body as FormData) : JSON.stringify(o.body),
    })
  } catch (e) {
    if (link.timedOut()) throw new ApiError(0, 'TIMEOUT', '응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요.')
    if (isAbort(e)) throw e
    throw new ApiError(0, 'NETWORK', messageFor(0))
  } finally {
    link.done()
  }
  const text = await res.text()
  let body: unknown = null
  if (text) { try { body = JSON.parse(text) } catch { body = text } }
  if (!res.ok) throw toApiError(res.status, body)
  // 명세: 성공 응답도 항상 틀이 있음. 틀이 없으면(204 · 다른 서버) 본문을 그대로 (없으면 null)
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    const env = body as { success: boolean; data: unknown }
    if (env.success === false) throw toApiError(res.status, body)
    return env.data as T
  }
  return (body ?? null) as T
}

export async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
  const method = o.method ?? 'GET'
  const run = async () => {
    try { return await once<T>(path, o) } catch (e) {
      if (isUnauthorized(e) && !o.quiet401) onUnauthorized?.()
      throw e
    }
  }
  return method === 'GET' ? withRetry(run, { signal: o.signal }) : run()
}

type Rest = Omit<RequestOptions, 'method' | 'body'>
export const http = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal, o: Omit<Rest, 'query' | 'signal'> = {}) => request<T>(path, { ...o, query, signal }),
  post: <T>(path: string, body?: unknown, o: Rest = {}) => request<T>(path, { ...o, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, o: Rest = {}) => request<T>(path, { ...o, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, o: Rest = {}) => request<T>(path, { ...o, method: 'PATCH', body }),
  /** 명세: DELETE 도 본문 없이 응답 틀을 줌 (data 는 대개 null) */
  delete: <T = null>(path: string, o: Omit<RequestOptions, 'method'> = {}) => request<T>(path, { ...o, method: 'DELETE' }),
}

/** 경로 조각 (id · 토큰)을 안전하게 */
export const seg = (v: string | number) => encodeURIComponent(String(v))
