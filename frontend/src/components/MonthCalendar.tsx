import styles from './MonthCalendar.module.css'

interface Props {
  year: number
  month: number // 1–12
  selected?: number
  onSelect?: (day: number) => void
  /** 날짜별 표시 (예: { 6: '보드게임' }) */
  marks?: Record<number, string>
  /** 고를 수 없는 날 (지난 날 등) */
  minDay?: number
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 모임 캘린더 / 모임 만들기의 달력 */
export default function MonthCalendar({ year, month, selected, onSelect, marks = {}, minDay = 1 }: Props) {
  const first = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  return (
    <div className={styles.cal}>
      {WEEK.map((w, i) => <span key={w} className={`${styles.week} ${i === 0 ? styles.sun : ''}`}>{w}</span>)}
      {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
        <button
          key={d}
          type="button"
          className={`${styles.day} ${d === selected ? styles.on : ''} ${marks[d] ? styles.marked : ''} ${i % 7 === 0 ? styles.sun : ''}`}
          disabled={d < minDay || !onSelect}
          onClick={() => onSelect?.(d)}
          aria-pressed={d === selected}
        >
          <span>{d}</span>
          {marks[d] && <em>{marks[d]}</em>}
        </button>
      ))}
    </div>
  )
}
