import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { InfiniteData } from '@tanstack/react-query'
import { NOTICE_KINDS, type AppNotice, type NoticeKind } from '../../data/notifications'
import { NoticeRow } from '../../components/NotificationPopover'
import Footer from '../../components/Footer'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'
import { api, patch, useOptimistic } from '../../api'
import { KIND_CATEGORY, notificationKeys, useNotificationList, type NotificationPageDto } from '../../api/notifications'
import { toIso } from '../../lib/time'
import mound from '../../assets/mole-mound.png'
import s from './Notifications.module.css'

type Tab = '전체' | NoticeKind
const TABS: Tab[] = ['전체', ...NOTICE_KINDS]

/** 알림 캐시(커서 쪽 묶음)의 알림을 읽음으로 */
const readPatch = (pick: (id: string) => boolean) => patch<InfiniteData<NotificationPageDto>>(notificationKeys.all, (o) => {
  const now = toIso(Date.now())
  let read = 0
  const pages = o.pages.map((pg) => ({ ...pg, items: pg.items.map((n) => (!n.readAt && pick(n.id) ? (read++, { ...n, readAt: now }) : n)) }))
  return { ...o, pages: pages.map((pg, i) => (i === 0 ? { ...pg, unreadCount: Math.max(0, pg.unreadCount - read) } : pg)) }
})

/**
 * 알림 (Desktop) — Figma 02 F9 2026-11-16 명세
 * - 제목 "알림" + "안 읽음 N"(0이면 숨김), 모두 읽음
 * - 탭: 전체 / 모임 / 채팅 / 커뮤니티 / 땅굴 / 공지 (설정 › 알림 설정과 같은 순서)
 * - 목록: 안 읽은 알림 맨 위, 그 아래 최신순. 최근 30일, 20개씩 "더 보기" (서버 커서 → api/notifications)
 * - 팝업과 달리 요청 알림(참여 신청 받음 · 대화 요청)도 목록에 나온다
 * - 빈 상태: 두더지 + "새 알림이 없어요" (고른 탭에 알림이 없을 때도)
 * - 불러오는 중: 줄 스켈레톤, 실패: 다시 시도
 * 데모용 쿼리: ?empty=1 (빈 상태), ?tab=모임, ?api=slow|fail|empty (목 서버 손잡이)
 */
export default function Notifications() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : '전체'))
  const q = useNotificationList(tab === '전체' ? undefined : KIND_CATEGORY[tab])
  const run = useOptimistic()
  const shown = params.get('empty') ? [] : q.data?.items ?? []
  const unread = params.get('empty') ? 0 : q.data?.unreadCount ?? 0

  const readAll = () => run.mutate({ call: () => api.notifications.markAllRead(), patches: [readPatch(() => true)], errorTitle: '읽음으로 바꾸지 못했어요' })
  /** 누르면 읽음(먼저 화면에 반영) + 이동. 읽음 저장이 실패해도 이동은 함 */
  const open = (n: AppNotice) => {
    if (n.unread) run.mutate({ call: () => api.notifications.markRead(n.id), patches: [readPatch((id) => id === n.id)], errorTitle: '읽음으로 바꾸지 못했어요' })
    navigate(n.gone ? `/gone/${n.gone}` : n.to)
  }

  return (
    <>
      <main className={s.page}>
        <div className={s.head}>
          <h1 className={`display ${s.title}`}>알림</h1>
          {unread > 0 && <span className={s.unreadPill}>안 읽음 {unread}</span>}
          <button className={s.readAll} onClick={readAll} disabled={!unread}>모두 읽음</button>
        </div>
        <div className={s.tabs} role="tablist" aria-label="알림 종류">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.tabOn : s.tab} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {q.isPending ? (
          <SkeletonRows count={6} label="알림을 불러오는 중" compact />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} title="알림을 불러오지 못했어요" />
        ) : shown.length === 0 ? (
          <div className={s.empty}>
            <img src={mound} alt="" />
            <p className="display">새 알림이 없어요</p>
          </div>
        ) : (
          <>
            <ul className={s.list}>
              {shown.map((n) => <li key={n.id}><NoticeRow n={n} wide onOpen={open} /></li>)}
            </ul>
            {q.hasNextPage && (
              <button className={s.more} onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>{q.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</button>
            )}
            {q.isFetchNextPageError && <ErrorState compact error={q.error} onRetry={() => void q.fetchNextPage()} title="더 불러오지 못했어요" />}
            <p className={s.caption}>안 읽은 알림이 맨 위에 보여요 · 최근 30일 알림만 보관해요</p>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
