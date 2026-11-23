import { toneOf } from '../data/mock'
import type { Tone } from '../data/types'
import styles from './InterestChip.module.css'

/** Figma: Interest Chip (Tone=Sage/Clay/Butter/Sky/Lilac/Rose/Mint/Sand) */
export default function InterestChip({ label, tone, size = 'md', shared, check }: {
  label: string
  tone?: Tone
  size?: 'md' | 'lg'
  /** 나와 같은 관심사: 칩 색 테두리 */
  shared?: boolean
  /** shared 일 때 앞에 ✓ 를 붙임 (00 공통 5: 겹치는 관심사는 체크와 강조 색). 스크린 리더에는 "나와 같은 관심사" 로 읽힘 */
  check?: boolean
}) {
  const tick = !!shared && !!check
  const t = tone ?? toneOf(label)
  return (
    <span className={`${styles.chip} ${styles[size]} ${shared ? styles.shared : ''}`}
      style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>
      {tick && <span aria-hidden className={styles.check}>✓</span>}
      {label}
      {tick && <span className="sr-only"> (나와 같은 관심사)</span>}
    </span>
  )
}

export function ChipList({ items, sharedWith }: { items: string[]; sharedWith?: string[] }) {
  return (
    <div className={styles.list}>
      {items.map((i) => <InterestChip key={i} label={i} shared={sharedWith?.includes(i)} />)}
    </div>
  )
}
