import { Link } from 'react-router-dom'
import { userOf } from '../data/mock'
import type { GuestbookEntry } from '../data/types'
import { timeAgo } from '../lib/format'
import Avatar from './Avatar'
import styles from './GuestbookItem.module.css'

/** Figma: Guestbook Item (292×80). variant="full" 은 전체보기 모달 줄 (757×68, 삭제 | 신고) */
export default function GuestbookItem({ entry, variant = 'compact', onDelete }: { entry: GuestbookEntry; variant?: 'compact' | 'full'; onDelete?: (id: string) => void }) {
  const author = userOf(entry.authorId)
  return (
    <li className={`${styles.item} ${styles[variant]}`}>
      {/* TODO(열린 질문): 프로필 사진을 누르면 그 사람 땅굴로 가는지 확인 필요. 우선 이동하게 둠 */}
      <Link to={`/burrow/${author.id}`} className={styles.avatar} aria-label={`${author.nickname}의 땅굴`}>
        <Avatar size={40} />
      </Link>
      <div className={styles.body}>
        <p className={styles.meta}><strong>{author.nickname}</strong><span>{timeAgo(entry.createdAt)}</span></p>
        <p className={styles.text}>{entry.text}</p>
      </div>
      {variant === 'full' && (
        <div className={styles.actions}>
          <button onClick={() => onDelete?.(entry.id)}>삭제</button>
          <span aria-hidden>|</span>
          <button>신고</button>
        </div>
      )}
    </li>
  )
}
