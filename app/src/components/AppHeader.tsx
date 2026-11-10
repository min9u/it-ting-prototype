import { NavLink, Link } from 'react-router-dom'
import logo from '../assets/logo.png'
import { BellIcon, GearIcon } from './Icons'
import styles from './AppHeader.module.css'

/** Figma: Review/Navigation (1440×63) + Nav Pill (State=Active/Default) */
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

export default function AppHeader({ hasAlert = true }: { hasAlert?: boolean }) {
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
        <button className={styles.iconBtn} aria-label={hasAlert ? '알림 (새 알림 있음)' : '알림'}>
          <BellIcon size={21} />
          {hasAlert && <span className={styles.dot} />}
        </button>
        <button className={styles.iconBtn} aria-label="설정">
          <GearIcon size={21} />
        </button>
      </div>
    </header>
  )
}
