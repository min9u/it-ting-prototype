/**
 * 09 알림 — TanStack Query 훅 · 캐시 키 · 실시간 소식(SSE) 받기
 *
 * 화면이 쓰는 것
 *   useUnreadNotifications()     GNB 빨간 점 · "안 읽음 N"  (GET unread-count + SSE NOTIFICATION_UNREAD_CHANGED)
 *   useNotificationPopup()       알림 팝업                   (GET popup)
 *   useNotificationList(cat)     알림 화면, 커서 "더 보기"     (GET /me/notifications)
 *   useReadNotification()        한 줄 누름 → 읽음           (POST /notifications/{id}/read)
 *   useReadAllNotifications()    모두 읽음                   (POST /me/notifications/read-all)
 *   useNotificationRealtime()    로그인 영역에 한 번 (AppHeader): 소식 → 빨간 점 바로 바꾸기 + 열린 팝업 · 목록 다시 받기, 다시 붙으면 모두 다시 받기
 */
import { useEffect } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { areaMode } from '../config'
import { patch, useOptimistic } from '../optimistic'
import { useMockStoreSync } from '../storeSync'
import { toDtoId } from '../common/ids'
import type { CursorPageDto } from '../common/types'
import { useEventStream, useRefetchOnReconnect } from '../../realtime/useEventStream'
import { useNotices } from '../../data/notifications'
import { notificationsApi } from './api'
import { NOTIFICATION_ERRORS } from './errors'
import { NO_UNREAD, toAppNoticeList, toAppNoticePopup, type AppNotice } from './mappers'
import { installMockNotificationServer } from './mock'
import {
  NOTIFICATION_UNREAD_CHANGED,
  type NotificationCategory, type NotificationDto, type NotificationPopupDto, type NotificationUnreadChangedEvent, type NotificationUnreadDto,
} from './types'

/** 캐시 키 (첫 칸 'notifications') */
export const notificationKeys = {
  all: ['notifications'] as const,
  popup: () => ['notifications', 'popup'] as const,
  lists: () => ['notifications', 'list'] as const,
  list: (category?: NotificationCategory | null) => ['notifications', 'list', category ?? 'ALL'] as const,
  unread: () => ['notifications', 'unread-count'] as const,
}

export const NOTIFICATION_PAGE_SIZE = 20

/** 안 읽은 수 + 빨간 점. 처음 한 번 받고, 그 뒤는 SSE 소식이 값을 바꾼다 (useNotificationRealtime) */
export function useUnreadNotifications() {
  const q = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    staleTime: 60_000,
  })
  return { ...(q.data ?? NO_UNREAD), query: q }
}

/** 알림 팝업 (열 때마다 새로 받음) */
export function useNotificationPopup() {
  return useQuery({
    queryKey: notificationKeys.popup(),
    queryFn: ({ signal }) => notificationsApi.popup(signal),
    select: toAppNoticePopup,
    staleTime: 0,
  })
}

/** 알림 목록 (커서: "더 보기" = 다음 20개). category 를 안 주면 전체 */
export function useNotificationList(category?: NotificationCategory | null) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(category),
    queryFn: ({ pageParam, signal }) => notificationsApi.list({ category, cursor: pageParam, size: NOTIFICATION_PAGE_SIZE }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : null),
    select: (d) => toAppNoticeList(d.pages),
  })
}

/* ===== 실시간 소식 ===== */
/**
 * 로그인 영역에 한 번만 부른다 (AppHeader). 명세 "실시간 소식":
 * - NOTIFICATION_UNREAD_CHANGED 의 값으로 빨간 점 · "안 읽음 N" 을 바로 바꾸고, 열려 있는 팝업 · 알림 화면은 목록을 다시 받는다
 * - 끊긴 동안의 소식은 오지 않으므로 다시 붙으면 알림 캐시를 모두 다시 받는다
 */
export function useNotificationRealtime() {
  const qc = useQueryClient()
  useEventStream<NotificationUnreadChangedEvent>(NOTIFICATION_UNREAD_CHANGED, (d) => {
    if (!d || typeof d.unreadCount !== 'number') return
    qc.setQueryData<NotificationUnreadDto>(notificationKeys.unread(), { unreadCount: d.unreadCount, hasUnread: !!d.hasUnread })
    void qc.invalidateQueries({ queryKey: notificationKeys.popup() })
    void qc.invalidateQueries({ queryKey: notificationKeys.lists() })
  })
  useRefetchOnReconnect([notificationKeys.all])
}

/* ===== 읽음 (낙관적) ===== */
type ListCache = InfiniteData<CursorPageDto<NotificationDto>>
const readItems = (items: NotificationDto[], pick: (id: number) => boolean) => items.map((n) => (!n.isRead && pick(n.id) ? { ...n, isRead: true } : n))
const listPatch = (pick: (id: number) => boolean) =>
  patch<ListCache>(notificationKeys.lists(), (o) => ({ ...o, pages: o.pages.map((pg) => ({ ...pg, items: readItems(pg.items, pick) })) }))
const popupPatch = (pick: (id: number) => boolean, all: boolean) =>
  patch<NotificationPopupDto>(notificationKeys.popup(), (o) => {
    const recentItems = readItems(o.recentItems, pick)
    const changed = recentItems.filter((n, i) => n !== o.recentItems[i]).length
    return { ...o, recentItems, unreadCount: all ? 0 : Math.max(0, o.unreadCount - Math.max(changed, 1)) }
  })
const unreadPatch = (all: boolean) =>
  patch<NotificationUnreadDto>(notificationKeys.unread(), (o) => {
    const unreadCount = all ? 0 : Math.max(0, o.unreadCount - 1)
    return { unreadCount, hasUnread: unreadCount > 0 && o.hasUnread }
  })

/** 알림 한 줄을 누를 때: 화면에 먼저 읽음으로 보이고 서버에 저장. 이동은 화면이 한다(저장이 실패해도 이동) */
export function useReadNotification() {
  const run = useOptimistic()
  return (n: Pick<AppNotice, 'id' | 'unread'>) => {
    if (!n.unread) return
    const id = toDtoId(n.id)
    run.mutate({
      call: () => notificationsApi.read(id),
      patches: [listPatch((x) => x === id), popupPatch((x) => x === id, false), unreadPatch(false)],
      errors: NOTIFICATION_ERRORS,
      errorTitle: '읽음으로 바꾸지 못했어요',
      // 30일이 지나 사라진 알림: 이동은 이미 했고, 목록을 새로 받으면 줄이 빠진다
      quietCodes: ['NOTIFICATION_NOT_FOUND'],
    })
  }
}

/** 모두 읽음 (고른 탭과 상관없이 모든 갈래). 요청 두 줄의 수는 그대로 */
export function useReadAllNotifications() {
  const run = useOptimistic()
  return {
    readAll: () => run.mutate({
      call: () => notificationsApi.readAll(),
      patches: [listPatch(() => true), popupPatch(() => true, true), unreadPatch(true)],
      errors: NOTIFICATION_ERRORS,
      errorTitle: '읽음으로 바꾸지 못했어요',
    }),
    pending: run.isPending,
  }
}

/** 목 모드: 알림 저장소가 바뀌면 알림 캐시를 새로 받음 + 목 서버의 실시간 소식 켜기 (api/mockSync.tsx 가 부름) */
export function useNotificationsMockSync() {
  useEffect(() => { if (areaMode('notifications') === 'mock') installMockNotificationServer() }, [])
  useMockStoreSync('notifications', useNotices(), notificationKeys.all)
}
