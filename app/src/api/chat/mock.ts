/**
 * 06 채팅 — 목 서버. data/chat.ts 를 DB 로 써서 명세 모양 DTO · 명세 code 로 답한다.
 * 실시간 소식도 서버처럼 보낸다: 메시지가 생기면 mockEvents.emit('CHAT_MESSAGE_CREATED', …), 받은 요청 수가 바뀌면 'CHAT_REQUEST_COUNT_CHANGED'.
 * 상대 답장도 흉내 낸다 (내가 보내면 1.5 ~ 3.5초 뒤 상대 · 모임 참여자 한 명이 답함 → 소식으로 옴).
 *
 * 시험 손잡이 (주소, 목 모드에서만. startChatMockDriver 가 처음 불릴 때 읽음)
 *   ?rt=flaky  20 ~ 40초마다 실시간 연결이 2 ~ 8초 끊기고, 끊긴 동안 상대 메시지가 옴 → 다시 붙으면 조회 API 로 받아 옴
 *   ?rt=down   실시간 서버가 꺼진 것처럼 (메시지 보내기는 REST 라 그대로 됨. 상대 답장은 화면에 안 옴)
 *   ?rt=quiet  상대 답장 흉내 끔
 * 개발 서버 콘솔: __digulChat.incoming('r-yerin', '안녕') · .request('kim', '인사') · .partnerLeaves('r-mingu') · .drop(5000)
 */
import { conflict, forbidden, invalidInput, items, mockRead, mockWrite, notFound, emptyCursor, cursorPage } from '../mock/server'
import { interestTags, userDisplay } from '../common/mockPeople'
import { toAppId, toDtoId } from '../common/ids'
import type { Id } from '../common/types'
import { claimImage, uploadedImage } from '../../data/boardStore'
import { ME_ID } from '../../data/mock'
import { confirmedOf, findMeetup, parseHour, startMs, canQuit, type MeetupX } from '../../data/meetupStore'
import { meetupCategoryOf } from '../../data/meetupCategory'
import {
  acceptRequest, appendMessage, cancelRequest, closeByPartner, leaveRoom, liveRequests, markReadUpTo, meetupEnded, membersOf,
  receiveRequest, receivedCount, rejectRequest, roomOf, setNotice, syncGroupRooms, getChatState, unreadOf, requestById,
  GONE_ID, type ChatMsg, type Req, type Room,
} from '../../data/chat'
import { mockEvents } from '../../realtime/events'
import { markChatNoticesRead } from '../../data/notifications'
import { pushMockNotification } from '../notifications/mock'
import { ENV } from '../../lib/env'
import { toIso } from '../../lib/time'
import type { ChatApi } from './real'
import {
  CHAT_IMAGES_MAX, CHAT_MESSAGE_CREATED, CHAT_MESSAGE_MAX, CHAT_MESSAGES_PAGE, CHAT_NOTICE_MAX, CHAT_REQUEST_COUNT_CHANGED,
  type ChatLeaveType, type ChatMeetupCardDto, type ChatMessageCreatedEvent, type ChatMessageDto, type ChatRequestCountChangedEvent,
  type ChatRequestDto, type ChatRoomDetailDto, type ChatRoomMeetupDto, type ChatRoomSummaryDto,
} from './types'

const DAY = 24 * 3_600_000

/* ===== 직렬화 (저장소 → DTO) ===== */
/** 본문의 모임 링크 (…/meetups/<id>). 실제 서버의 링크 모양은 구현 단계에서 정함 (명세 "구현 단계로 넘기는 것") */
export const MEETUP_LINK = /\/meetups\/([A-Za-z0-9_-]+)/
function endMs(m: MeetupX): number | null {
  if (!m.end) return null
  const next = /다음\s*날/.test(m.end) || parseHour(m.end) < parseHour(m.start)
  return startMs({ ...m, start: m.end }) + (next ? DAY : 0)
}
function meetupCardOf(text: string): ChatMeetupCardDto | null {
  const id = MEETUP_LINK.exec(text)?.[1]
  const m = id ? findMeetup(id) : undefined
  if (!m) return null
  return { meetupId: toDtoId(m.id), title: m.title, startsAt: toIso(startMs(m)), capacity: m.capacity, confirmedCount: confirmedOf(m) }
}
export function messageDto(m: ChatMsg): ChatMessageDto {
  return {
    id: toDtoId(m.id), type: m.type, sender: userDisplay(m.authorId === GONE_ID ? '' : m.authorId),
    content: m.type === 'TEXT' && m.text ? m.text : null,
    meetupCard: m.type === 'TEXT' && m.text ? meetupCardOf(m.text) : null,
    images: m.images.map((i) => ({ id: toDtoId(i.id), url: i.url })),
    createdAt: toIso(m.at),
  }
}
const lastAt = (r: Room) => r.messages[r.messages.length - 1]?.at ?? r.createdAt
export function roomSummaryDto(r: Room): ChatRoomSummaryDto {
  const last = r.messages[r.messages.length - 1]
  const mt = r.meetupId ? findMeetup(r.meetupId) : undefined
  return {
    id: toDtoId(r.id), type: r.kind === 'dm' ? 'DIRECT' : 'MEETUP',
    counterpart: r.kind === 'dm' ? userDisplay(r.partnerId === GONE_ID ? '' : r.partnerId!) : null,
    meetup: r.kind === 'group' ? { id: toDtoId(r.meetupId!), title: mt?.title ?? '모임' } : null,
    lastMessage: last ? messageDto(last) : null,
    unreadCount: unreadOf(r),
    isReadOnly: r.kind === 'dm' && !!r.closed,
  }
}
function leaveTypeOf(r: Room, m?: MeetupX): ChatLeaveType {
  if (r.kind === 'dm' || !m) return 'LEAVE_ROOM'
  if (meetupEnded(r)) return 'LEAVE_ROOM'
  if (m.hostId === ME_ID) return 'NOT_ALLOWED'
  return canQuit(m) ? 'CANCEL_PARTICIPATION' : 'NOT_ALLOWED'
}
function roomMeetupDto(m: MeetupX): ChatRoomMeetupDto {
  const end = endMs(m)
  const online = m.mode === '온라인'
  return {
    id: toDtoId(m.id), hostId: toDtoId(m.hostId), title: m.title, category: meetupCategoryOf(m.category)?.code ?? m.category,
    startsAt: toIso(startMs(m)), endsAt: end == null ? null : toIso(end), mode: online ? 'ONLINE' : 'OFFLINE',
    place: online ? null : m.place || null, placeDetail: m.placeDetail || null, joinUrl: m.link || null,
    capacity: m.capacity, confirmedCount: confirmedOf(m), isCanceled: !!m.cancelled,
  }
}
export function roomDetailDto(r: Room): ChatRoomDetailDto {
  const m = r.meetupId ? findMeetup(r.meetupId) : undefined
  const partner = r.kind === 'dm' && r.partnerId !== GONE_ID ? r.partnerId! : ''
  return {
    id: toDtoId(r.id), type: r.kind === 'dm' ? 'DIRECT' : 'MEETUP', isReadOnly: r.kind === 'dm' && !!r.closed, leaveType: leaveTypeOf(r, m),
    counterpart: r.kind === 'dm' ? userDisplay(partner) : null,
    sharedInterests: partner && r.closed !== 'gone' ? interestTags(partner).filter((t) => t.isShared) : [],
    meetup: m ? roomMeetupDto(m) : null,
    notice: r.kind === 'group' ? r.notice ?? null : null,
    canEditNotice: r.kind === 'group' && m?.hostId === ME_ID,
    members: r.kind === 'group' ? membersOf(r).map((id) => ({ user: userDisplay(id), isHost: id === m?.hostId, isMe: id === ME_ID })) : [],
  }
}
export function requestDto(q: Req): ChatRequestDto {
  return {
    id: toDtoId(q.id), counterpart: userDisplay(q.userId), message: q.message || null,
    sharedInterests: interestTags(q.userId).filter((t) => t.isShared),
    createdAt: toIso(q.at), expiresAt: toIso(q.at + 5 * DAY),
  }
}

/* ===== 실시간 소식 보내기 (서버가 하는 일 흉내) ===== */
export function emitMessage(roomId: string, msg: ChatMsg) {
  const r = roomOf(roomId)
  if (!r) return
  const ev: ChatMessageCreatedEvent = { chatRoomId: toDtoId(r.id), message: messageDto(msg), unreadCount: unreadOf(r) }
  mockEvents.emit(CHAT_MESSAGE_CREATED, ev)
}
function emitCount() {
  const ev: ChatRequestCountChangedEvent = { receivedCount: visibleRequests('received').length }
  mockEvents.emit(CHAT_REQUEST_COUNT_CHANGED, ev)
}

/* ===== 목 서버 ===== */
/** 들어갈 수 있는 대화방 (없거나 나갔거나 모임이 지워졌으면 404, 명세 "대화방에 들어갈 수 있는 사람") */
function accessRoom(chatRoomId: Id): Room {
  const r = roomOf(toAppId(chatRoomId))
  if (!r || (r.kind === 'group' && !findMeetup(r.meetupId!))) throw notFound('CHAT_ROOM', '대화방을 찾을 수 없습니다.')
  return r
}
function visibleRooms(): Room[] {
  syncGroupRooms()
  return getChatState().rooms
    .filter((r) => r.kind === 'dm' || !!findMeetup(r.meetupId!))
    .sort((a, b) => lastAt(b) - lastAt(a))
}
function visibleRequests(dir: Req['direction']): Req[] {
  return liveRequests().filter((q) => q.direction === dir)
}
const reqNotFound = () => notFound('CHAT_REQUEST', '대화 요청을 찾을 수 없습니다.')

export const mock: ChatApi = {
  rooms: (signal) => mockRead(() => items(visibleRooms().map(roomSummaryDto)), { signal, empty: () => items([]) }),
  room: (chatRoomId, signal) => mockRead(() => { syncGroupRooms(); return roomDetailDto(accessRoom(chatRoomId)) }, { signal, detail: 'CHAT_ROOM' }),
  messages: (chatRoomId, q = {}, signal) => mockRead(() => {
    const r = accessRoom(chatRoomId)
    const newest = [...r.messages].reverse().map(messageDto)
    return cursorPage(newest, q.cursor, Math.min(100, Math.max(1, q.size ?? CHAT_MESSAGES_PAGE)))
  }, { signal, empty: () => emptyCursor() }),
  sendMessage: (chatRoomId, body) => mockWrite(() => {
    const text = body.content ?? ''
    const ids = body.imageIds ?? []
    if (ids.length > CHAT_IMAGES_MAX) throw invalidInput({ imageIds: `사진은 ${CHAT_IMAGES_MAX}장까지 붙일 수 있습니다.` })
    if (!text.trim() && !ids.length) throw invalidInput({ content: '메시지를 입력해 주세요.' })
    if (text.length > CHAT_MESSAGE_MAX) throw invalidInput({ content: `메시지는 ${CHAT_MESSAGE_MAX}자를 넘을 수 없습니다.` })
    // 사진은 08 POST /images 목이 올려 둔 것 (data/boardStore 의 uploaded_image 자리). 붙이면 다른 곳에 다시 못 씀
    const pics = ids.map((n) => { const id = toAppId(n); const img = uploadedImage(id); if (!img?.url) throw invalidInput({ imageIds: '쓸 수 없는 사진입니다.' }); return { id, url: img.url } })
    const r = accessRoom(chatRoomId)
    if (r.kind === 'dm' && r.closed) throw conflict('CHAT_ROOM_READ_ONLY', '상대가 나가 메시지를 보낼 수 없는 대화방입니다.')
    for (const p of pics) claimImage(p.id)
    const msg = appendMessage(r.id, { authorId: ME_ID, text: body.content ?? '', images: pics })!
    emitMessage(r.id, msg) // 보낸 사람도 받음 (명세)
    scheduleReply(r.id)
    return messageDto(msg)
  }),
  read: (chatRoomId, messageId) => mockWrite(() => {
    const r = accessRoom(chatRoomId)
    if (!r.messages.some((m) => toDtoId(m.id) === messageId)) throw invalidInput({ messageId: '이 대화방의 메시지가 아닙니다.' })
    markReadUpTo(r.id, messageId)
    markChatNoticesRead(r.id) // 서버가 함께 하는 일: 그 방의 새 메시지 알림도 읽음 (명세 06 · 09)
    return { unreadCount: unreadOf(roomOf(r.id)!) }
  }),
  leave: (chatRoomId) => mockWrite(() => {
    const r = accessRoom(chatRoomId)
    if (r.kind === 'group' && !meetupEnded(r)) throw conflict('CHAT_ROOM_LEAVE_NOT_ALLOWED', '끝나지 않은 모임의 대화방에서는 나갈 수 없습니다.')
    leaveRoom(r.id)
    return null
  }),
  setNotice: (chatRoomId, content) => mockWrite(() => {
    const t = (content ?? '').trim()
    if (!t) throw invalidInput({ content: '공지를 입력해 주세요.' })
    if (content.length > CHAT_NOTICE_MAX) throw invalidInput({ content: `공지는 ${CHAT_NOTICE_MAX}자를 넘을 수 없습니다.` })
    const r = accessRoom(chatRoomId)
    if (r.kind !== 'group' || findMeetup(r.meetupId!)?.hostId !== ME_ID) throw forbidden('주최자만 공지를 쓸 수 있습니다.')
    setNotice(r.id, content)
    return { notice: roomOf(r.id)!.notice ?? content }
  }),
  deleteNotice: (chatRoomId) => mockWrite(() => {
    const r = accessRoom(chatRoomId)
    if (r.kind !== 'group' || findMeetup(r.meetupId!)?.hostId !== ME_ID) throw forbidden('주최자만 공지를 지울 수 있습니다.')
    setNotice(r.id, null)
    return null
  }),
  requests: (direction, signal) => mockRead(() => {
    if (direction !== 'RECEIVED' && direction !== 'SENT') throw invalidInput({ direction: 'RECEIVED 나 SENT 여야 합니다.' })
    return items(visibleRequests(direction === 'RECEIVED' ? 'received' : 'sent').map(requestDto))
  }, { signal, empty: () => items([]) }),
  requestCount: (signal) => mockRead(() => ({ receivedCount: visibleRequests('received').length, sentCount: visibleRequests('sent').length }), {
    signal, empty: () => ({ receivedCount: 0, sentCount: 0 }),
  }),
  acceptRequest: (chatRequestId) => mockWrite(() => {
    const before = requestById(toAppId(chatRequestId))?.status
    const roomId = acceptRequest(toAppId(chatRequestId))
    if (!roomId) throw reqNotFound()
    if (before === 'PENDING') {
      const first = roomOf(roomId)?.messages[0]
      if (first) emitMessage(roomId, first)
      emitCount()
    }
    return { chatRoomId: toDtoId(roomId) }
  }),
  rejectRequest: (chatRequestId) => mockWrite(() => {
    const before = requestById(toAppId(chatRequestId))?.status
    if (!rejectRequest(toAppId(chatRequestId))) throw reqNotFound()
    if (before === 'PENDING') emitCount()
    return null
  }),
  cancelRequest: (chatRequestId) => mockWrite(() => {
    const res = cancelRequest(toAppId(chatRequestId))
    if (!res.ok && res.accepted) throw conflict('CHAT_REQUEST_ALREADY_ACCEPTED', '상대가 이미 수락한 요청입니다.', { chatRoomId: toDtoId(res.accepted) })
    if (!res.ok) throw reqNotFound()
    // 받은 사람에게 가는 CHAT_REQUEST_COUNT_CHANGED 는 목에서 받을 사람이 없음
    return null
  }),
}

/* ===== 상대 답장 흉내 · 시험 손잡이 ===== */
const REPLIES = ['오 좋아요! 😊', '헉 저도 그 생각 했어요 ㅋㅋ', '좋아요, 그럼 그때 봬요!', '앗 그거 완전 궁금했어요', '그거 저도 해 보고 싶었어요!']
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
let rtMode: 'normal' | 'flaky' | 'down' | 'quiet' = 'normal'

/** 상대 · 모임 참여자 한 명이 답함 (소식으로 옴). 모임은 가끔만 */
function scheduleReply(roomId: string) {
  if (rtMode === 'quiet') return
  const r = roomOf(roomId)
  if (!r || r.closed) return
  const others = r.kind === 'dm' ? [r.partnerId!] : membersOf(r).filter((x) => x !== ME_ID)
  if (!others.length || (r.kind === 'group' && Math.random() < 0.4)) return
  const who = pick(others)
  setTimeout(() => incoming(r.id, pick(REPLIES), who), 1500 + Math.random() * 2000)
}
/** 남이 보낸 메시지 → 그 방에 있는 나에게 CHAT_MESSAGE_RECEIVED (대화방마다 한 줄로 묶임, 명세 09) */
const notifyMessage = (roomId: string, from: string) => pushMockNotification('CHAT_MESSAGE_RECEIVED', { actorId: from, targetId: roomId })
/** 상대 메시지 (소식으로 보냄) */
function incoming(roomId: string, text = pick(REPLIES), from?: string) {
  const r = roomOf(roomId)
  if (!r || r.closed) return null
  const who = from ?? (r.kind === 'dm' ? r.partnerId! : membersOf(r).find((x) => x !== ME_ID))
  if (!who) return null
  const msg = appendMessage(r.id, { authorId: who, text })
  if (msg) { emitMessage(r.id, msg); notifyMessage(r.id, who) }
  return msg
}

let driverStarted = false
/**
 * 목 모드 손잡이 켜기 (useChatEvents 가 목 모드에서 한 번 부름). 주소의 ?rt= 를 읽고, 개발 서버면 콘솔 손잡이를 둠.
 * 모듈을 불러올 때가 아니라 여기서 window 를 만짐 (Next.js 로 옮길 때 서버에서 불려도 괜찮게)
 */
export function startChatMockDriver() {
  if (driverStarted || typeof window === 'undefined') return
  driverStarted = true
  try {
    const m = (location.search + location.hash).match(/[?&]rt=(flaky|down|quiet|normal)\b/)
    if (m) rtMode = m[1] as typeof rtMode
  } catch { /* 무시 */ }
  if (rtMode === 'down') mockEvents.down(true)
  if (rtMode === 'flaky') {
    const loop = () => setTimeout(() => {
      const ms = 2000 + Math.random() * 6000
      mockEvents.drop(ms)
      // 끊긴 동안 상대가 보낸 메시지 (소식은 사라지고, 다시 붙으면 조회 API 로 받아 옴)
      setTimeout(() => {
        const r = getChatState().rooms.find((x) => x.kind === 'dm' && !x.closed)
        if (r && appendMessage(r.id, { authorId: r.partnerId!, text: '(끊긴 동안 보낸 메시지) ' + pick(REPLIES) })) notifyMessage(r.id, r.partnerId!)
      }, ms / 2)
      loop()
    }, 20_000 + Math.random() * 20_000)
    loop()
  }
  if (ENV.dev || /[?&]rt=/.test(location.search + location.hash)) {
    (window as unknown as { __digulChat?: unknown }).__digulChat = {
      /** 상대 메시지 오기 */
      incoming: (roomId = 'r-yerin', text?: string) => incoming(roomId, text),
      /** 새 대화 요청 받기 (요청 N 이 바로 바뀜) */
      request: (userId = 'kim', message = '안녕하세요! 대화하고 싶어요') => {
        const q = receiveRequest(userId, message)
        emitCount()
        pushMockNotification('CHAT_REQUEST_RECEIVED', { actorId: userId, targetId: q.id })
        return q.id
      },
      /** 1:1 상대가 나감 · 탈퇴 → 읽기 전용 */
      partnerLeaves: (roomId = 'r-mingu', gone = false) => { const msg = closeByPartner(roomId, gone ? 'gone' : 'left'); if (msg) emitMessage(roomId, msg) },
      /** 실시간 연결 끊기 */
      drop: (ms = 5000) => mockEvents.drop(ms),
      receivedCount: () => receivedCount(),
    }
  }
}
