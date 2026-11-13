import { NavLink, useLocation } from 'react-router-dom'
import { CompassIcon, HomeIcon } from './Icons'
import styles from './RoomModeToggle.module.css'

/**
 * Figma: Room Mode Toggle (Mode=내 땅굴 / 탐색) · Scene / C / 통합 이동 버튼 (170×42)
 * - 탐색으로 갈 때 지금 주소를 state.from 으로 넘김 → 탐색하기가 그 땅굴(친구 굴이면 친구 굴)에서 두더지가 나오며 시작 (docs/field-move.md)
 * - onPick: 누른 직후 불림. preventDefault 하면 이동을 미룸 (탐색하기: 두더지가 굴에 들어간 뒤 내 땅굴로)
 */
export default function RoomModeToggle({ style, onPick }: {
  style?: React.CSSProperties
  onPick?: (to: '/burrow' | '/burrow/explore', e: React.MouseEvent) => void
}) {
  const { pathname } = useLocation()
  return (
    <nav className={styles.toggle} style={style} aria-label="땅굴 보기 방식">
      <NavLink to="/burrow" end onClick={(e) => onPick?.('/burrow', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <HomeIcon size={15} /> 내 땅굴
      </NavLink>
      <NavLink to="/burrow/explore" state={{ from: pathname }} onClick={(e) => onPick?.('/burrow/explore', e)} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <CompassIcon size={15} /> 탐색
      </NavLink>
    </nav>
  )
}
