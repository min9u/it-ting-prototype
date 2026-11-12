import { useState } from 'react'
import { Link } from 'react-router-dom'
import { userOf } from '../data/mock'
import type { GuestbookEntry } from '../data/types'
import { timeAgo } from '../lib/format'
import Avatar from './Avatar'
import { ChipList } from './InterestChip'
import Modal from './Modal'
import styles from './GuestbookItem.module.css'

/**
 * Figma: Guestbook Item (292×80). variant="full" 은 전체보기 모달 줄 (757×68, 삭제 | 신고)
 * 프로필 사진을 누르면 바로 이동하지 않고 작은 프로필 카드가 뜨고, 그 안 "땅굴 놀러가기"로 이동
 * (2026-11-12 Figma 메모 454:7052 답: "바로 이동보다는 프로필 뜨고 그 안에 '땅굴 놀러가기' 버튼")
 */
export default function GuestbookItem({ entry, variant = 'compact', onDelete }: { entry: GuestbookEntry; variant?: 'compact' | 'full'; onDelete?: (id: string) => void }) {
  const author = userOf(entry.authorId)
  const [open, setOpen] = useState(false)
  return (
    <li className={`${styles.item} ${styles[variant]}`}>
      <button className={styles.avatar} onClick={() => setOpen(true)} aria-label={`${author.nickname} 프로필 보기`}>
        <Avatar size={40} />
      </button>
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
      <Modal open={open} onClose={() => setOpen(false)} width={340} labelledBy={`gb-prof-${entry.id}`}>
        <div className={styles.profile}>
          <Avatar size={72} />
          <h2 id={`gb-prof-${entry.id}`} className="display">{author.nickname}</h2>
          <p>{author.affiliation}</p>
          {author.interests.length > 0 && <ChipList items={author.interests.slice(0, 6)} />}
          <Link to={`/burrow/${author.id}`} className="btn btn-primary btn-block" onClick={() => setOpen(false)}>땅굴 놀러가기</Link>
        </div>
      </Modal>
    </li>
  )
}
