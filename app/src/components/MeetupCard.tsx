import { Link } from 'react-router-dom'
import { CATEGORIES, toneOf } from '../data/mock'
import type { Meetup } from '../data/types'
import { dateLabel } from '../lib/format'
import InterestChip from './InterestChip'
import styles from './MeetupCard.module.css'

function emojiOf(interest: string) {
  return CATEGORIES.find((c) => c.tags.some((t) => t.name === interest))?.emoji ?? '🌱'
}

/** Figma: Meetup Card (307×284) */
export default function MeetupCard({ m }: { m: Meetup }) {
  const left = m.capacity - m.memberIds.length
  const tone = toneOf(m.interest)
  return (
    <Link to={`/meetups/${m.id}`} className={styles.card}>
      <div className={styles.thumb} style={{ background: `var(--tone-${tone}-bg)` }}>
        <span aria-hidden>{emojiOf(m.interest)}</span>
        {m.myStatus && <em className={styles.status}>{m.myStatus}</em>}
      </div>
      <div className={styles.body}>
        <InterestChip label={m.interest} />
        <strong className={styles.title}>{m.title}</strong>
        <span className={styles.meta}>{dateLabel(m.date)} {m.start} · {m.area}</span>
        <span className={styles.foot}>
          <span>{m.memberIds.length} / {m.capacity}명</span>
          <span className={left <= 2 ? styles.hot : ''}>{left > 0 ? `${left}자리 남음` : '마감'}</span>
        </span>
      </div>
    </Link>
  )
}

export { emojiOf }
