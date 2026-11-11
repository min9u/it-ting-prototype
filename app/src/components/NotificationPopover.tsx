import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NOTICES, NOTICE_PINNED } from '../data/mock'
import { ChevronRight } from './Icons'
import styles from './NotificationPopover.module.css'

export const KIND_STYLE = {
  채팅: { label: '채', bg: '#5b8a6f' },
  모임: { label: '모', bg: '#c8643a' },
  커뮤니티: { label: '커', bg: '#c49a2c' },
  공지: { label: '공', bg: '#6b4a3a' },
} as const

/**
 * 알림 – 팝업 · 수정안 (탭 제거, 요청 고정) 596:8808
 * 헤더 종 아이콘 아래 400 폭. 모임 참여 요청·채팅 요청 두 줄은 항상 위에 고정, 그 아래 "새로운 알림".
 */
export default function NotificationPopover({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (box.current && !box.current.contains(t) && !t.closest('[data-bell]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    box.current?.focus()
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <div ref={box} className={styles.pop} role="dialog" aria-label="알림" tabIndex={-1}>
      <div className={styles.head}>
        <h2 className="display">알림</h2>
        <button className="link-accent" onClick={() => setRead(true)}>모두 읽음</button>
      </div>
      <ul>
        {NOTICE_PINNED.map((p, i) => (
          <li key={p.id}>
            <Link to={p.to} className={styles.pinned} onClick={onClose}>
              <span className={`${styles.pair} ${i ? styles.pairGreen : ''}`} aria-hidden><i /><i /></span>
              <span className={styles.body}><strong>{p.title}</strong><small>{p.sub}</small></span>
              <span className={styles.count}>{p.count}</span>
              <ChevronRight size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.section}>새로운 알림</p>
      <ul>
        {NOTICES.map((n) => (
          <li key={n.id}>
            <Link to={n.to} className={n.unread && !read ? `${styles.item} ${styles.unread}` : styles.item} onClick={onClose}>
              <span className={styles.kind} style={{ background: KIND_STYLE[n.kind].bg }} aria-label={n.kind}>{KIND_STYLE[n.kind].label}</span>
              <span className={styles.body}><strong>{n.title}</strong><small>{n.sub}</small></span>
              <time>{n.ago}</time>
              {n.unread && !read && <span className={styles.dot} aria-label="읽지 않음" />}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/notifications" className={styles.all} onClick={onClose}>전체 보기</Link>
    </div>
  )
}
