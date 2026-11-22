/** 09 알림 — TanStack Query 훅과 캐시 키 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { useNotices } from '../../data/notifications'
import { notificationsApi } from './api'
import { toAppNotice } from './mappers'
import type { NotificationCategory } from './types'

/** 캐시 키 (첫 칸 'notifications') */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (category?: NotificationCategory) => ['notifications', 'list', category ?? 'ALL'] as const,
}

/** 알림 목록 (커서: "더 보기" = 다음 쪽) */
export function useNotificationList(category?: NotificationCategory) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(category),
    queryFn: ({ pageParam, signal }) => notificationsApi.list({ category, cursor: pageParam, size: 20 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : null),
    select: (d) => ({ items: d.pages.flatMap((p) => p.items.map(toAppNotice)), unreadCount: d.pages[0]?.unreadCount ?? 0 }),
  })
}

/** 목 모드: 알림 저장소가 바뀌면 알림 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useNotificationsMockSync() { useMockStoreSync('notifications', useNotices(), notificationKeys.all) }
