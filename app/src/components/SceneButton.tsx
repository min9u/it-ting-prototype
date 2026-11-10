import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './SceneButton.module.css'

/** Figma: Scene / C / 방노트, Scene / C / 방문자 — 3D 장면 위에 뜨는 버튼 */
export default function SceneButton({ tone = 'cream', children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cream' | 'mint' | 'paper'; children: ReactNode }) {
  return (
    <button className={`${styles.btn} ${styles[tone]} ${className ?? ''}`} {...rest}>
      {children}
    </button>
  )
}

export function VisitorBadge({ count }: { count: number }) {
  return (
    <>
      <span className={styles.dot} aria-hidden />
      방문자
      <span className={styles.badge}>{count}명</span>
    </>
  )
}
