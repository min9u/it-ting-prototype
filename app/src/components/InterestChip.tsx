import { toneOf } from '../data/mock'
import type { Tone } from '../data/types'
import styles from './InterestChip.module.css'

/** Figma: Interest Chip (Tone=Sage/Clay/Butter/Sky/Lilac/Rose/Mint/Sand) */
export default function InterestChip({ label, tone, size = 'md', shared }: { label: string; tone?: Tone; size?: 'md' | 'lg'; shared?: boolean }) {
  const t = tone ?? toneOf(label)
  return (
    <span className={`${styles.chip} ${styles[size]} ${shared ? styles.shared : ''}`}
      style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>
      {label}
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
