import { useEffect, useRef } from 'react'
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom'
import {
  KIND_META, markAllNoticesRead, markNoticeRead, useMeetupRequests, useNoticePrefs, useNotices, visibleNotices,
  type AppNotice,
} from '../data/notifications'
import { liveRequests, personOf, useChat } from '../data/chat'
import { noticeTime } from '../lib/store'
import { ChevronRight } from './Icons'
import styles from './NotificationPopover.module.css'

/** 알림 한 줄을 눌렀을 때: 읽음 처리 → 해당 화면, 원본이 사라졌으면 안내 화면(00 공통 21) */
export function openNotice(n: AppNotice, navigate: NavigateFunction) {
  markNoticeRead(n.id)
  navigate(n.gone ? `/gone/${n.gone}` : n.to)
}

/** 알림 한 줄 (팝업 · 알림 화면 공용): 종류 아이콘, 제목 한 줄, 보조 설명, 시간, 읽지 않음 점 */
export function NoticeRow({ n, onOpen, wide }: { n: AppNotice; onOpen: (n: AppNotice) => void; wide?: boolean }) {
  const k = KIND_META[n.kind]
  return (
    <button type="button" className={`${styles.item} ${n.unread ? styles.unread : ''} ${wide ? styles.wide : ''}`} onClick={() => onOpen(n)}>
      <span className={styles.kind} style={{ background: k.bg }} aria-label={n.kind}>{k.label}</span>
      <span className={styles.body}><strong>{n.title}</strong><small>{n.sub}</small></span>
      <time dateTime={new Date(n.at).toISOString()}>{noticeTime(n.at)}</time>
      <span className={n.unread ? styles.dot : styles.noDot} aria-label={n.unread ? '읽지 않음' : undefined} />
    </button>
  )
}

/**
 * 알림 – 팝업 (Desktop) · 요청 없음 (Figma 02 F9, 2026-11-16 명세)
 * - 제목 줄: "알림" + 모두 읽음
 * - 요청 고정 영역: 모임 참여 요청 · 채팅 요청 두 줄은 항상 맨 위. 처리 안 한 요청이 있으면 빨간 숫자 배지,
 *   채팅 요청만 "OO님 외 N명" 보조 문구. 누르면 팝업을 닫고 신청 관리 / 채팅 › 요청 › 받은 요청으로 이동
 * - 최근 알림 5개 (요청 알림은 빼고, 안 읽은 것 맨 위), 전체 보기 → 알림 화면
 */
export default function NotificationPopover({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const list = useNotices()
  const { kinds } = useNoticePrefs()
  const chat = useChat()
  const meetupReq = useMeetupRequests()
  const received = liveRequests(chat).filter((r) => r.direction === 'received')
  const recent = visibleNotices(list, kinds).filter((n) => !n.request).slice(0, 5)

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

  const pinned = [
    { id: 'meetup', title: '모임 참여 요청', sub: '', count: meetupReq.count, to: meetupReq.to, green: false },
    {
      id: 'chat', title: '채팅 요청', count: received.length, to: '/chat/requests', green: true,
      sub: received.length ? `${personOf(received[0].userId).nickname}님${received.length > 1 ? ` 외 ${received.length - 1}명` : ''}` : '',
    },
  ]

  return (
    <div ref={box} className={styles.pop} role="dialog" aria-label="알림" tabIndex={-1}>
      <div className={styles.head}>
        <h2 className="display">알림</h2>
        <button className={styles.readAll} onClick={markAllNoticesRead}>모두 읽음</button>
      </div>
      <ul className={styles.pinnedList}>
        {pinned.map((p) => (
          <li key={p.id}>
            <Link to={p.to} className={styles.pinned} onClick={onClose}>
              <span className={`${styles.pair} ${p.green ? styles.pairGreen : ''}`} aria-hidden><i /><i /></span>
              <span className={styles.body}><strong>{p.title}</strong>{p.count > 0 && p.sub && <small>{p.sub}</small>}</span>
              {p.count > 0 && <span className={styles.count} aria-label={`처리하지 않은 요청 ${p.count}개`}>{p.count}</span>}
              <ChevronRight size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.section}>최근 알림</p>
      {recent.length === 0 ? (
        <p className={styles.none}>새 알림이 없어요</p>
      ) : (
        <ul>
          {recent.map((n) => (
            <li key={n.id}><NoticeRow n={n} onOpen={(x) => { onClose(); openNotice(x, navigate) }} /></li>
          ))}
        </ul>
      )}
      <Link to="/notifications" className={styles.all} onClick={onClose}>전체 보기</Link>
    </div>
  )
}
