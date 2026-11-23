import type { ReactNode } from 'react'
import { Link } from '@/lib/nav'
import { meetupToneOf } from '../data/meetupCategory'
import type { Meetup } from '../data/types'
import { dateLabel } from '../lib/format'
import InterestChip from './InterestChip'
import { CalendarIcon, PinIcon } from './Icons'
import styles from './MeetupCard.module.css'

/** 모집 상태: 모집 중 / 모집 완료 ("마감 임박"은 명세 07 범위 밖이라 뺌, 2026-11-22). 모임 화면은 서버 recruitStatus 로 badge 를 넘김 */
export function recruitOf(m: Meetup): { label: string; tone: 'open' | 'hot' | 'done' } {
  const left = m.capacity - m.memberIds.length
  if (left <= 0 || m.past) return { label: '모집 완료', tone: 'done' }
  return { label: '모집 중', tone: 'open' }
}

/**
 * Figma: Meetup Card (258×294, 2026-11-11) — 흙 위 나무 팻말 + 상태 알약, 아래에 관심사·제목·일시·장소·인원
 * - badge: 내 모임에서 "신청 대기 · D-3" 처럼 상태 알약을 바꿔 끼울 때
 * - actions: 내 모임 카드 아래 버튼 두 개 (모임 상세 / 신청 취소 …)
 */
export default function MeetupCard({ m, badge, actions, people, place, done: doneProp, wish }: {
  m: Meetup
  badge?: { label: string; tone: 'open' | 'hot' | 'done' | 'wait' }
  actions?: ReactNode
  /** 인원 글자 덮어쓰기 (예: 주최자 포함 확정 "4 / 6명") */
  people?: string
  /** 장소 글자 덮어쓰기 (예: 캠퍼스를 앞에 붙인 "서울 · 성수동 · 오프라인") */
  place?: string
  /** 모집 완료처럼 흐리게 (badge 와 함께 쓸 때) */
  done?: boolean
  /** 카드 위 찜 하트 */
  wish?: { on: boolean; onToggle: () => void }
}) {
  const r = recruitOf(m)
  const b = badge ?? r
  const done = doneProp ?? (r.tone === 'done' && !badge)
  const body = (
    <>
      <div className={done ? `${styles.thumb} ${styles.thumbDone}` : styles.thumb}>
        <em className={`${styles.status} ${styles[b.tone]}`}><i aria-hidden />{b.label}</em>
        <span className={done ? `${styles.sign} ${styles.signDone}` : styles.sign}>{done ? b.label : m.sign ?? m.category}</span>
        <span className={styles.post} aria-hidden />
        {wish && (
          <button type="button" className={wish.on ? `${styles.wish} ${styles.wishOn}` : styles.wish} aria-pressed={wish.on} aria-label={wish.on ? '찜 해제' : '찜하기'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); wish.onToggle() }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wish.on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          </button>
        )}
      </div>
      <div className={styles.body}>
        <InterestChip label={m.category} tone={meetupToneOf(m.category)} />
        <strong className={styles.title}>{m.title}</strong>
        <span className={styles.when}><CalendarIcon size={14} /> {dateLabel(m.date)} {m.start}</span>
        <span className={styles.meta}>
          <span><PinIcon size={14} /> {place ?? (m.area === '온라인' ? '온라인' : `${m.area} · ${m.mode}`)}</span>
          {!actions && <span className={styles.people}>👥 {people ?? `${m.memberIds.length} / ${m.capacity}명`}</span>}
        </span>
      </div>
    </>
  )
  if (actions) {
    return (
      <div className={styles.card}>
        <Link to={`/meetups/${m.id}`} className={styles.linkArea}>{body}</Link>
        <div className={styles.actions}>{actions}</div>
      </div>
    )
  }
  return <Link to={`/meetups/${m.id}`} className={done ? `${styles.card} ${styles.cardDone}` : styles.card}>{body}</Link>
}

