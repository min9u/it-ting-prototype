import { NavLink, useLocation } from '@/lib/nav'
import { CompassIcon, HomeIcon } from './Icons'
import styles from './RoomModeToggle.module.css'

/**
 * Figma: Room Mode Toggle (Mode=내 땅굴 / 탐색) · Scene / C / 통합 이동 버튼 (170×42)
 * - exploreTo: "탐색"을 눌렀을 때 갈 들판 주소 (방문자 뷰는 그 땅굴이 있는 들판·자리, 기본은 내 들판 — 00 공통 13)
 * - 탐색으로 갈 때 지금 주소를 state.from 으로 넘김
 * - onPick: 누른 직후 불림. preventDefault 하면 이동을 미룸
 * - homeLabel · homeTo: 방문자 뷰는 "○○님 땅굴" · 그 땅굴 주소 (지금 보는 곳이라 켜진 칸. Figma 1246:13381). 기본은 "내 땅굴" · /burrow
 */
export default function RoomModeToggle({ style, onPick, exploreTo = '/burrow/explore', homeLabel = '내 땅굴', homeTo = '/burrow' }: {
  style?: React.CSSProperties
  onPick?: (to: '/burrow' | '/burrow/explore', e: React.MouseEvent) => void
  exploreTo?: string
  homeLabel?: string
  homeTo?: string
}) {
  const { pathname } = useLocation()
  return (
    <nav className={styles.toggle} style={style} aria-label="땅굴 보기 방식">
      <NavLink to={homeTo} end onClick={(e) => onPick?.('/burrow', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <HomeIcon size={15} /> {homeLabel}
      </NavLink>
      <NavLink to={exploreTo} state={{ from: pathname }} onClick={(e) => onPick?.('/burrow/explore', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <CompassIcon size={15} /> 탐색
      </NavLink>
    </nav>
  )
}
