import type { ReactNode } from 'react'
import roomCutout from '../assets/room-cutout.png'
import styles from './RoomView.module.css'

interface Props {
  /** 누구의 땅굴인지. 3D 씬으로 바꿀 때 방 데이터를 불러오는 키 */
  ownerId: string
  /** 방 가운데가 놓일 가로 위치 (0–1). 오른쪽 패널이 열려 있으면 왼쪽으로 치우친다 */
  focusX?: number
  /** 방 위에 올리는 UI (버튼, 말풍선 등) */
  children?: ReactNode
  label?: string
}

/**
 * 3D 땅굴 자리.
 * 지금은 design/figma/room-cutout.png (배경을 투명하게 따냄)를 보여 주는 자리표시.
 * 나중에 three.js 씬(explore/3d/ 시험판)으로 이 컴포넌트 안쪽만 바꾸면 된다.
 * 크기 기준: 스크린샷에서 방 지붕 꼭대기가 헤더 아래 21px, 방 높이가 장면 높이의 약 103%.
 */
export default function RoomView({ ownerId, focusX = 0.5, children, label }: Props) {
  return (
    <div className={styles.scene} data-owner={ownerId}>
      <div className={styles.stage} style={{ left: `${focusX * 100}%` }}>
        <img src={roomCutout} alt={label ?? '땅굴 방 모습'} className={styles.room} draggable={false} />
      </div>
      {children}
    </div>
  )
}
