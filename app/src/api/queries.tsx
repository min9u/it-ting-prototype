/**
 * 화면이 쓰는 데이터 훅 (TanStack Query). 응답은 mappers.ts 로 앱 모양으로 바꿔서 돌려줌.
 * 화면은 { isPending, isError, error, data } 로 로딩 · 오류 · 진짜 없음(404) 을 나눠 그림 (components/AsyncState.tsx)
 *
 * 쓰기는 useOptimistic(): 캐시를 먼저 바꾸고 → 서버 호출 → 실패하면 되돌리고 오류 토스트 → 끝나면 관련 키를 새로 받음
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey,
} from '@tanstack/react-query'
import { api } from '.'
import { API_MODE } from './config'
import { isAbort, isApiError, isUnauthorized } from './client'
import {
  toAppNotice, toBoardPost, toBurrow, toChatReq, toChatRoomItem, toGuestbookEntry, toMeetupCard, toMeetupDetail,
} from './mappers'
import { qk, showErrorToast } from './queryClient'
import type { ChatRoomQuery } from './chat'
import type { MeetupListQuery, NotificationCategory, PostListQuery } from './types'
import { useMeetups } from '../data/meetupStore'
import { usePosts } from '../data/boardStore'
import { useChat } from '../data/chat'
import { useNotices } from '../data/notifications'
import { getRegulars, subscribeRegulars } from '../data/field'

/* ===== 모임 ===== */
export function useMeetupList(q: MeetupListQuery) {
  return useQuery({
    queryKey: qk.meetupList(q),
    queryFn: async ({ signal }) => { const p = await api.meetups.list(q, signal); return { ...p, items: p.items.map(toMeetupCard) } },
    // 거르기를 바꿔도 이전 목록을 보여 주다가 바꿔 끼움 (스켈레톤이 깜빡이지 않게)
    placeholderData: keepPreviousData,
  })
}
export function useMeetupDetail(id: string) {
  return useQuery({ queryKey: qk.meetup(id), queryFn: async ({ signal }) => toMeetupDetail(await api.meetups.get(id, signal)) })
}

/* ===== 커뮤니티 ===== */
export function usePostList(q: PostListQuery, enabled = true) {
  return useQuery({
    queryKey: qk.postList(q),
    queryFn: async ({ signal }) => { const p = await api.board.list(q, signal); return { ...p, items: p.items.map((d) => toBoardPost(d)) } },
    placeholderData: keepPreviousData,
    enabled,
  })
}
/** 글 + 댓글 (댓글은 커서지만 지금 화면은 "N개 더 보기"를 앱 안에서 하므로 한 번에 100개) */
export function usePostDetail(id: string) {
  return useQuery({
    queryKey: qk.post(id),
    queryFn: async ({ signal }) => {
      const [p, c] = await Promise.all([api.board.get(id, signal), api.board.comments(id, null, 100, signal)])
      return toBoardPost(p, c.items)
    },
  })
}

/* ===== 땅굴 ===== */
export function useBurrow(userId: string, enabled = true) {
  return useQuery({ queryKey: qk.burrow(userId), queryFn: async ({ signal }) => toBurrow(await api.burrows.get(userId, signal)), enabled })
}
export function useGuestbook(userId: string) {
  return useQuery({
    queryKey: qk.guestbook(userId),
    queryFn: async ({ signal }) => (await api.burrows.guestbook(userId, null, 50, signal)).items.map(toGuestbookEntry),
  })
}

/* ===== 알림 (커서: "더 보기" = 다음 쪽) ===== */
export function useNotificationList(category?: NotificationCategory) {
  return useInfiniteQuery({
    queryKey: qk.notificationList(category),
    queryFn: ({ pageParam, signal }) => api.notifications.list({ category, cursor: pageParam, size: 20 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    select: (d) => ({ items: d.pages.flatMap((p) => p.items.map(toAppNotice)), unreadCount: d.pages[0]?.unreadCount ?? 0 }),
  })
}

/* ===== 채팅 (목록 · 요청) ===== */
export function useChatRooms(q: ChatRoomQuery = {}) {
  return useQuery({
    queryKey: qk.chatRooms(q),
    queryFn: async ({ signal }) => (await api.chat.rooms(q, signal)).map(toChatRoomItem),
    placeholderData: keepPreviousData,
  })
}
export function useChatRequests() {
  return useQuery({ queryKey: qk.chatRequests, queryFn: async ({ signal }) => (await api.chat.requests(signal)).map(toChatReq) })
}

/* ===== 쓰기: 낙관적 업데이트 ===== */
export interface CachePatch { key: QueryKey; update: (old: unknown) => unknown; exact?: boolean }
/**
 * 캐시 한 곳을 어떻게 바꿀지 (key 가 앞부분이면 맞는 캐시 모두).
 * exact: 키가 똑같은 캐시만 — 땅굴(['burrows', id])을 바꿀 때 같은 앞부분을 쓰는 방명록(['burrows', id, 'guestbook'])까지 땅굴 모양으로 덮어써 깨지던 것을 막음
 */
export const patch = <T,>(key: QueryKey, update: (old: T) => T, exact = false): CachePatch => ({ key, update: update as (old: unknown) => unknown, exact })

export interface OptimisticOp<T = unknown> {
  call: () => Promise<T>
  patches?: CachePatch[]
  /** 끝나면 새로 받을 키 (기본: patches 의 키) */
  invalidate?: QueryKey[]
  /** 실패 토스트 제목 (기본 "저장하지 못했어요") */
  errorTitle?: string
}

/** 쓰기 오류 → 토스트 문구. 서버 message 를 그대로 (한국어 규약) */
export function toastApiError(e: unknown, title = '저장하지 못했어요') {
  if (isAbort(e) || isUnauthorized(e)) return
  showErrorToast(title, isApiError(e) ? e.message : '잠시 뒤 다시 시도해 주세요.')
}

export function useOptimistic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (op: OptimisticOp) => op.call(),
    onMutate: async (op) => {
      const snapshots: [QueryKey, unknown][] = []
      for (const p of op.patches ?? []) {
        await qc.cancelQueries({ queryKey: p.key })
        for (const [k, v] of qc.getQueriesData({ queryKey: p.key, exact: p.exact })) {
          snapshots.push([k, v])
          if (v !== undefined) qc.setQueryData(k, p.update(v))
        }
      }
      return { snapshots }
    },
    onError: (e, op, ctx) => {
      for (const [k, v] of ctx?.snapshots ?? []) qc.setQueryData(k, v)
      toastApiError(e, op.errorTitle)
    },
    onSettled: (_d, _e, op) => {
      for (const k of op.invalidate ?? op.patches?.map((p) => p.key) ?? []) void qc.invalidateQueries({ queryKey: k })
    },
  })
}

/* ===== 목 모드: 저장소가 바뀌면 "서버 값이 바뀐 것"으로 보고 캐시를 새로 받음 =====
 * 아직 api 를 거치지 않는 화면(모임 만들기·내 모임·채팅 대화 등)이 저장소를 직접 바꿔도 목록·상세가 따라오게.
 * 실제 모드에서는 이 역할을 실시간 이벤트(STOMP)와 쓰기 뒤 invalidate 가 함 */
function useInvalidateOnChange(dep: unknown, key: QueryKey) {
  const qc = useQueryClient()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void qc.invalidateQueries({ queryKey: key })
  }, [dep]) // eslint-disable-line react-hooks/exhaustive-deps
}
function MockSyncInner() {
  useInvalidateOnChange(useMeetups(), qk.meetups)
  useInvalidateOnChange(usePosts(), qk.posts)
  useInvalidateOnChange(useChat(), qk.chat)
  useInvalidateOnChange(useNotices(), qk.notifications)
  useInvalidateOnChange(useSyncExternalStore(subscribeRegulars, getRegulars), qk.burrows)
  return null
}
export function MockServerSync() {
  return API_MODE === 'mock' ? <MockSyncInner /> : null
}
