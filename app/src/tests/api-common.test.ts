/**
 * 공통 API 계층 (명세 v1 api-convention.md): 응답 틀 풀기 · 에러 모양 · 401 처리 · id 바꾸기 · 목록 모양 · 에러 문구
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, http, isNotFound, isUnauthorized, setUnauthorizedHandler, toApiError } from '../api/client'
import { MOCK_ID_BASE, toAppId, toDtoId } from '../api/common/ids'
import { errorText } from '../api/common/errors'
import { cursorPage, emptyCursor, invalidInput, notFound, paginate } from '../api/mock/server'
import { commonApi } from '../api/common'
import { toCampuses } from '../api/common/mappers'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals(); setUnauthorizedHandler(null) })

describe('HTTP 클라이언트', () => {
  it('주소는 /api/v1 + 경로, 쿠키를 함께 보내고, 성공 틀에서 data 만 돌려줌', async () => {
    const f = vi.fn(async () => json(200, { success: true, data: { items: [{ generation: 15 }] }, error: null }))
    vi.stubGlobal('fetch', f)
    const r = await http.get<{ items: { generation: number }[] }>('/generations', { a: 1, b: ['x', 'y'], c: null })
    expect(r).toEqual({ items: [{ generation: 15 }] })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/generations?a=1&b=x&b=y')
    expect(init.credentials).toBe('include')
  })
  it('data 가 null 인 성공(로그아웃 등)은 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true, data: null, error: null })))
    expect(await http.delete('/sessions/current')).toBeNull()
  })
  it('실패 틀 → ApiError{status, code, message, fields, detail}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(400, { success: false, data: null, error: { code: 'INVALID_INPUT', message: '입력값이 올바르지 않습니다.', fields: [{ field: 'nickname', message: '12자를 넘을 수 없습니다.' }], detail: null } })))
    const e = await http.post('/nicknames/check', { nickname: 'x' }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 400, code: 'INVALID_INPUT', fields: [{ field: 'nickname', message: '12자를 넘을 수 없습니다.' }], detail: null })
    expect(errorText(e)).toBe('12자를 넘을 수 없습니다.')
  })
  it('틀이 아닌 실패 본문(Nginx 502 HTML)도 상태 코드로 채움', () => {
    const e = toApiError(502, '<html>Bad Gateway</html>')
    expect(e.code).toBe('INTERNAL_ERROR')
    expect(toApiError(404, null).code).toBe('NOT_FOUND')
  })
  it('401 은 갱신 없이 바로 onUnauthorized (quiet401 이면 부르지 않음)', async () => {
    const f = vi.fn(async () => json(401, { success: false, data: null, error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.', fields: null, detail: null } }))
    vi.stubGlobal('fetch', f)
    const onU = vi.fn()
    setUnauthorizedHandler(onU)
    const e = await http.post('/meetups/1/like').catch((x) => x)
    expect(isUnauthorized(e)).toBe(true)
    expect(onU).toHaveBeenCalledTimes(1)
    expect(f).toHaveBeenCalledTimes(1) // 갱신(refresh) 요청 없음
    await http.get('/me', undefined, undefined, { quiet401: true }).catch(() => {})
    expect(onU).toHaveBeenCalledTimes(1)
  })
  it('GET 은 네트워크 오류 · 503 에 다시 시도, 쓰기는 다시 시도하지 않음', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => (++n < 2 ? json(503, null) : json(200, { success: true, data: 1, error: null }))))
    expect(await http.get('/campuses')).toBe(1)
    const f = vi.fn(async () => json(503, null))
    vi.stubGlobal('fetch', f)
    await http.post('/meetups').catch(() => {})
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('id 바꾸기 (DTO 숫자 ↔ 앱 문자열)', () => {
  it('실제 서버 id 는 그냥 숫자 ↔ 숫자 글자', () => {
    expect(toAppId(31)).toBe('31')
    expect(toDtoId('31')).toBe(31)
    expect(toAppId(null)).toBe('')
  })
  it('목 저장소의 글자 id 는 큰 번호로 바뀌고 되돌아옴 (같은 글자는 같은 번호)', () => {
    const n = toDtoId('m1')
    expect(n).toBeGreaterThan(MOCK_ID_BASE)
    expect(toDtoId('m1')).toBe(n)
    expect(toDtoId('yerin')).not.toBe(n)
    expect(toAppId(n)).toBe('m1')
    expect(toAppId(toDtoId('서울|2'))).toBe('서울|2')
  })
})

describe('목 서버 바탕', () => {
  it('페이지 방식: page 는 1부터, 범위 밖이면 가까운 쪽', () => {
    const p = paginate([1, 2, 3, 4, 5], 2, 2)
    expect(p).toEqual({ items: [3, 4], page: 2, size: 2, totalItems: 5, totalPages: 3 })
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, size: 20, totalItems: 0, totalPages: 1 })
  })
  it('커서 방식: hasNext · nextCursor, 마지막이면 null/false', () => {
    const a = cursorPage([1, 2, 3], null, 2)
    expect(a).toMatchObject({ items: [1, 2], hasNext: true })
    const b = cursorPage([1, 2, 3], a.nextCursor, 2)
    expect(b).toEqual({ items: [3], nextCursor: null, hasNext: false })
    expect(emptyCursor()).toEqual({ items: [], nextCursor: null, hasNext: false })
  })
  it('명세 모양의 실패: <대상>_NOT_FOUND · INVALID_INPUT + fields', () => {
    const e = notFound('MEETUP')
    expect([e.status, e.code]).toEqual([404, 'MEETUP_NOT_FOUND'])
    expect(isNotFound(e)).toBe(true)
    expect(invalidInput({ 'mole.head': '없는 아이템입니다.' }).fields).toEqual([{ field: 'mole.head', message: '없는 아이템입니다.' }])
  })
  it('공통 목 API: 캠퍼스 · 기수 (명세 모양: 숫자 id, items)', async () => {
    vi.useFakeTimers()
    const pc = commonApi.campuses()
    const pg = commonApi.generations()
    await vi.runAllTimersAsync()
    const c = await pc, g = await pg
    vi.useRealTimers()
    expect(c.items[0].name).toBe('서울')
    for (const x of c.items) { expect(typeof x.id).toBe('number'); for (const f of x.floors) expect(typeof f.id).toBe('number') }
    expect(toCampuses(c)[0].floors.map((f) => f.id)).toContain('서울|2')
    expect(g.items.map((x) => x.generation)).toEqual([...g.items.map((x) => x.generation)].sort((a, b) => b - a))
  })
})

describe('에러 문구 (code → 화면)', () => {
  it('영역 표 → 공통 표 → 서버 message', () => {
    const e = new ApiError(409, 'MEETUP_FULL', '정원이 찼습니다.')
    expect(errorText(e, { MEETUP_FULL: '정원이 다 찼어요.' })).toBe('정원이 다 찼어요.')
    expect(errorText(e)).toBe('정원이 찼습니다.')
    expect(errorText(new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe('서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.')
  })
})

describe('공용 QueryClient 의 오류 처리 (api/queryClient.ts)', () => {
  it('401 은 로그인 화면으로, meta.quiet401 이면 안 함 · 403 ONBOARDING_INCOMPLETE 는 온보딩 처리', async () => {
    const { queryClient, setOnboardingIncompleteHandler } = await import('../api/queryClient')
    const unauth = vi.fn(), onboarding = vi.fn()
    setUnauthorizedHandler(unauth)
    setOnboardingIncompleteHandler(onboarding)
    const run = (e: ApiError, meta?: Record<string, unknown>) =>
      queryClient.getMutationCache().build(queryClient, { mutationFn: () => Promise.reject(e), meta }).execute(undefined).catch(() => {})
    await run(new ApiError(401, 'LOGIN_FAILED', '실패'), { quiet401: true })
    expect(unauth).not.toHaveBeenCalled()
    await run(new ApiError(401, 'UNAUTHENTICATED', '로그인 필요'))
    expect(unauth).toHaveBeenCalledTimes(1)
    await run(new ApiError(403, 'ONBOARDING_INCOMPLETE', '온보딩'))
    expect(onboarding).toHaveBeenCalledTimes(1)
    await run(new ApiError(403, 'FORBIDDEN', '권한'))
    expect(onboarding).toHaveBeenCalledTimes(1)
    setUnauthorizedHandler(null); setOnboardingIncompleteHandler(null)
  })
})
