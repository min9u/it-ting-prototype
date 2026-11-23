import { useState } from 'react'
import { NavLink, Link, useSearchParams } from '@/lib/nav'
import logo from '../assets/logo.png'
import { BellIcon, GearIcon } from './Icons'
import NotificationPopover from './NotificationPopover'
import { useNotificationRealtime, useUnreadNotifications } from '../api/notifications'
import styles from './AppHeader.module.css'

/**
 * Figma: Review/Navigation (1440×63) + Nav Pill (State=Active/Default)
 * 00 공통 1 GNB: 메뉴 4개(땅굴 · 게시판 · 모임 · 채팅). 2026-11-20 "커뮤니티" → "게시판" (팀 명세에서 확정, 주소 /board 는 그대로). 알림 · 설정 화면에서는 어떤 메뉴도 선택하지 않는다(NavLink 라 자동)
 */
const NAV = [
  { to: '/burrow', label: '땅굴' },
  { to: '/board', label: '게시판' },
  { to: '/meetups', label: '모임' },
  { to: '/chat', label: '채팅' },
]

export function Logo({ to = '/burrow' }: { to?: string }) {
  return (
    <Link to={to} className={styles.logo} aria-label="디굴디굴 홈">
      <img src={logo} alt="디굴디굴" width={92} height={48} />
    </Link>
  )
}

/**
 * 데모용 쿼리: ?notice=open (알림 팝업 열린 채로)
 * 00 공통 2 알림 아이콘: 안 읽은 알림이 있으면 빨간 점(숫자 아님). 끈 종류의 알림은 점에 들어가지 않는다
 * 빨간 점 = GET /me/notifications/unread-count 의 hasUnread, 그 뒤로는 SSE NOTIFICATION_UNREAD_CHANGED 로 바로 바뀜 (09 알림 "실시간 소식")
 */
export default function AppHeader() {
  const [params] = useSearchParams()
  // 알림 실시간 소식은 로그인 영역에 한 번만 받는다 (헤더는 로그인 영역의 모든 화면에 있음)
  useNotificationRealtime()
  const { hasUnread: hasAlert } = useUnreadNotifications()
  const [noticeOpen, setNoticeOpen] = useState(params.get('notice') === 'open')
  return (
    <header className={styles.header}>
      <Logo />
      <nav className={styles.nav} aria-label="주 메뉴">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? `${styles.pill} ${styles.active}` : styles.pill)}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.tools}>
        <button data-bell className={noticeOpen ? `${styles.iconBtn} ${styles.iconOn}` : styles.iconBtn}
          aria-label={hasAlert ? '알림 (새 알림 있음)' : '알림'} aria-expanded={noticeOpen} onClick={() => setNoticeOpen((v) => !v)}>
          <BellIcon size={21} />
          {hasAlert && <span className={styles.dot} />}
        </button>
        {/* 설정 554:21331 */}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? `${styles.iconBtn} ${styles.iconOn}` : styles.iconBtn)} aria-label="설정">
          <GearIcon size={21} />
        </NavLink>
        {noticeOpen && <NotificationPopover onClose={() => setNoticeOpen(false)} />}
      </div>
    </header>
  )
}
