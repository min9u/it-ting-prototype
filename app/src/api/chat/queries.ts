/**
 * 06 채팅 — TanStack Query 훅 · 캐시 키 · 실시간 소식 받기 · 보내기
 *
 * 실시간 (명세 "실시간 소식"): 받기는 SSE 하나(공통 realtime/events.ts), 보내기는 일반 API.
 * - useChatEvents()  로그인 영역(App.tsx AppLayout)에 한 번. CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED 를 캐시에 반영,
 *                    끊겼다 다시 붙으면 채팅 캐시를 모두 새로 받음 (놓친 소식은 다시 오지 않음)
 * - useSendMessage(roomId)  보내는 중 · 실패 · 다시 보내기 (outbox.ts)
 * - useReadReceipt(roomId, lastNum)  열린 대화방에서 마지막 메시지까지 읽음 (POST /read)
 */
import { useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { areaMode } from '../config'
import { isApiError } from '../client'
import { errorText } from '../common/errors'
import { toAppId, toDtoId } from '../common/ids'
import { useMe } from '../auth'
import { useMeetups } from '../../data/meetupStore'
import { ME_ID } from '../../data/mock'
import { useEventStream, useRefetchOnReconnect } from '../../realtime/useEventStream'
import { chatApi } from './api'
import { startChatMockDriver } from './mock'
import { CHAT_ERRORS } from './errors'
import { newClientId, outbox } from './outbox'
import {
  toChatMessage, toChatRequest, toChatRequestCount, toChatRoom, toChatRoomItem,
  type ChatMessage, type ChatRequestCount, type ChatRoomItem, type ChatRoomVM,
} from './mappers'
import {
  CHAT_MESSAGE_CREATED, CHAT_MESSAGES_PAGE, CHAT_REQUEST_COUNT_CHANGED,
  type ChatMessageCreatedEvent, type ChatRequestCountChangedEvent, type ChatRequestDirection,
} from './types'

/** 캐시 키 (첫 칸 'chat') */
export const chatKeys = {
  all: ['chat'] as const,
  rooms: ['chat', 'rooms'] as const,
  roomAll: ['chat', 'room'] as const,
  room: (roomId: string) => ['chat', 'room', roomId] as const,
  messages: (roomId: string) => ['chat', 'messages', roomId] as const,
  /** 모임 상세의 대화 미리보기 (최근 몇 개만) */
  preview: (roomId: string, size: number) => ['chat', 'preview', roomId, size] as const,
  requestsAll: ['chat', 'requests'] as const,
  requests: (dir: ChatRequestDirection) => ['chat', 'requests', dir] as const,
  requestCount: ['chat', 'requestCount'] as const,
}

/** 내 계정 id (메시지 좌우 · "나" 표시). GET /me 가 오기 전에는 목 데이터의 나 */
export function useMyId(): string {
  return useMe().data?.userId || ME_ID
}

/* ===== 조회 ===== */
/** 내 대화 목록 (채팅에 들어올 때마다 새로 받음). 필터 · 검색은 화면이 이 목록에서 거름 (명세) */
export function useChatRooms() {
  return useQuery({
    queryKey: chatKeys.rooms,
    queryFn: async ({ signal }) => (await chatApi.rooms(signal)).items.map(toChatRoomItem),
    refetchOnMount: 'always',
  })
}
/** 대화방 하나 (상대 · 모임 · 공지 · 참여자 · 나가기 종류) */
export function useChatRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.room(roomId ?? ''),
    queryFn: async ({ signal }) => toChatRoom(await chatApi.room(toDtoId(roomId!), signal)),
    enabled: !!roomId,
  })
}
export interface ChatMessagesPage { items: ChatMessage[]; nextCursor: string | null; hasNext: boolean }
/** 메시지 (새 것부터 30개씩. 위로 올리면 fetchNextPage). 화면은 chatMessagesAsc(data) 로 오래된 것부터 */
export function useChatMessages(roomId: string | undefined) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(roomId ?? ''),
    queryFn: async ({ pageParam, signal }): Promise<ChatMessagesPage> => {
      const d = await chatApi.messages(toDtoId(roomId!), { size: CHAT_MESSAGES_PAGE, cursor: pageParam }, signal)
      return { items: d.items.map(toChatMessage), nextCursor: d.nextCursor, hasNext: d.hasNext }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
    enabled: !!roomId,
  })
}
/**
 * 최근 메시지 몇 개만 (07 모임 상세의 "모임 대화" 미리보기: GET /chat-rooms/{chatRoomId}/messages?size=3).
 * 오래된 것부터. roomId 는 모임 상세 응답의 chatRoomId (앱 id), 없으면 부르지 않음
 */
export function useChatPreview(roomId: string | null | undefined, size = 3) {
  return useQuery({
    queryKey: chatKeys.preview(roomId ?? '', size), enabled: !!roomId,
    queryFn: async ({ signal }) => (await chatApi.messages(toDtoId(roomId!), { size }, signal)).items.map(toChatMessage).reverse(),
  })
}
/** 페이지들 → 오래된 것부터 (같은 id 는 한 번) */
export function chatMessagesAsc(data: InfiniteData<ChatMessagesPage> | undefined): ChatMessage[] {
  if (!data) return []
  const seen = new Map<string, ChatMessage>()
  for (const p of data.pages) for (const m of p.items) if (!seen.has(m.id)) seen.set(m.id, m)
  return [...seen.values()].sort((a, b) => a.num - b.num)
}
/** 받은 요청 / 보낸 요청 */
export function useChatRequests(dir: ChatRequestDirection) {
  return useQuery({ queryKey: chatKeys.requests(dir), queryFn: async ({ signal }) => (await chatApi.requests(dir, signal)).items.map((d) => toChatRequest(d, dir)) })
}
/** 받은 · 보낸 요청 수 ("요청 N" = received). 채팅에 들어올 때마다 새로 받음 (만료로 줄어든 것은 소식이 안 옴) */
export function useChatRequestCount() {
  return useQuery({ queryKey: chatKeys.requestCount, queryFn: async ({ signal }) => toChatRequestCount(await chatApi.requestCount(signal)), refetchOnMount: 'always' })
}

/* ===== 쓰기 (앱 id 로 부르는 얇은 감싸개. 화면은 useOptimistic 과 함께 씀) ===== */
export const chatCalls = {
  leave: (roomId: string) => chatApi.leave(toDtoId(roomId)),
  setNotice: (roomId: string, content: string) => chatApi.setNotice(toDtoId(roomId), content),
  deleteNotice: (roomId: string) => chatApi.deleteNotice(toDtoId(roomId)),
  /** 수락 → 만들어진 대화방의 앱 id */
  accept: async (requestId: string) => toAppId((await chatApi.acceptRequest(toDtoId(requestId))).chatRoomId),
  reject: (requestId: string) => chatApi.rejectRequest(toDtoId(requestId)),
  cancel: (requestId: string) => chatApi.cancelRequest(toDtoId(requestId)),
}

/* ===== 캐시 손보기 (소식 · 보내기 결과) ===== */
/** 메시지 캐시에 한 건 넣기 (캐시가 있을 때만, 같은 id 는 한 번) */
export function addMessageToCache(qc: QueryClient, roomId: string, m: ChatMessage) {
  qc.setQueryData<InfiniteData<ChatMessagesPage>>(chatKeys.messages(roomId), (old) => {
    if (!old || !old.pages.length) return old
    if (old.pages.some((p) => p.items.some((x) => x.id === m.id))) return old
    const [first, ...rest] = old.pages
    return { ...old, pages: [{ ...first, items: [m, ...first.items].sort((a, b) => b.num - a.num) }, ...rest] }
  })
}
/** 목록의 그 방: 마지막 메시지 · 안 읽은 수를 바꾸고 맨 위로. 목록에 없으면 false */
function bumpRoom(qc: QueryClient, roomId: string, f: (r: ChatRoomItem) => ChatRoomItem): boolean {
  const list = qc.getQueryData<ChatRoomItem[]>(chatKeys.rooms)
  if (!list) return true
  const r = list.find((x) => x.id === roomId)
  if (!r) return false
  qc.setQueryData<ChatRoomItem[]>(chatKeys.rooms, [f(r), ...list.filter((x) => x !== r)])
  return true
}
export function setRoomUnread(qc: QueryClient, roomId: string, unread: number) {
  qc.setQueryData<ChatRoomItem[]>(chatKeys.rooms, (l) => l?.map((r) => (r.id === roomId ? { ...r, unread } : r)))
}

/** 지금 보고 있는 대화방 (새 메시지가 와도 안 읽은 수를 올리지 않음) */
let activeRoom: string | null = null
const isLooking = (roomId: string) => activeRoom === roomId && (typeof document === 'undefined' || !document.hidden)
export function useActiveChatRoom(roomId: string) {
  useEffect(() => { activeRoom = roomId; return () => { if (activeRoom === roomId) activeRoom = null } }, [roomId])
}

/** CHAT_MESSAGE_CREATED 하나를 캐시에 (명세 "프론트엔드가 소식을 받았을 때 하는 일") */
export function applyChatMessageEvent(qc: QueryClient, ev: ChatMessageCreatedEvent, myId: string) {
  const roomId = toAppId(ev.chatRoomId)
  const m = toChatMessage(ev.message)
  const mine = m.authorId === myId
  // 내가 보낸 것이 응답보다 먼저 소식으로 오면 "보내는 중"을 이것으로 대신함
  if (mine && m.type === 'TEXT') outbox.takeMatching(roomId, ev.message.content, ev.message.images.length)
  addMessageToCache(qc, roomId, m)
  const iLeft = mine && m.type === 'LEFT'
  const closes = !mine && (m.type === 'LEFT' || m.type === 'WITHDRAWN')
  // 대화 목록
  if (iLeft) qc.setQueryData<ChatRoomItem[]>(chatKeys.rooms, (l) => l?.filter((r) => r.id !== roomId))
  else {
    const found = bumpRoom(qc, roomId, (r) => ({
      ...r, last: m, lastAt: m.at, unread: isLooking(roomId) ? 0 : ev.unreadCount,
      ...(r.kind === 'dm' && closes ? { readOnly: true, readOnlyReason: m.type === 'WITHDRAWN' ? 'gone' as const : 'left' as const } : {}),
    }))
    // 목록에 없는 방: 요청이 수락됐거나 모임 참여가 확정돼 새로 생김 → 목록을 다시 받음
    if (!found) void qc.invalidateQueries({ queryKey: chatKeys.rooms })
  }
  // 열려 있는 대화방
  const det = qc.getQueryData<ChatRoomVM>(chatKeys.room(roomId))
  if (det) {
    if (iLeft) void qc.invalidateQueries({ queryKey: chatKeys.room(roomId) })
    else if (det.kind === 'dm' && closes) qc.setQueryData<ChatRoomVM>(chatKeys.room(roomId), { ...det, readOnly: true, readOnlyReason: m.type === 'WITHDRAWN' ? 'gone' : 'left', leaveType: 'LEAVE_ROOM' })
    else if (det.kind === 'group' && (m.type === 'JOINED' || m.type === 'LEFT' || m.type === 'WITHDRAWN')) void qc.invalidateQueries({ queryKey: chatKeys.room(roomId) })
  }
}
export function applyChatRequestCountEvent(qc: QueryClient, ev: ChatRequestCountChangedEvent) {
  const old = qc.getQueryData<ChatRequestCount>(chatKeys.requestCount)
  if (old) qc.setQueryData<ChatRequestCount>(chatKeys.requestCount, { ...old, received: ev.receivedCount })
  else void qc.invalidateQueries({ queryKey: chatKeys.requestCount })
  void qc.invalidateQueries({ queryKey: chatKeys.requests('RECEIVED') })
}

/** 실시간 소식 받기 (로그인 영역에 한 번: App.tsx AppLayout) */
export function useChatEvents() {
  const qc = useQueryClient()
  const myId = useMyId()
  useEffect(() => { if (areaMode('chat') === 'mock') startChatMockDriver() }, [])
  useEventStream<ChatMessageCreatedEvent>(CHAT_MESSAGE_CREATED, (ev) => applyChatMessageEvent(qc, ev, myId))
  useEventStream<ChatRequestCountChangedEvent>(CHAT_REQUEST_COUNT_CHANGED, (ev) => applyChatRequestCountEvent(qc, ev))
  // 끊긴 동안의 소식은 다시 오지 않음 → 대화 목록 · 요청 수 · 열린 대화의 메시지를 조회 API 로 맞춤
  useRefetchOnReconnect([chatKeys.all])
}

/* ===== 보내기 ===== */
/** 보내기 · 다시 보내기 · 지우기. 화면에는 바로 "보내는 중"으로 보이고 실패하면 "다시 보내기" */
export function useSendMessage(roomId: string) {
  const qc = useQueryClient()
  const deliver = (clientId: string) => {
    const p = outbox.find(clientId)
    if (!p) return
    chatApi.sendMessage(toDtoId(p.roomId), { content: p.content, imageIds: p.images.map((i) => toDtoId(i.id)) })
      .then((dto) => {
        const m = toChatMessage(dto)
        addMessageToCache(qc, p.roomId, m)
        bumpRoom(qc, p.roomId, (r) => (r.last && r.last.num >= m.num ? r : { ...r, last: m, lastAt: m.at }))
        outbox.remove(clientId)
      })
      .catch((e: unknown) => {
        outbox.fail(clientId, errorText(e, CHAT_ERRORS))
        // 그 사이 상대가 나갔거나 방이 없어짐 → 방 · 목록을 다시 받아 입력창을 맞춤
        if (isApiError(e) && (e.code === 'CHAT_ROOM_READ_ONLY' || e.code === 'CHAT_ROOM_NOT_FOUND')) {
          void qc.invalidateQueries({ queryKey: chatKeys.room(p.roomId) })
          void qc.invalidateQueries({ queryKey: chatKeys.rooms })
        }
      })
  }
  return {
    /** 빈 메시지(글도 사진도 없음)는 보내지 않음 */
    send: (text: string, images: { id: string; url: string }[] = []) => {
      const content = text.trim() ? text : null
      if (!content && !images.length) return
      const clientId = newClientId()
      outbox.add({ clientId, roomId, content, images, at: Date.now(), status: 'sending' })
      deliver(clientId)
    },
    retry: (clientId: string) => { outbox.resend(clientId); deliver(clientId) },
    discard: (clientId: string) => outbox.remove(clientId),
  }
}

/**
 * 읽음: 열린 대화방에서 화면에 보인 마지막 메시지(lastNum)까지 (명세: 메시지를 받은 뒤 · 새 메시지가 왔을 때).
 * 탭이 숨겨져 있으면 돌아올 때. 응답의 안 읽은 수로 목록을 맞춤
 */
export function useReadReceipt(roomId: string, lastNum: number) {
  const qc = useQueryClient()
  const sent = useRef(0)
  useEffect(() => { sent.current = 0 }, [roomId])
  useEffect(() => {
    if (!lastNum) return
    const go = () => {
      if (document.hidden || lastNum <= sent.current) return
      sent.current = lastNum
      setRoomUnread(qc, roomId, 0)
      chatApi.read(toDtoId(roomId), lastNum).then((r) => setRoomUnread(qc, roomId, r.unreadCount), () => { sent.current = 0 })
    }
    go()
    document.addEventListener('visibilitychange', go)
    return () => document.removeEventListener('visibilitychange', go)
  }, [qc, roomId, lastNum])
}

/** 목 모드: 모임 저장소(참여 확정 · 나감)가 바뀌면 채팅 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useChatMockSync() {
  const meetups = useMeetups()
  useMockStoreSync('chat', meetups, chatKeys.rooms)
  useMockStoreSync('chat', meetups, chatKeys.roomAll)
}
