import { NavLink, useLocation } from 'react-router-dom'
import { CompassIcon, HomeIcon } from './Icons'
import styles from './RoomModeToggle.module.css'

/**
 * Figma: Room Mode Toggle (Mode=내 땅굴 / 탐색) · Scene / C / 통합 이동 버튼 (170×42)
 * - exploreTo: "탐색"을 눌렀을 때 갈 들판 주소 (방문자 뷰는 그 땅굴이 있는 들판·자리, 기본은 내 들판 — 00 공통 13)
 * - 탐색으로 갈 때 지금 주소를 state.from 으로 넘김
 * - onPick: 누른 직후 불림. preventDefault 하면 이동을 미룸
 */
export default function RoomModeToggle({ style, onPick, exploreTo = '/burrow/explore' }: {
  style?: React.CSSProperties
  onPick?: (to: '/burrow' | '/burrow/explore', e: React.MouseEvent) => void
  exploreTo?: string
}) {
  const { pathname } = useLocation()
  return (
    <nav className={styles.toggle} style={style} aria-label="땅굴 보기 방식">
      <NavLink to="/burrow" end onClick={(e) => onPick?.('/burrow', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <HomeIcon size={15} /> 내 땅굴
      </NavLink>
      <NavLink to={exploreTo} state={{ from: pathname }} onClick={(e) => onPick?.('/burrow/explore', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <CompassIcon size={15} /> 탐색
      </NavLink>
    </nav>
  )
}
