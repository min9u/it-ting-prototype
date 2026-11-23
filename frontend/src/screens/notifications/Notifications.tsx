import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from '@/lib/nav'
import { CATEGORY_OF_KIND, NOTICE_KINDS, type NoticeKind } from '../../data/notifications'
import { NoticeRow } from '../../components/NotificationPopover'
import Footer from '../../components/Footer'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'
import { useNotificationList, useReadAllNotifications, useReadNotification, useUnreadNotifications, type AppNotice } from '../../api/notifications'
import mound from '../../assets/mole-mound.png'
import s from './Notifications.module.css'

type Tab = '전체' | NoticeKind
const TABS: Tab[] = ['전체', ...NOTICE_KINDS]

/**
 * 알림 (Desktop) — 명세 spec/09 알림 1~8, API GET /me/notifications · GET unread-count · POST read · POST read-all
 * - 제목 "알림" + "안 읽음 N"(unread-count 의 unreadCount, 0이면 숨김), 모두 읽음(모든 갈래)
 * - 탭: 전체 / 모임 / 채팅 / 커뮤니티 / 땅굴 / 공지 (설정 › 알림 설정과 같은 순서). 탭을 바꾸면 목록 · 안 읽은 수를 다시 받음
 * - 목록: 서버가 안 읽은 것 먼저 → 최신순, 최근 30일, 20개씩 "더 보기"(커서). 요청 알림도 나온다
 * - 한 줄을 누르면 읽음 + 갈 곳으로 이동. 원본이 사라졌으면 그 화면이 404 → 안내 화면(00 공통 21)
 * - 빈 상태: 두더지 + "새 알림이 없어요" (고른 탭에 알림이 없을 때도)
 * - 열려 있는 동안 SSE NOTIFICATION_UNREAD_CHANGED 가 오면 목록을 다시 받음 (api/notifications useNotificationRealtime)
 * 데모용 쿼리: ?empty=1 (빈 상태), ?tab=모임, ?api=slow|fail|empty (목 서버 손잡이)
 */
export default function Notifications() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : '전체'))
  const q = useNotificationList(tab === '전체' ? null : CATEGORY_OF_KIND[tab])
  const { unreadCount, query: unreadQ } = useUnreadNotifications()
  const read = useReadNotification()
  const { readAll } = useReadAllNotifications()
  const demoEmpty = !!params.get('empty')
  const shown = demoEmpty ? [] : q.data ?? []
  const unread = demoEmpty ? 0 : unreadCount

  // 명세: 알림 화면을 열 때 · 탭을 바꿀 때 안 읽은 수를 받는다
  const refetchUnread = unreadQ.refetch
  useEffect(() => { void refetchUnread() }, [tab, refetchUnread])

  /** 누르면 읽음(먼저 화면에 반영) + 이동. 읽음 저장이 실패해도 이동은 함 */
  const open = (n: AppNotice) => { read(n); navigate(n.to) }

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
