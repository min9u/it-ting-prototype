import { lazy, Suspense, useState, type ReactNode } from 'react'
import roomCutout from '../assets/room-cutout.png'
import styles from './RoomView.module.css'

// three.js 는 무거워서 땅굴 화면에 들어올 때만 따로 불러온다 (별도 청크)
const RoomCanvas = lazy(() => import('../three/RoomCanvas'))

interface Props {
  /** 누구의 땅굴인지. 방 데이터를 불러오는 키 */
  ownerId: string
  /** 방 가운데가 놓일 가로 위치 (0–1). 오른쪽 패널이 열려 있으면 왼쪽으로 치우친다 */
  focusX?: number
  /** 관심사 (가구 배치에 씀) */
  interests?: string[]
  /** 방 위에 올리는 UI (버튼, 말풍선 등) */
  children?: ReactNode
  label?: string
}

/**
 * 3D 땅굴 (src/three/roomScene.ts).
 * 3D가 준비될 때까지는 design/figma/room-cutout.png 자리표시를 같은 자리에 보여 준다.
 * 크기 기준: 방 지붕 꼭대기가 헤더 아래 21px, 방 높이가 장면 높이의 약 103%.
 */
export default function RoomView({ ownerId, focusX = 0.5, interests, children, label }: Props) {
  const [ready, setReady] = useState(false)
  return (
    <div className={styles.scene} data-owner={ownerId}>
      {!ready && (
        <div className={styles.stage} style={{ left: `${focusX * 100}%` }}>
          <img src={roomCutout} alt={label ?? '땅굴 방 모습'} className={styles.room} draggable={false} />
        </div>
      )}
      <Suspense fallback={null}>
        <RoomCanvas
          ownerId={ownerId}
          interests={interests}
          focusX={focusX}
          className={styles.canvas}
          label={label ?? '땅굴 방 모습'}
          onReady={() => setReady(true)}
        />
      </Suspense>
      {children}
    </div>
  )
}
