/**
 * 인증이 풀리거나 다른 계정으로 로그인할 때 이전 계정의 데이터 캐시를 버리는지 (PR #37 Codex 리뷰 P0).
 * 같은 탭에서 A 의 세션이 끝나고 B 가 로그인해도 A 의 내 땅굴 · 계정 · 대화 목록이 보이면 안 됨
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../data/auth', async (orig) => ({ ...(await orig<typeof import('../data/auth')>()), LOGIN_FREE: false }))

const { queryClient } = await import('../api/queryClient')
const { dropUserData, handleUnauthorized, registerNavigator } = await import('../lib/authFlow')
const { afterSignOut } = await import('../lib/signOut')
const { outbox } = await import('../api/chat/outbox')
const { chatApi } = await import('../api/chat/api')
const { deliverPending } = await import('../api/chat/queries')

const pending = (clientId: string) => outbox.add({ clientId, roomId: '7', content: 'A 가 못 보낸 글', images: [], at: 1, status: 'failed', error: '연결' })

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

  it('보내지 못한 채팅 메시지(outbox)도 401 · 로그인 성공(dropUserData) · 로그아웃(afterSignOut) 때 비움 (Codex 리뷰 P0)', () => {
    pending('a1')
    dropUserData()
    expect(outbox.get('7')).toEqual([])
    pending('a2')
    afterSignOut()
    expect(outbox.get('7')).toEqual([])
  })

  it('계정이 바뀐 뒤 늦게 끝난 이전 계정의 전송 결과는 버림 (새 세션의 outbox · 메시지 캐시에 안 들어감)', async () => {
    let fail!: (e: unknown) => void
    const spy = vi.spyOn(chatApi, 'sendMessage').mockImplementation(() => new Promise((_, rej) => { fail = rej }))
    outbox.add({ clientId: 'b1', roomId: '7', content: '보내는 중', images: [], at: 1, status: 'sending' })
    const done = deliverPending(queryClient, 'b1')
    outbox.clear() // 이 사이 로그아웃 · 다른 계정 로그인
    fail(new Error('늦은 실패'))
    await done
    expect(outbox.get('7')).toEqual([])
    spy.mockRestore()
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
