import { NavLink } from 'react-router-dom'
import { CompassIcon, HomeIcon } from './Icons'
import styles from './RoomModeToggle.module.css'

/** Figma: Room Mode Toggle (Mode=내 땅굴 / 탐색) · Scene / C / 통합 이동 버튼 (170×42) */
export default function RoomModeToggle({ style }: { style?: React.CSSProperties }) {
  return (
    <nav className={styles.toggle} style={style} aria-label="땅굴 보기 방식">
      <NavLink to="/burrow" end className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <HomeIcon size={15} /> 내 땅굴
      </NavLink>
      <NavLink to="/burrow/explore" className={({ isActive }) => (isActive ? `${styles.seg} ${styles.on}` : styles.seg)}>
        <CompassIcon size={15} /> 탐색
      </NavLink>
    </nav>
  )
}
