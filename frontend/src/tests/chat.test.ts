/**
 * 06 채팅 (명세 v1: docs/backend/team-spec/api/06-chat.md, 정리 docs/backend/api-v1/06-chat.md)
 * - 목 저장소 규칙 (data/chat.ts): 요청 상태 · 만료 · 거절을 숨김 · 거절한 사람에게 요청 = 수락 · 대화방 · 읽음
 * - 목 서버 (api/chat/mock.ts): 명세 DTO 모양 · 에러 code · 실시간 소식(CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED)
 * - 소식 → 캐시 (api/chat/queries.ts applyChatMessageEvent): 목록 맨 위로 · 안 읽은 수 · 목록에 없는 방 · 읽기 전용 · 내 메시지 중복 없음
 * - 매퍼 (안내 문구 · 목록 미리보기 · 모임 카드)
 * 예전 STOMP 허브 시험(보내는 중 · 다시 받기 · 중복 제거)은 이것들로 바뀜
 *
 * 목 데이터가 불러오는 순간의 Date.now() 기준이라, 시계를 고정한 뒤 모듈을 새로 불러옴
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type * as Chat from '../data/chat'
import type * as ChatMock from '../api/chat/mock'
import type * as ChatQueries from '../api/chat'
import type * as ChatOutbox from '../api/chat/outbox'
import type * as Ids from '../api/common/ids'
import type * as Events from '../realtime/events'
import { isUtcInstant } from '../lib/time'
import { ME_ID } from '../data/mock'

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
const T0 = new Date(2026, 10, 16, 15, 0).getTime() // 2026-11-16 (월) 15:00
let C: typeof Chat
let M: typeof ChatMock
let Q: typeof ChatQueries
let O: typeof ChatOutbox
let I: typeof Ids
let E: typeof Events

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  vi.resetModules()
  // 목 서버 지연 없이 (?api=fast), 상대 답장 흉내 끔 (?rt=quiet)
  window.history.replaceState(null, '', '/?api=fast&rt=quiet')
  C = await import('../data/chat')
  M = await import('../api/chat/mock')
  Q = await import('../api/chat')
  O = await import('../api/chat/outbox')
  I = await import('../api/common/ids')
  E = await import('../realtime/events')
  M.startChatMockDriver()
})
afterEach(() => { vi.useRealTimers() })

/** 모듈을 새로 불러와 ApiError 클래스가 달라지므로 instanceof 대신 code 를 읽음 */
const codeIn = (e: unknown) => (e as { code?: string } | null)?.code
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK' } catch (e) { return codeIn(e) ?? String(e) }
}

describe('대화 요청 (목 저장소 · 영역 규칙 "대화 요청의 상태")', () => {
  it('보낸 지 5일이 지난 요청은 보이지 않음 (6일 전 요청 q0)', () => {
    expect(C.REQUEST_TTL_DAYS).toBe(5)
    expect(C.liveRequests().map((r) => r.id)).not.toContain('q0')
    vi.setSystemTime(T0 + 5 * DAY + HOUR)
    expect(C.liveRequests()).toEqual([])
  })
  it('받은 쪽에는 PENDING 만, 보낸 쪽에는 상대가 거절한 것도 똑같이 보임 (거절을 드러내지 않음)', () => {
    const sent = C.liveRequests().filter((r) => r.direction === 'sent').map((r) => r.id)
    expect(sent).toContain('q4') // 상대가 거절한 보낸 요청
    expect(C.receivedCount()).toBe(2)
    expect(C.rejectRequest('q1')).toBe(true)
    expect(C.rejectRequest('q1')).toBe(true) // 이미 거절 → 그대로 성공
    expect(C.receivedCount()).toBe(1)
  })
  it('수락 → 1:1 대화방(ACCEPTED 안내만, 인사는 옮기지 않음), 두 번 수락하면 같은 방', () => {
    const room = C.acceptRequest('q2')!
    const r = C.roomOf(room)!
    expect(r.kind).toBe('dm')
    expect(r.messages.map((m) => m.type)).toEqual(['ACCEPTED'])
    expect(r.messages[0].authorId).toBe(ME_ID)
    expect(C.acceptRequest('q2')).toBe(room)
    expect(C.rejectRequest('q2')).toBe(false)
  })
  it('보낸 요청 취소: 거절된 것도 성공, 이미 수락됐으면 그 방을 알려 줌', () => {
    expect(C.cancelRequest('q4')).toEqual({ ok: true, wasPending: false })
    expect(C.cancelRequest('q4')).toEqual({ ok: false })
    expect(C.cancelRequest('q3')).toEqual({ ok: true, wasPending: true })
  })
  it('내가 거절한 요청이 살아 있는 사람에게 요청하면 새 요청 대신 수락 처리 → 대화방 + 내 인사가 첫 메시지', () => {
    C.rejectRequest('q1') // seobeok 의 요청 거절
    const res = C.sendRequest('seobeok', '저도 드로잉 좋아해요')
    expect(res).toMatchObject({ ok: true, chatRequestId: null })
    const r = C.roomOf((res as { chatRoomId: string }).chatRoomId)!
    expect(r.messages.map((m) => [m.type, m.authorId, m.text])).toEqual([['ACCEPTED', ME_ID, ''], ['TEXT', ME_ID, '저도 드로잉 좋아해요']])
  })
  it('상대가 먼저 보낸 요청에 답하지 않았으면 / 이미 보냈으면 / 열린 대화가 있으면 만들지 않음', () => {
    expect(C.sendRequest('ha', '안녕')).toEqual({ ok: false, why: 'CHAT_REQUEST_ALREADY_RECEIVED' })
    expect(C.sendRequest('yejin', '또')).toEqual({ ok: false, why: 'CHAT_REQUEST_ALREADY_SENT' })
    expect(C.sendRequest('yerin', '이미 대화 중')).toEqual({ ok: false, why: 'CHAT_ROOM_ALREADY_EXISTS' })
    // 상대가 나간(읽기 전용) 1:1 만 있으면 다시 요청할 수 있음
    expect(C.sendRequest('seoyeon', '다시 이야기해요')).toMatchObject({ ok: true })
  })
})

describe('대화방 (목 저장소)', () => {
  it('안 읽은 수 = 읽은 자리 뒤의, 남이 보낸 TEXT. 내가 보내면 내 읽은 자리도 옮겨짐', () => {
    const r = C.roomOf('r-mingu')!
    expect(r.unread).toBe(2)
    C.markReadUpTo('r-mingu', +r.messages[r.messages.length - 1].id)
    expect(C.roomOf('r-mingu')!.unread).toBe(0)
    C.appendMessage('r-mingu', { authorId: 'mingu', text: '하이' })
    expect(C.roomOf('r-mingu')!.unread).toBe(1)
    C.appendMessage('r-mingu', { authorId: ME_ID, text: '네!' })
    expect(C.roomOf('r-mingu')!.unread).toBe(0)
  })
  it('메시지 id 는 같은 방 안에서 클수록 나중', () => {
    for (const r of C.getChatState().rooms) {
      const ids = r.messages.map((m) => +m.id)
      expect(ids, r.id).toEqual([...ids].sort((a, b) => a - b))
    }
  })
  it('나간 모임 대화방은 다시 생기지 않음, 예전 링크 r-book → g-m1', () => {
    expect(C.roomOf('r-book')?.id).toBe('g-m1')
    C.leaveRoom('g-m1')
    C.syncGroupRooms()
    expect(C.roomOf('g-m1')).toBeUndefined()
  })
  it('모임 대화 참여자 = 주최자(맨 앞) + 참여 확정자 + 나', () => {
    const ids = C.membersOf(C.roomOf('g-m1')!)
    expect(ids[0]).toBe('kim')
    expect(ids).toContain(ME_ID)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('목 서버 (명세 DTO · 에러 code)', () => {
  const dto = (id: string) => I.toDtoId(id)
  it('대화 목록: 숫자 id · UTC 시각 · 마지막 메시지 새것부터 · 1:1 은 counterpart, 모임은 meetup', async () => {
    const { items } = await M.mock.rooms()
    expect(items.length).toBeGreaterThan(3)
    for (const r of items) {
      expect(typeof r.id).toBe('number')
      if (r.lastMessage) expect(isUtcInstant(r.lastMessage.createdAt)).toBe(true)
      expect(r.type === 'DIRECT' ? r.counterpart && !r.meetup : r.meetup && !r.counterpart).toBeTruthy()
      if (r.type === 'MEETUP') expect(r.isReadOnly).toBe(false)
    }
    const times = items.map((r) => r.lastMessage?.createdAt ?? '')
    expect(times.filter(Boolean)).toEqual([...times.filter(Boolean)].sort().reverse())
    const left = items.find((r) => I.toAppId(r.id) === 'r-seoyeon')!
    expect(left.isReadOnly).toBe(true)
    expect(items.find((r) => I.toAppId(r.id) === 'r-gone')!.counterpart!.isWithdrawn).toBe(true)
  })
  it('대화방: leaveType (주최자 NOT_ALLOWED · 참여자 CANCEL_PARTICIPATION · 끝난 모임 LEAVE_ROOM · 1:1 LEAVE_ROOM), 공지는 주최자만', async () => {
    expect((await M.mock.room(dto('g-m3'))).leaveType).toBe('NOT_ALLOWED')
    const g1 = await M.mock.room(dto('g-m1'))
    expect(g1.leaveType).toBe('CANCEL_PARTICIPATION')
    expect(g1.canEditNotice).toBe(false)
    expect(g1.members[0].isHost).toBe(true)
    expect(g1.members.filter((m) => m.isMe)).toHaveLength(1)
    expect((await M.mock.room(dto('g-p1'))).leaveType).toBe('LEAVE_ROOM')
    const dm = await M.mock.room(dto('r-yerin'))
    expect(dm).toMatchObject({ type: 'DIRECT', leaveType: 'LEAVE_ROOM', meetup: null, members: [], notice: null })
    expect(dm.sharedInterests.every((t) => t.isShared)).toBe(true)
    expect(await codeOf(M.mock.room(dto('no-such-room')))).toBe('CHAT_ROOM_NOT_FOUND')
  })
  it('메시지: 새 것부터 커서로 나눠 줌, 모임 링크는 meetupCard', async () => {
    const p1 = await M.mock.messages(dto('r-yerin'), { size: 2 })
    expect(p1.items).toHaveLength(2)
    expect(p1.hasNext).toBe(true)
    expect(p1.items[0].id).toBeGreaterThan(p1.items[1].id)
    expect(p1.items[0].meetupCard).toMatchObject({ meetupId: dto('m4') })
    const p2 = await M.mock.messages(dto('r-yerin'), { size: 2, cursor: p1.nextCursor })
    expect(p2.items[0].id).toBeLessThan(p1.items[1].id)
  })
  it('보내기: 빈 메시지 INVALID_INPUT · 읽기 전용 CHAT_ROOM_READ_ONLY · 성공하면 소식(보낸 사람도 받음)', async () => {
    expect(await codeOf(M.mock.sendMessage(dto('r-yerin'), { content: '   ', imageIds: [] }))).toBe('INVALID_INPUT')
    expect(await codeOf(M.mock.sendMessage(dto('r-yerin'), { content: 'x'.repeat(1001), imageIds: [] }))).toBe('INVALID_INPUT')
    expect(await codeOf(M.mock.sendMessage(dto('r-seoyeon'), { content: '안녕?', imageIds: [] }))).toBe('CHAT_ROOM_READ_ONLY')
    const emit = vi.spyOn(E.mockEvents, 'emit')
    const m = await M.mock.sendMessage(dto('r-yerin'), { content: '좋아요!', imageIds: [] })
    expect(m).toMatchObject({ type: 'TEXT', content: '좋아요!', images: [] })
    expect(emit).toHaveBeenCalledWith('CHAT_MESSAGE_CREATED', expect.objectContaining({ chatRoomId: dto('r-yerin'), message: expect.objectContaining({ id: m.id }) }))
  })
  it('사진만 보내기 (08 POST /images 로 올린 id, 한 번 붙이면 다시 못 씀), 3장 넘으면 INVALID_INPUT', async () => {
    const up = await (await import('../api/community/mock')).mock.uploadImage(new File(['x'], 'a.png', { type: 'image/png' }))
    const m = await M.mock.sendMessage(dto('r-yerin'), { content: null, imageIds: [up.imageId] })
    expect(m.content).toBeNull()
    expect(m.images.map((i) => i.id)).toEqual([up.imageId])
    expect(await codeOf(M.mock.sendMessage(dto('r-yerin'), { content: null, imageIds: [up.imageId] }))).toBe('INVALID_INPUT')
    expect(await codeOf(M.mock.sendMessage(dto('r-yerin'), { content: null, imageIds: [1, 2, 3, 4] }))).toBe('INVALID_INPUT')
  })
  it('읽음 → 안 읽은 수, 다른 방의 메시지면 INVALID_INPUT', async () => {
    const { items } = await M.mock.messages(dto('r-mingu'))
    expect((await M.mock.read(dto('r-mingu'), items[0].id)).unreadCount).toBe(0)
    expect(await codeOf(M.mock.read(dto('r-yerin'), items[0].id))).toBe('INVALID_INPUT')
  })
  it('나가기: 끝나지 않은 모임은 CHAT_ROOM_LEAVE_NOT_ALLOWED, 1:1 은 나가면 목록에서 빠지고 다시 들어갈 수 없음', async () => {
    expect(await codeOf(M.mock.leave(dto('g-m1')))).toBe('CHAT_ROOM_LEAVE_NOT_ALLOWED')
    expect(await codeOf(M.mock.leave(dto('g-p1')))).toBe('OK')
    expect(await codeOf(M.mock.leave(dto('r-mingu')))).toBe('OK')
    expect(await codeOf(M.mock.leave(dto('r-mingu')))).toBe('CHAT_ROOM_NOT_FOUND')
    expect((await M.mock.rooms()).items.some((r) => I.toAppId(r.id) === 'r-mingu')).toBe(false)
  })
  it('공지: 주최자가 아니면 FORBIDDEN, 200자 넘으면 INVALID_INPUT, 지우면 null', async () => {
    expect(await codeOf(M.mock.setNotice(dto('g-m1'), '공지'))).toBe('FORBIDDEN')
    expect(await codeOf(M.mock.setNotice(dto('g-m3'), 'x'.repeat(201)))).toBe('INVALID_INPUT')
    expect(await M.mock.setNotice(dto('g-m3'), '연필 챙겨 오세요')).toEqual({ notice: '연필 챙겨 오세요' })
    await M.mock.deleteNotice(dto('g-m3'))
    expect((await M.mock.room(dto('g-m3'))).notice).toBeNull()
  })
  it('요청: 방향별 목록 · 수 · 수락하면 요청 수 소식 · 이미 수락된 요청 취소는 CHAT_REQUEST_ALREADY_ACCEPTED + detail.chatRoomId', async () => {
    const got = await M.mock.requests('RECEIVED')
    expect(got.items.map((r) => I.toAppId(r.id))).toEqual(['q1', 'q2'])
    expect(got.items[0]).not.toHaveProperty('status')
    expect(await M.mock.requestCount()).toEqual({ receivedCount: 2, sentCount: 2 })
    const emit = vi.spyOn(E.mockEvents, 'emit')
    const { chatRoomId } = await M.mock.acceptRequest(dto('q2'))
    expect(emit).toHaveBeenCalledWith('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 1 })
    expect((await M.mock.acceptRequest(dto('q2'))).chatRoomId).toBe(chatRoomId)
    expect(await codeOf(M.mock.rejectRequest(dto('q2')))).toBe('CHAT_REQUEST_NOT_FOUND')
    // 상대(목)가 내 보낸 요청을 수락한 것처럼
    const q3 = C.requestById('q3')!
    C.getChatState().requests = C.getChatState().requests.map((r) => (r === q3 ? { ...r, status: 'ACCEPTED' as const, chatRoomId: 'r-yerin' } : r))
    try { await M.mock.cancelRequest(dto('q3')); expect.unreachable() } catch (e) {
      expect(codeIn(e)).toBe('CHAT_REQUEST_ALREADY_ACCEPTED')
      expect((e as { detail?: unknown }).detail).toEqual({ chatRoomId: dto('r-yerin') })
    }
  })
  it('모임 나가기(07 참여 취소 API): 참여가 취소되고 대화방에서도 빠짐', async () => {
    const meetups = (await import('../api/meetups/mock')).mock
    expect(await codeOf(meetups.cancelParticipation(dto('m1')))).toBe('OK')
    expect(await codeOf(M.mock.room(dto('g-m1')))).toBe('CHAT_ROOM_NOT_FOUND')
  })
})

describe('실시간 소식 → 캐시 (applyChatMessageEvent)', () => {
  async function setup() {
    const qc = new QueryClient()
    const rooms = (await M.mock.rooms()).items.map((d) => Q.toChatRoomItem(d))
    qc.setQueryData(Q.chatKeys.rooms, rooms)
    const page = await M.mock.messages(I.toDtoId('r-yerin'))
    qc.setQueryData(Q.chatKeys.messages('r-yerin'), { pages: [{ items: page.items.map(Q.toChatMessage), nextCursor: null, hasNext: false }], pageParams: [null] })
    return qc
  }
  const event = (roomId: string, authorId: string, text: string, type: 'TEXT' | 'LEFT' = 'TEXT') => {
    const msg = C.appendMessage(roomId, { authorId, text, type })!
    if (type === 'LEFT') C.getChatState().rooms = C.getChatState().rooms.map((r) => (r.id === roomId ? { ...r, closed: 'left' as const } : r))
    return { chatRoomId: I.toDtoId(roomId), message: M.messageDto(msg), unreadCount: C.unreadOf(C.roomOf(roomId)!) }
  }
  it('그 방이 목록 맨 위로, 마지막 메시지 · 안 읽은 수가 바뀌고, 열린 메시지 캐시에 한 번만 붙음', async () => {
    const qc = await setup()
    const ev = event('r-yerin', 'yerin', '네 그때 봬요')
    Q.applyChatMessageEvent(qc, ev, ME_ID)
    Q.applyChatMessageEvent(qc, ev, ME_ID) // 두 번 와도
    const list = qc.getQueryData<ChatQueries.ChatRoomItem[]>(Q.chatKeys.rooms)!
    expect(list[0]).toMatchObject({ id: 'r-yerin', unread: 1, last: expect.objectContaining({ text: '네 그때 봬요' }) })
    const msgs = Q.chatMessagesAsc(qc.getQueryData(Q.chatKeys.messages('r-yerin')))
    expect(msgs.filter((m) => m.text === '네 그때 봬요')).toHaveLength(1)
    expect(msgs[msgs.length - 1].text).toBe('네 그때 봬요')
  })
  it('목록에 없는 방의 소식이면 목록을 다시 받음 (수락 · 모임 확정으로 새로 생긴 방)', async () => {
    const qc = await setup()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const roomId = C.acceptRequest('q1')!
    Q.applyChatMessageEvent(qc, { chatRoomId: I.toDtoId(roomId), message: M.messageDto(C.roomOf(roomId)!.messages[0]), unreadCount: 0 }, ME_ID)
    expect(spy).toHaveBeenCalledWith({ queryKey: Q.chatKeys.rooms })
  })
  it('1:1 상대의 LEFT → 목록 · 열린 방이 읽기 전용', async () => {
    const qc = await setup()
    const det = Q.toChatRoom(await M.mock.room(I.toDtoId('r-mingu')))
    qc.setQueryData(Q.chatKeys.room('r-mingu'), det)
    Q.applyChatMessageEvent(qc, event('r-mingu', 'mingu', '', 'LEFT'), ME_ID)
    expect(qc.getQueryData<ChatQueries.ChatRoomItem[]>(Q.chatKeys.rooms)!.find((r) => r.id === 'r-mingu')).toMatchObject({ readOnly: true, readOnlyReason: 'left' })
    expect(qc.getQueryData<ChatQueries.ChatRoomVM>(Q.chatKeys.room('r-mingu'))).toMatchObject({ readOnly: true })
  })
  it('내가 보낸 메시지가 응답보다 먼저 소식으로 오면 "보내는 중"을 대신함 (두 번 그리지 않음)', async () => {
    const qc = await setup()
    O.outbox.add({ clientId: 'c1', roomId: 'r-yerin', content: '먼저 온다', images: [], at: Date.now(), status: 'sending' })
    O.outbox.add({ clientId: 'c2', roomId: 'r-yerin', content: '다른 것', images: [], at: Date.now(), status: 'sending' })
    Q.applyChatMessageEvent(qc, event('r-yerin', ME_ID, '먼저 온다'), ME_ID)
    expect(O.outbox.get('r-yerin').map((p) => p.clientId)).toEqual(['c2'])
  })
})

describe('매퍼 (안내 문구 · 미리보기 · 모임 카드)', () => {
  it('안내 메시지 문구는 type 과 닉네임으로', async () => {
    const msgs = (await M.mock.messages(I.toDtoId('r-yerin'))).items.map(Q.toChatMessage)
    const accepted = msgs.find((m) => m.type === 'ACCEPTED')!
    expect(Q.noticeText(accepted, 'dm', ME_ID)).toBe('예린님이 대화 요청을 수락했어요')
    const mine = (await M.mock.messages(I.toDtoId('r-mingu'))).items.map(Q.toChatMessage).find((m) => m.type === 'ACCEPTED')!
    expect(Q.noticeText(mine, 'dm', ME_ID, '민구')).toBe('민구님의 대화 요청을 수락했어요')
    const gone = (await M.mock.messages(I.toDtoId('r-gone'))).items.map(Q.toChatMessage)[0]
    expect(Q.noticeText(gone, 'dm', ME_ID)).toBe('상대방이 탈퇴했습니다')
  })
  it('모임 카드가 붙으면 본문에서 링크를 뺌, 목록 미리보기는 모임이면 "닉네임: …", 사진만이면 "사진"', async () => {
    const card = (await M.mock.messages(I.toDtoId('r-yerin'))).items.map(Q.toChatMessage)[0]
    expect(card.card?.meetupId).toBe('m4')
    expect(card.text).not.toMatch(/meetups/)
    const rooms = (await M.mock.rooms()).items.map(Q.toChatRoomItem)
    const g = rooms.find((r) => r.id === 'g-m1')!
    expect(Q.roomPreview(g, ME_ID)).toMatch(/^나: /)
    const up = await (await import('../api/community/mock')).mock.uploadImage(new File(['x'], 'a.png', { type: 'image/png' }))
    await M.mock.sendMessage(I.toDtoId('r-mingu'), { content: null, imageIds: [up.imageId] })
    const r = (await M.mock.rooms()).items.map(Q.toChatRoomItem).find((x) => x.id === 'r-mingu')!
    expect(Q.roomPreview(r, ME_ID)).toBe('사진')
  })
})
