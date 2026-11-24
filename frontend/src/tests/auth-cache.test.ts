/**
 * 인증이 풀리거나 다른 계정으로 로그인할 때 이전 계정의 데이터 캐시를 버리는지 (PR #37 Codex 리뷰 P0).
 * 같은 탭에서 A 의 세션이 끝나고 B 가 로그인해도 A 의 내 땅굴 · 계정 · 대화 목록이 보이면 안 됨
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../data/auth', async (orig) => ({ ...(await orig<typeof import('../data/auth')>()), LOGIN_FREE: false }))

const { queryClient } = await import('../api/queryClient')
const { dropUserData, handleUnauthorized, registerNavigator } = await import('../lib/authFlow')

const fill = () => {
  queryClient.setQueryData(['auth', 'me'], { userId: '1', nextStep: 'HOME' })
  queryClient.setQueryData(['common', 'campuses'], [{ id: '1' }])
  queryClient.setQueryData(['burrow', 'me'], { owner: { nickname: 'A' } })
  queryClient.setQueryData(['settings', 'account'], { email: 'a@ssafy.com' })
  queryClient.setQueryData(['chat', 'rooms'], [{ id: '9' }])
}

describe('이전 계정의 데이터 캐시', () => {
  beforeEach(() => { queryClient.clear(); fill() })

  it('dropUserData: 계정마다 다른 캐시는 모두 버리고 내 계정 · 공개 목록(common)만 남김', () => {
    dropUserData()
    expect(queryClient.getQueryData(['burrow', 'me'])).toBeUndefined()
    expect(queryClient.getQueryData(['settings', 'account'])).toBeUndefined()
    expect(queryClient.getQueryData(['chat', 'rooms'])).toBeUndefined()
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual({ userId: '1', nextStep: 'HOME' })
    expect(queryClient.getQueryData(['common', 'campuses'])).toEqual([{ id: '1' }])
  })

  it('401 (handleUnauthorized): 로그인으로 보낸 뒤 내 계정은 null, 다른 계정 데이터는 버림', async () => {
    vi.useFakeTimers()
    const go = vi.fn()
    registerNavigator(go)
    window.history.pushState({}, '', '/burrow') // 로그인 영역 화면에 있다가 401
    handleUnauthorized('test')
    expect(go).toHaveBeenCalledWith('/login', expect.objectContaining({ replace: true }))
    expect(queryClient.getQueryData(['auth', 'me'])).toBeNull()
    await vi.runAllTimersAsync()
    expect(queryClient.getQueryData(['burrow', 'me'])).toBeUndefined()
    expect(queryClient.getQueryData(['chat', 'rooms'])).toBeUndefined()
    expect(queryClient.getQueryData(['common', 'campuses'])).toEqual([{ id: '1' }])
    vi.useRealTimers()
  })
})
