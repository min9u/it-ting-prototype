/**
 * 채팅 규칙 (data/chat.ts)
 * 근거: 02 F6 (docs/chat-f6.md) · 00 공통 14 · 00 공통 8
 * - 대화방은 요청이 수락돼야 생김 · 요청은 5일 지나면 만료 · 거절·취소는 상대에게 알리지 않음
 * - 1:1 나가기 → 내 목록에서 사라짐 · 상대가 나감/탈퇴 → 읽기 전용
 * - 모임 대화 = 참여 확정자 + 주최자, 모임 나가기 = 참여 취소 (24시간 전까지, 주최자 없음), 끝난 모임은 대화방만 (M17)
 *
 * 목 데이터가 불러오는 순간의 Date.now() 기준이라, 시계를 고정한 뒤 모듈을 새로 불러옴
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Chat from '../data/chat'
import { ME_ID } from '../data/mock'

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
const T0 = new Date(2026, 10, 16, 15, 0).getTime() // 2026-11-16 (월) 15:00
let C: typeof Chat

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  vi.resetModules()
  C = await import('../data/chat')
})
afterEach(() => { vi.useRealTimers() })

describe('대화 요청 (F6 요청 탭)', () => {
  it('보낸 지 5일이 지난 요청은 목록에서 빠짐 (목 데이터: 6일 전 요청)', () => {
    expect(C.REQUEST_TTL_DAYS).toBe(5)
    const ids = C.liveRequests().map((r) => r.id)
    expect(ids).not.toContain('q0')
    expect(ids.length).toBeGreaterThan(0)
  })
  it('시간이 흘러 5일이 지나면 남은 요청도 모두 만료', () => {
    vi.setSystemTime(T0 + 5 * DAY + HOUR)
    expect(C.liveRequests()).toEqual([])
    expect(C.receivedCount()).toBe(0)
  })
  it('최신순, 받은 요청 수(요청 N)는 받은 것만 셈', () => {
    const live = C.liveRequests()
    expect(live.map((r) => r.at)).toEqual([...live.map((r) => r.at)].sort((a, b) => b - a))
    expect(C.receivedCount()).toBe(live.filter((r) => r.direction === 'received').length)
    expect(live.some((r) => r.direction === 'sent')).toBe(true)
  })
  it('수락 → 1:1 대화방이 바로 생기고, 요청은 사라지고, 첫 메시지·겹치는 관심사가 들어감', () => {
    const q = C.liveRequests().find((r) => r.direction === 'received')!
    expect(C.dmRoomWith(q.userId)).toBeUndefined()
    const roomId = C.acceptRequest(q.id)!
    const room = C.roomOf(roomId)!
    expect(room.kind).toBe('dm')
    expect(room.partnerId).toBe(q.userId)
    expect(room.messages.some((m) => m.text === q.message)).toBe(true)
    expect(room.messages[0].system).toBe(true)
    expect(C.liveRequests().some((r) => r.id === q.id)).toBe(false)
    expect(C.acceptRequest(q.id)).toBeNull()
  })
  it('거절·취소는 목록에서만 빠짐 (대화방 없음)', () => {
    const q = C.liveRequests()[0]
    C.dropRequest(q.id)
    expect(C.liveRequests().some((r) => r.id === q.id)).toBe(false)
    expect(C.dmRoomWith(q.userId)).toBeUndefined()
  })
  it('같은 사람에게 두 번 요청하지 않음, 대화방이 이미 있으면 요청 안 함', () => {
    const before = C.liveRequests().length
    C.sendRequest('lee', '안녕하세요')
    C.sendRequest('lee', '또')
    expect(C.liveRequests().length).toBe(before + 1)
    expect(C.sentRequestTo('lee')?.message).toBe('안녕하세요')
    C.sendRequest('yerin', '이미 대화 중') // r-yerin 방이 있음
    expect(C.sentRequestTo('yerin')).toBeUndefined()
  })
})

describe('대화방 (F6 1:1 · 모임 대화)', () => {
  it('상대가 나간·탈퇴한 방은 읽기 전용: 보내도 안 들어감', () => {
    for (const id of ['r-seoyeon', 'r-gone']) {
      const n = C.roomOf(id)!.messages.length
      C.send(id, '안녕?')
      expect(C.roomOf(id)!.messages.length, id).toBe(n)
    }
    expect(C.personOf(C.GONE_ID).nickname).toBe('탈퇴한 사용자')
    expect(C.personOf('no-such').nickname).toBe('탈퇴한 사용자')
  })
  it('모임 링크(/meetups/m4)를 보내면 모임 카드가 붙고 링크는 글에서 빠짐', () => {
    C.send('r-yerin', '이거 같이 가요 https://digul.example/meetups/m4')
    const last = C.lastMsg(C.roomOf('r-yerin')!)
    expect(last.meetupId).toBe('m4')
    expect(last.text).toBe('이거 같이 가요')
    expect(last.authorId).toBe(ME_ID)
  })
  it('나가기 → 내 목록에서 사라짐, 모임 대화방은 다시 생기지 않음', () => {
    C.leaveRoom('r-mingu')
    expect(C.roomOf('r-mingu')).toBeUndefined()
    C.leaveRoom('g-m1')
    C.syncGroupRooms()
    expect(C.roomOf('g-m1')).toBeUndefined()
  })
  it('예전 알림 링크 /chat/r-book 은 모임 대화방 g-m1 로', () => {
    expect(C.roomOf('r-book')?.id).toBe('g-m1')
  })
  it('모임 대화 참여자 = 주최자(맨 앞) + 참여 확정자 + 나, 중복 없음', () => {
    const ids = C.membersOf(C.roomOf('g-m1')!)
    expect(ids[0]).toBe('kim')
    expect(ids).toContain(ME_ID)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('참여 확정·내가 주최한 모임은 모두 대화방이 있음 (syncGroupRooms)', async () => {
    const M = await import('../data/meetupStore')
    C.syncGroupRooms()
    for (const m of M.getMeetupState().list) {
      const st = M.myOf(m.id)?.st
      if (st === 'joined' || st === 'host') expect(C.roomOf(C.groupRoomId(m.id)), m.id).toBeDefined()
    }
  })
  it('공지는 하나, 비우면 없어짐', () => {
    C.setNotice('g-m3', '  연필 챙겨 오세요  ')
    expect(C.roomOf('g-m3')!.notice).toBe('연필 챙겨 오세요')
    C.setNotice('g-m3', '   ')
    expect(C.roomOf('g-m3')!.notice).toBeUndefined()
  })
})

describe('모임 나가기 (F6 모임 정보 팝업 · M5 · M17)', () => {
  it('주최자는 나갈 수 없음', () => {
    expect(C.canQuitMeetup(C.roomOf('g-m3')!).ok).toBe(false)
  })
  it('시작 24시간 전이 넘게 남은 참여 확정 모임은 나갈 수 있음 → 참여 취소도 같이', async () => {
    const M = await import('../data/meetupStore')
    expect(C.canQuitMeetup(C.roomOf('g-m1')!)).toEqual({ ok: true })
    C.quitGroup('g-m1')
    expect(M.myOf('m1')?.st).toBe('quit')
    expect(C.roomOf('g-m1')).toBeUndefined()
  })
  it('끝난 모임은 참여 취소 없이 대화방만 나감 (M17)', () => {
    const r = C.roomOf('g-m9')!
    expect(r.ended).toBe(true)
    expect(C.canQuitMeetup(r)).toEqual({ ok: true })
  })
})

describe('시간 표기 (00 공통 8 · 채팅)', () => {
  it('ago: 방금 · N분 전 · N시간 전 · 어제 · N일 전', () => {
    expect(C.ago(T0 - 30_000)).toBe('방금')
    expect(C.ago(T0 - 12 * MIN)).toBe('12분 전')
    expect(C.ago(T0 - 3 * HOUR)).toBe('3시간 전')
    expect(C.ago(T0 - 30 * HOUR)).toBe('어제')
    expect(C.ago(T0 - 4 * DAY)).toBe('4일 전')
  })
  it('clock: 오전/오후 h:mm', () => {
    expect(C.clock(new Date(2026, 10, 16, 0, 5).getTime())).toBe('오전 12:05')
    expect(C.clock(new Date(2026, 10, 16, 13, 0).getTime())).toBe('오후 1:00')
  })
  it('listTime: 오늘은 시각, 어제, 일주일 안은 N일 전, 그 뒤는 날짜', () => {
    expect(C.listTime(T0 - 2 * HOUR)).toBe('오후 1:00')
    expect(C.listTime(new Date(2026, 10, 15, 23, 0).getTime())).toBe('어제')
    expect(C.listTime(new Date(2026, 10, 12, 9, 0).getTime())).toBe('4일 전')
    expect(C.listTime(new Date(2026, 10, 3, 9, 0).getTime())).toBe('11월 3일')
  })
  it('dayLabel: 오늘 · 어제 · 11월 3일 (화)', () => {
    expect(C.dayLabel(T0)).toBe('오늘')
    expect(C.dayLabel(T0 - DAY)).toBe('어제')
    expect(C.dayLabel(new Date(2026, 10, 3, 9, 0).getTime())).toBe('11월 3일 (화)')
  })
})
