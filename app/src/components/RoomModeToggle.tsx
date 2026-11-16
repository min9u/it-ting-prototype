import { NavLink } from 'react-router-dom'
import { CompassIcon, HomeIcon } from './Icons'
import styles from './RoomModeToggle.module.css'

/** Figma: Room Mode Toggle (Mode=내 땅굴 / 탐색) · Scene / C / 통합 이동 버튼 (170×42) */
/** exploreTo: "탐색"을 눌렀을 때 갈 들판 (방문자 뷰는 그 땅굴이 있는 들판, 없으면 내 들판) */
export default function RoomModeToggle({ style, exploreTo = '/burrow/explore' }: { style?: React.CSSProperties; exploreTo?: string }) {
  return (
    <nav className={styles.toggle} style={style} aria-label="땅굴 보기 방식">
      <NavLink to="/burrow" end className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <HomeIcon size={15} /> 내 땅굴
      </NavLink>
      <NavLink to={exploreTo} className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <CompassIcon size={15} /> 탐색
      </NavLink>
    </nav>
  )
}
