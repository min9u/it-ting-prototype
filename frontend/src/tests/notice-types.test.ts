/**
 * 09 알림 — 명세(docs/backend/team-spec/api/09-notification.md)와 프론트가 맞는지
 * - 알림 종류 22가지: 갈래 · 갈 곳 종류가 명세 표와 같음, 모든 종류에 문구 · 세부 이름 · 갈 곳 주소
 * - 목 서버: 명세 모양 DTO, 30일 보관, 안 읽은 것 먼저, 팝업은 요청 알림 빼고 5개, 만들 때의 규칙, 읽음 404, 실시간 소식
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  NOTIFICATION_TYPE_SPEC, NOTIFICATION_TYPES, NOTICE_LABEL, noticeLink, noticeText, startsText, toAppNotice, toAppNoticeList, toAppNoticePopup,
  type NotificationCategory, type NotificationDto,
} from '../api/notifications'
import { mock, notificationDto, pushMockNotification } from '../api/notifications/mock'
import { toAppId, toDtoId } from '../api/common/ids'
import { addNotice, liveNotices, noticePrefs, noticeStore, unreadOf, type NoticeRecord } from '../data/notifications'
import { mockEvents } from '../realtime/events'
import { isUtcInstant } from '../lib/time'
import { TEAM_DOCS } from './teamDocs'

const FS = 'node:fs' // 브라우저 타입에 node 가 없어서 문자열로 불러옴 (api-v1-endpoints.test 와 같은 방식)
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, enc: string): string }
const SPEC = fs.readFileSync(`${TEAM_DOCS}/api/09-notification.md`, 'utf8')
const CAT_KO: Record<string, NotificationCategory> = { 모임: 'MEETUP', 채팅: 'CHAT', 커뮤니티: 'COMMUNITY', 게시판: 'COMMUNITY', 땅굴: 'BURROW', 공지: 'NOTICE' }

/** 명세 "알림의 종류" 표: | `TYPE` | 갈래 | 만드는 때 | 받는 사람 | actor | `TARGET` | */
function specTypes() {
  const out = new Map<string, { category: NotificationCategory; target: string; actor: boolean }>()
  for (const line of SPEC.split('\n')) {
    const m = /^\| `([A-Z_]+)` \| (모임|채팅|커뮤니티|게시판|땅굴|공지) \|.*\| ([^|]+) \| `([A-Z_]+)`(?:\([^)]*\))? \|$/.exec(line.trim())
    if (m) out.set(m[1], { category: CAT_KO[m[2]], target: m[4], actor: m[3].trim() !== '`null`' })
  }
  return out
}

beforeAll(() => { window.history.replaceState(null, '', '/?api=fast') })

describe('09 알림 종류 (명세 표와 같음)', () => {
  const spec = specTypes()
  it('명세의 22가지와 프론트의 종류가 같음 (방노트 · 마감 임박 · 답글 좋아요 따로 없음)', () => {
    expect(spec.size).toBe(22)
    expect([...NOTIFICATION_TYPES].sort()).toEqual([...spec.keys()].sort())
  })
  it('종류마다 갈래 · 갈 곳 종류 · actor 유무가 명세와 같음', () => {
    for (const [type, s] of spec) {
      const mine = NOTIFICATION_TYPE_SPEC[type as keyof typeof NOTIFICATION_TYPE_SPEC]
      expect(mine, type).toEqual({ category: s.category, target: s.target, actor: s.actor })
    }
  })
  it('모든 종류에 세부 이름 · 문구가 있고, 원본이 사라져도(title null) 문장이 됨', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTICE_LABEL[type], type).toBeTruthy()
      const target = { type: NOTIFICATION_TYPE_SPEC[type].target, id: 1, title: null, startsAt: null }
      const t = noticeText({ type, actor: null, target, createdAt: '2026-11-19T03:02:00Z' })
      expect(t.title, type).not.toBe('새 알림이 있어요')
      expect(t.title + t.sub, type).not.toMatch(/null|undefined/)
    }
  })
})

describe('09 알림 갈 곳 (명세 "눌렀을 때 갈 곳")', () => {
  it('갈 곳 종류마다 화면 주소', () => {
    expect(noticeLink('MEETUP_UPDATED', { type: 'MEETUP', id: 23 })).toBe('/meetups/23')
    expect(noticeLink('MEETUP_APPLICATION_RECEIVED', { type: 'MEETUP', id: 23 })).toBe('/meetups/me?tab=hosting&manage=23')
    expect(noticeLink('CHAT_MESSAGE_RECEIVED', { type: 'CHAT_ROOM', id: 5 })).toBe('/chat/5')
    expect(noticeLink('CHAT_REQUEST_RECEIVED', { type: 'CHAT_REQUEST', id: 9 })).toBe('/chat/requests')
    expect(noticeLink('COMMENT_REPLIED', { type: 'POST', id: 204 })).toBe('/board/204')
    expect(noticeLink('GUESTBOOK_ENTRY_CREATED', { type: 'GUESTBOOK', id: null })).toBe('/burrow?modal=guestbook')
    expect(noticeLink('GUESTBOOK_ENTRY_HIDDEN', { type: 'BURROW', id: 12 })).toBe('/burrow/12')
    expect(noticeLink('NOTICE_PUBLISHED', { type: 'NOTICE', id: 3 })).toBe('/settings/notices/3')
  })
  it('명세 예시 DTO → 앱 모양 (문구는 프론트가 만듦)', () => {
    const d: NotificationDto = {
      id: 7201, type: 'POST_COMMENTED', category: 'COMMUNITY',
      actor: { id: 12, nickname: '새벽산책', profileImageUrl: null, mole: { head: null, face: 'GLASSES_ROUND', neck: null, hand: null }, campusName: '서울', generation: 14, floor: 3, isWithdrawn: false },
      target: { type: 'POST', id: 204, title: '토요일 아침 한강 러닝 같이 하실 분', startsAt: null }, isRead: false, createdAt: '2026-11-19T03:02:00Z',
    }
    const a = toAppNotice(d)
    expect(a).toMatchObject({ id: '7201', kind: '게시판', unread: true, to: '/board/204', request: false })
    expect(a.sub).toBe('‘토요일 아침 한강 러닝 같이 하실 분’ · 새벽산책님')
  })
  it('일정 임박 문구: 1시간 전 · 24시간 전', () => {
    const start = Date.parse('2026-11-25T05:00:00Z') // 서울 오후 2시
    expect(startsText(start, start - 3_600_000)).toBe('1시간 뒤에 시작해요')
    expect(startsText(start, start - 24 * 3_600_000)).toBe('내일 오후 2시에 시작해요')
  })
  it('팝업: 채팅 요청 보조 문구 "OO님 외 N명", 0이면 없음', () => {
    const who = { id: 44, nickname: '모카', profileImageUrl: null, mole: { head: null, face: null, neck: null, hand: null }, campusName: '대전', generation: 15, floor: 1, isWithdrawn: false }
    expect(toAppNoticePopup({ meetupRequestCount: 1, chatRequestCount: 3, latestChatRequester: who, recentItems: [], unreadCount: 4 }).chatRequestSub).toBe('모카님 외 2명')
    expect(toAppNoticePopup({ meetupRequestCount: 0, chatRequestCount: 0, latestChatRequester: null, recentItems: [], unreadCount: 0 }).chatRequestSub).toBe('')
  })
  it('이어 받은 쪽에 같은 알림이 또 오면 한 번만', () => {
    const d = notificationDto(noticeStore.get().list[0])
    expect(toAppNoticeList([{ items: [d], nextCursor: 'x', hasNext: true }, { items: [d], nextCursor: null, hasNext: false }])).toHaveLength(1)
  })
})

describe('09 알림 목 서버 (명세 모양 · 주는 방식)', () => {
  it('DTO 가 명세 모양: 숫자 id, UTC 시각, 방명록은 target.id null, 사라진 원본은 title null', () => {
    for (const n of noticeStore.get().list) {
      const d = notificationDto(n)
      expect(typeof d.id).toBe('number')
      expect(isUtcInstant(d.createdAt)).toBe(true)
      expect(d.category).toBe(NOTIFICATION_TYPE_SPEC[d.type].category)
      if (d.target.type === 'GUESTBOOK') expect(d.target.id).toBeNull()
      if (!NOTIFICATION_TYPE_SPEC[d.type].actor) expect(d.actor).toBeNull()
    }
    const deleted = noticeStore.get().list.find((n) => n.type === 'MEETUP_DELETED')!
    expect(notificationDto(deleted).target).toMatchObject({ title: null, startsAt: null })
    const reminder = noticeStore.get().list.find((n) => n.type === 'MEETUP_START_REMINDER')!
    expect(isUtcInstant(notificationDto(reminder).target.startsAt)).toBe(true)
  })
  it('목록: 30일 안만, 안 읽은 것 먼저 → 최신순, 요청 알림 포함, 갈래 거르기, 20개씩 커서', async () => {
    const p1 = await mock.list({ size: 20 })
    expect(p1.items).toHaveLength(20)
    expect(p1.hasNext).toBe(true)
    const p2 = await mock.list({ size: 20, cursor: p1.nextCursor })
    const all = [...p1.items, ...p2.items]
    expect(all.some((n) => n.id === toDtoId('n99'))).toBe(false) // 35일 전
    const firstRead = all.findIndex((n) => n.isRead)
    expect(all.slice(firstRead).every((n) => n.isRead)).toBe(true)
    expect(all.some((n) => n.type === 'CHAT_REQUEST_RECEIVED')).toBe(true)
    const meetups = await mock.list({ category: 'MEETUP', size: 50 })
    expect(meetups.items.every((n) => n.category === 'MEETUP')).toBe(true)
  })
  it('팝업: 요청 알림을 빼고 5개까지, 안 읽은 것 먼저 + 요청 두 줄의 수', async () => {
    const p = await mock.popup()
    expect(p.recentItems.length).toBeLessThanOrEqual(5)
    expect(p.recentItems.some((n) => n.type === 'MEETUP_APPLICATION_RECEIVED' || n.type === 'CHAT_REQUEST_RECEIVED')).toBe(false)
    expect(p.recentItems[0].isRead).toBe(false)
    expect(p.chatRequestCount).toBeGreaterThan(0)
    expect(p.latestChatRequester?.nickname).toBeTruthy()
  })
  it('안 읽은 수는 모든 갈래, 빨간 점은 켜 둔 갈래만', () => {
    const now = Date.now()
    const list: NoticeRecord[] = [{ id: 'a', type: 'CHAT_MESSAGE_RECEIVED', actorId: 'mingu', targetId: 'r-mingu', at: now, readAt: null }]
    const on = { 모임: true, 채팅: true, 게시판: true, 땅굴: true, 공지: true }
    expect(unreadOf(list, on, now)).toEqual({ unreadCount: 1, hasUnread: true })
    expect(unreadOf(list, { ...on, 채팅: false }, now)).toEqual({ unreadCount: 1, hasUnread: false })
    expect(liveNotices([{ ...list[0], at: now - 31 * 86_400_000 }], now)).toHaveLength(0)
  })
  it('만들 때의 규칙: 내가 한 일 · 꺼 둔 갈래는 안 만듦, 새 메시지는 대화방마다 한 줄', () => {
    expect(addNotice({ type: 'POST_LIKED', actorId: 'me', targetId: 'p6' })).toBeNull()
    noticePrefs.set((s) => ({ kinds: { ...s.kinds, 게시판: false } }))
    expect(addNotice({ type: 'POST_LIKED', actorId: 'yerin', targetId: 'p6' })).toBeNull()
    noticePrefs.set((s) => ({ kinds: { ...s.kinds, 게시판: true } }))
    const before = noticeStore.get().list.length
    const a = addNotice({ type: 'CHAT_MESSAGE_RECEIVED', actorId: 'yerin', targetId: 'r-room-x' })!
    const b = addNotice({ type: 'CHAT_MESSAGE_RECEIVED', actorId: 'mingu', targetId: 'r-room-x' })!
    expect(noticeStore.get().list.length).toBe(before + 1)
    expect(b.id).toBe(a.id)
    expect(b.actorId).toBe('mingu')
  })
  it('읽음: 없는 알림은 404 NOTIFICATION_NOT_FOUND, 읽으면 안 읽은 수를 돌려주고 실시간 소식을 보냄', async () => {
    await expect(mock.read(toDtoId('no-such'))).rejects.toMatchObject({ status: 404, code: 'NOTIFICATION_NOT_FOUND' })
    const emit = vi.spyOn(mockEvents, 'emit')
    const n = pushMockNotification('GUESTBOOK_ENTRY_CREATED', { actorId: 'ha' })!
    expect(emit).toHaveBeenLastCalledWith('NOTIFICATION_UNREAD_CHANGED', expect.objectContaining({ hasUnread: true }))
    const before = (await mock.unreadCount()).unreadCount
    const after = await mock.read(toDtoId(n.id))
    expect(after.unreadCount).toBe(before - 1)
    expect(emit).toHaveBeenLastCalledWith('NOTIFICATION_UNREAD_CHANGED', after)
    expect(toAppId(toDtoId(n.id))).toBe(n.id)
    const all = await mock.readAll()
    expect(all).toEqual({ unreadCount: 0, hasUnread: false })
    expect((await mock.popup()).chatRequestCount).toBeGreaterThan(0) // 모두 읽음이어도 요청 수는 그대로
  })
})
