/**
 * TanStack Query 설정 + 캐시 키 + 오류 토스트 저장소
 * - 재시도: GET 재시도는 client.ts(withRetry)·목 서버가 이미 함 → 여기서는 끔 (두 번 겹치지 않게)
 * - staleTime 30초: 화면을 오가도 바로 다시 부르지 않음. 쓰기 뒤에는 관련 키를 invalidate 해서 새로 받음
 * - 401 은 어디서 났든 notifyUnauthorized → main.tsx 가 정한 처리 (로그인 화면으로)
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isUnauthorized, notifyUnauthorized } from './client'
import type { ChatRoomQuery } from './chat'
import type { MeetupListQuery, NotificationCategory, PostListQuery } from './types'
import { createStore } from '../lib/store'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => { if (isUnauthorized(e)) notifyUnauthorized() } }),
  mutationCache: new MutationCache({ onError: (e) => { if (isUnauthorized(e)) notifyUnauthorized() } }),
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

/** 캐시 키 (앞부분이 같으면 한꺼번에 invalidate 할 수 있게 계층으로) */
export const qk = {
  meetups: ['meetups'] as const,
  meetupList: (q: MeetupListQuery) => ['meetups', 'list', q] as const,
  meetup: (id: string) => ['meetups', 'detail', id] as const,
  posts: ['posts'] as const,
  postList: (q: PostListQuery) => ['posts', 'list', q] as const,
  post: (id: string) => ['posts', 'detail', id] as const,
  burrows: ['burrows'] as const,
  burrow: (userId: string) => ['burrows', userId] as const,
  guestbook: (userId: string) => ['burrows', userId, 'guestbook'] as const,
  notifications: ['notifications'] as const,
  notificationList: (category?: NotificationCategory) => ['notifications', 'list', category ?? 'ALL'] as const,
  chat: ['chat'] as const,
  chatRooms: (q: ChatRoomQuery = {}) => ['chat', 'rooms', q] as const,
  chatRequests: ['chat', 'requests'] as const,
}

/* ===== 오류 토스트 (쓰기가 실패해 되돌렸을 때) ===== */
export interface ErrorToast { id: number; title: string; desc?: string }
export const errorToastStore = createStore<{ toast: ErrorToast | null }>({ toast: null })
let toastSeq = 0
export function showErrorToast(title: string, desc?: string) {
  errorToastStore.set({ toast: { id: ++toastSeq, title, desc } })
}
