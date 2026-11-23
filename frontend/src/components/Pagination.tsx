import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from './Icons'
import styles from './Pagination.module.css'

/**
 * Figma: 페이징 넘버 (506:12603)
 * - 페이지 번호는 한 번에 5개까지 (1–5, 6–10 …)
 * - 이전/다음은 한 칸씩 이동
 * - 6페이지 이상이면 맨 처음/맨 끝으로 가는 버튼이 생긴다
 */
export default function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null
  const blockStart = Math.floor((page - 1) / 5) * 5 + 1
  const pages = Array.from({ length: Math.min(5, total - blockStart + 1) }, (_, i) => blockStart + i)
  const long = total >= 6
  return (
    <nav className={styles.pager} aria-label="페이지">
      {long && (
        <button className={styles.arrow} disabled={page === 1} onClick={() => onChange(1)} aria-label="맨 처음 페이지"><ChevronsLeft size={16} /></button>
      )}
      <button className={styles.arrow} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지"><ChevronLeft size={16} /></button>
      {pages.map((p) => (
        <button key={p} className={p === page ? `${styles.num} ${styles.on}` : styles.num} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>
          {p}
        </button>
      ))}
      <button className={styles.arrow} disabled={page === total} onClick={() => onChange(page + 1)} aria-label="다음 페이지"><ChevronRight size={16} /></button>
      {long && (
        <button className={styles.arrow} disabled={page === total} onClick={() => onChange(total)} aria-label="맨 끝 페이지"><ChevronsRight size={16} /></button>
      )}
    </nav>
  )
}
