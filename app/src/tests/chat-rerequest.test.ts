/**
 * F6-B2 거절한 요청에 다시 요청하면 수락 처리 (팀 명세 06 받은 요청 5 · 05 대화 요청 팝업 3 · api 06 "내가 거절한 요청이 남아 있는 사람")
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Chat from '../data/chat'
import { ME_ID } from '../data/mock'

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-11-03T12:00:00+09:00').getTime()
let C: typeof Chat
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  vi.resetModules()
  C = await import('../data/chat')
})
afterEach(() => { vi.useRealTimers() })

describe('받은 요청을 거절하면', () => {
  it('내 받은 요청 목록 · 숫자에서 빠지고, 대화방은 안 생김', () => {
    const n = C.receivedCount()
    C.rejectRequest('q1')
    expect(C.receivedCount()).toBe(n - 1)
    expect(C.liveRequests().some((r) => r.id === 'q1')).toBe(false)
    expect(C.dmRoomWith('seobeok')).toBeUndefined()
  })
  it('거절한 요청은 만료 전까지 "거절한 요청"으로 남고, 만료되면 사라짐', () => {
    C.rejectRequest('q1')
    expect(C.rejectedFrom('seobeok')?.id).toBe('q1')
    vi.setSystemTime(T0 + 5 * DAY + 1000)
    expect(C.rejectedFrom('seobeok')).toBeUndefined()
  })
  it('보낸 요청(내가 보낸 것)에는 거절이 없음: rejectRequest 는 받은 요청에만', () => {
    C.rejectRequest('q3') // yejin 에게 내가 보낸 요청
    expect(C.rejectedFrom('yejin')).toBeUndefined()
    expect(C.sentRequestTo('yejin')?.id).toBe('q3')
  })
})

describe('거절한 사람에게 내가 다시 요청하면', () => {
  it('새 요청을 만들지 않고 거절했던 요청을 수락 → 바로 1:1 대화방이 열림, 내 인사는 첫 메시지', () => {
    C.rejectRequest('q1')
    const before = C.getChatState().requests.length
    const room = C.sendRequest('seobeok', '지난번엔 죄송해요, 같이 그려요!')
    expect(room).toBe('r-seobeok')
    expect(C.dmRoomWith('seobeok')?.id).toBe(room)
    expect(C.sentRequestTo('seobeok')).toBeUndefined() // 보낸 요청이 새로 생기지 않음
    expect(C.getChatState().requests.length).toBe(before - 1) // 거절했던 요청이 수락돼 없어짐
    const texts = C.roomOf(room!)!.messages.map((m) => [m.authorId, m.text])
    expect(texts[0][1]).toMatch(/대화 요청을 수락했어요/)
    expect(texts).toContainEqual(['seobeok', '땅굴에 이젤 있는 거 보고 반가워서요! 주말에 같이 드로잉해요'])
    expect(C.lastMsg(C.roomOf(room!)!)).toMatchObject({ authorId: ME_ID, text: '지난번엔 죄송해요, 같이 그려요!' })
  })
  it('인사가 없으면 내 메시지는 안 들어감', () => {
    C.rejectRequest('q2')
    const room = C.sendRequest('ha', '')!
    expect(C.roomOf(room)!.messages.some((m) => m.authorId === ME_ID)).toBe(false)
  })
  it('거절한 요청이 만료됐으면 평범한 새 요청', () => {
    C.rejectRequest('q1')
    vi.setSystemTime(T0 + 5 * DAY + 1000)
    expect(C.sendRequest('seobeok', '안녕하세요')).toBeNull()
    expect(C.sentRequestTo('seobeok')).toBeDefined()
    expect(C.dmRoomWith('seobeok')).toBeUndefined()
  })
  it('거절하지 않은(아직 답 안 한) 받은 요청이 있는 사람은 그대로 막힘 (새 요청도 대화방도 안 만듦)', () => {
    expect(C.sendRequest('seobeok', '안녕')).toBeNull()
    expect(C.sentRequestTo('seobeok')).toBeUndefined()
    expect(C.dmRoomWith('seobeok')).toBeUndefined()
  })
  it('받은 요청 수락 경로로는 거절한 요청을 되살리지 못함 (목 서버: 목록에 없어 404)', async () => {
    C.rejectRequest('q1')
    const { chat } = await import('../api/chat')
    await expect(chat.acceptRequest('q1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('목 서버 응답 (POST /chat-requests)', () => {
  it('거절한 요청이 남은 사람: chatRoomId 가 오고 요청 값은 null', async () => {
    const { chat } = await import('../api/chat')
    await chat.declineRequest('q1')
    const r = await chat.sendRequest('seobeok', '다시 인사드려요', 'BURROW_VISIT')
    expect(r).toEqual({ chatRequestId: null, createdAt: null, expiresAt: null, chatRoomId: 'r-seobeok' })
  })
  it('평범한 새 요청: chatRoomId 는 null, 요청 값이 있음', async () => {
    const { chat } = await import('../api/chat')
    const r = await chat.sendRequest('mingu', '안녕하세요', 'BURROW_VISIT').catch((e: unknown) => e)
    // mingu 와는 이미 대화방이 있음 → 409. 다른 사람으로 확인
    expect((r as { code?: string }).code).toBe('ROOM_EXISTS')
    const ok = await chat.sendRequest('lee', '안녕하세요', 'BURROW_VISIT')
    expect(ok.chatRoomId).toBeNull()
    expect(ok.chatRequestId).toBeTruthy()
  })
})
