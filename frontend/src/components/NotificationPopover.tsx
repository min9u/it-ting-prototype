import { useEffect, useRef } from 'react'
import { Link, useNavigate } from '@/lib/nav'
import { KIND_META } from '../data/notifications'
import { useNotificationPopup, useReadAllNotifications, useReadNotification, type AppNotice } from '../api/notifications'
import { ErrorState, SkeletonRows } from './AsyncState'
import { noticeTime } from '../lib/store'
import { ChevronRight } from './Icons'
import styles from './NotificationPopover.module.css'

/** 알림 한 줄 (팝업 · 알림 화면 공용): 종류 아이콘, 제목 한 줄, 보조 설명, 시간, 읽지 않음 점 */
export function NoticeRow({ n, onOpen, wide }: { n: AppNotice; onOpen: (n: AppNotice) => void; wide?: boolean }) {
  const k = KIND_META[n.kind]
  return (
    <button type="button" className={`${styles.item} ${n.unread ? styles.unread : ''} ${wide ? styles.wide : ''}`} onClick={() => onOpen(n)} title={n.label}>
      <span className={styles.kind} style={{ background: k.bg }} aria-label={n.kind}>{k.label}</span>
      <span className={styles.body}><strong>{n.title}</strong><small>{n.sub}</small></span>
      <time dateTime={new Date(n.at).toISOString()}>{noticeTime(n.at)}</time>
      <span className={n.unread ? styles.dot : styles.noDot} aria-label={n.unread ? '읽지 않음' : undefined} />
    </button>
  )
}

/**
 * 알림 – 팝업 (Desktop) · 요청 없음 — 명세 spec/09 팝업 1~7, API GET /me/notifications/popup
 * - 제목 줄: "알림" + 모두 읽음 (POST /me/notifications/read-all. 요청 두 줄의 숫자는 그대로)
 * - 요청 고정 영역: 모임 참여 요청 · 채팅 요청 두 줄은 항상 맨 위. 수가 0이면 배지 · 보조 문구를 숨김.
 *   채팅 요청 보조 문구 "OO님 외 N명" 은 latestChatRequester + chatRequestCount 로 만든다.
 *   모임 참여 요청은 내 모임 › 내가 연 모임으로 간다 (팝업 API 가 모임 id 를 주지 않아 "신청이 온 모임이 하나면 그 모임 신청 관리"는 못 함 → 문서 결정)
 * - 최근 알림 5개 (서버가 요청 알림을 빼고 안 읽은 것 먼저 줌). 누르면 읽음(POST read) + 이동
 * - 전체 보기 → 알림 화면
 */
export default function NotificationPopover({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const q = useNotificationPopup()
  const read = useReadNotification()
  const { readAll } = useReadAllNotifications()
  const p = q.data

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

  const open = (n: AppNotice) => { read(n); onClose(); navigate(n.to) }

  const pinned = [
    { id: 'meetup', title: '모임 참여 요청', sub: '', count: p?.meetupRequestCount ?? 0, to: '/meetups/me?tab=hosting', green: false },
    { id: 'chat', title: '채팅 요청', sub: p?.chatRequestSub ?? '', count: p?.chatRequestCount ?? 0, to: '/chat/requests', green: true },
  ]

  return (
    <div ref={box} className={styles.pop} role="dialog" aria-label="알림" tabIndex={-1}>
      <div className={styles.head}>
        <h2 className="display">알림</h2>
        <button className={styles.readAll} onClick={readAll}>모두 읽음</button>
      </div>
      <ul className={styles.pinnedList}>
        {pinned.map((x) => (
          <li key={x.id}>
            <Link to={x.to} className={styles.pinned} onClick={onClose}>
              <span className={`${styles.pair} ${x.green ? styles.pairGreen : ''}`} aria-hidden><i /><i /></span>
              <span className={styles.body}><strong>{x.title}</strong>{x.count > 0 && x.sub && <small>{x.sub}</small>}</span>
              {x.count > 0 && <span className={styles.count} aria-label={`처리하지 않은 요청 ${x.count}개`}>{x.count}</span>}
              <ChevronRight size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.section}>최근 알림</p>
      {q.isPending ? (
        <SkeletonRows count={3} label="알림을 불러오는 중" compact />
      ) : q.isError && !p ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} title="알림을 불러오지 못했어요" />
      ) : !p || p.recent.length === 0 ? (
        <p className={styles.none}>새 알림이 없어요</p>
      ) : (
        <ul>
          {p.recent.map((n) => <li key={n.id}><NoticeRow n={n} onOpen={open} /></li>)}
        </ul>
      )}
      <Link to="/notifications" className={styles.all} onClick={onClose}>전체 보기</Link>
    </div>
  )
}
