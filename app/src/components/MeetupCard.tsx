import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../data/mock'
import type { Meetup } from '../data/types'
import { dateLabel } from '../lib/format'
import InterestChip from './InterestChip'
import { CalendarIcon, PinIcon } from './Icons'
import styles from './MeetupCard.module.css'

function emojiOf(interest: string) {
  return CATEGORIES.find((c) => c.tags.some((t) => t.name === interest))?.emoji ?? '🌱'
}

/** 모집 상태: 모집 중 / 마감 임박(1자리) / 모집 완료 */
export function recruitOf(m: Meetup): { label: string; tone: 'open' | 'hot' | 'done' } {
  const left = m.capacity - m.memberIds.length
  if (left <= 0 || m.past) return { label: '모집 완료', tone: 'done' }
  if (left === 1) return { label: '마감 임박', tone: 'hot' }
  return { label: '모집 중', tone: 'open' }
}

/**
 * Figma: Meetup Card (258×294, 2026-11-11) — 흙 위 나무 팻말 + 상태 알약, 아래에 관심사·제목·일시·장소·인원
 * - badge: 내 모임에서 "신청 대기 · D-3" 처럼 상태 알약을 바꿔 끼울 때
 * - actions: 내 모임 카드 아래 버튼 두 개 (모임 상세 / 신청 취소 …)
 */
export default function MeetupCard({ m, badge, actions }: {
  m: Meetup
  badge?: { label: string; tone: 'open' | 'hot' | 'done' | 'wait' }
  actions?: ReactNode
}) {
  const r = recruitOf(m)
  const b = badge ?? r
  const done = r.tone === 'done' && !badge
  const body = (
    <>
      <div className={done ? `${styles.thumb} ${styles.thumbDone}` : styles.thumb}>
        <em className={`${styles.status} ${styles[b.tone]}`}><i aria-hidden />{b.label}</em>
        <span className={done ? `${styles.sign} ${styles.signDone}` : styles.sign}>{done ? '모집 완료' : m.sign ?? m.interest}</span>
        <span className={styles.post} aria-hidden />
      </div>
      <div className={styles.body}>
        <InterestChip label={m.interest} />
        <strong className={styles.title}>{m.title}</strong>
        <span className={styles.when}><CalendarIcon size={14} /> {dateLabel(m.date)} {m.start}</span>
        <span className={styles.meta}>
          <span><PinIcon size={14} /> {m.area === '온라인' ? '온라인' : `${m.area} · ${m.mode}`}</span>
          {!actions && <span className={styles.people}>👥 {m.memberIds.length} / {m.capacity}명</span>}
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

export { emojiOf }
