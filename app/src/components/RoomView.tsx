import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { SceneHandle } from '../three/engine'
import roomCutout from '../assets/room-v2.webp'
import styles from './RoomView.module.css'

// three.js 는 무거워서 땅굴 화면에 들어올 때만 따로 불러온다 (별도 청크)
const RoomCanvas = lazy(() => import('../three/RoomCanvas'))

// 리액션 버튼 (three.js 청크와 따로 두려고 여기 적음. 종류는 src/three/moleActor.ts REACTIONS 와 같게)
const REACTIONS = [
  { kind: 'greet', label: '인사', emoji: '👋' },
  { kind: 'look', label: '두리번', emoji: '👀' },
  { kind: 'scratch', label: '헛발질', emoji: '🐾' },
  { kind: 'drink', label: '커피', emoji: '☕' },
] as const

interface Props {
  /** 누구의 땅굴인지. 방 데이터를 불러오는 키 */
  ownerId: string
  /** 방 가운데가 놓일 가로 위치 (0–1). 오른쪽 패널이 열려 있으면 왼쪽으로 치우친다 */
  focusX?: number
  /** 관심사 (가구 배치에 씀) */
  interests?: string[]
  /** 벽지 id (data/wallpapers.ts, 프로필 wallpaper_id). 없으면 관심사로 정함 */
  wallpaper?: string
  /** 남의 땅굴이면 집주인 닉네임. 집주인 두더지가 방에 서 있고, 인사하면 마주 보고 인사함 */
  hostName?: string
  /** 집주인 두더지 액세서리 */
  hostWorn?: string[]
  /** 내 두더지 액세서리 (바뀌면 장면을 다시 만들지 않고 갈아 끼움) */
  worn?: string[]
  /** 방 위에 올리는 UI (버튼, 말풍선 등) */
  children?: ReactNode
  label?: string
}

/**
 * 3D 땅굴 (src/three/roomScene.ts).
 * 3D가 준비될 때까지(또는 WebGL을 못 쓰면) 디자이너 확인 렌더(핸드오프 v2 room_glb_check.png, 같은 카메라) 자리표시를 같은 자리에 보여 준다.
 * 구도는 roomScene 과 같음: 4:3 그림 높이 = 장면 높이의 114.5%, 위로 5.4%, 가로 가운데 = focusX.
 */
export default function RoomView({ ownerId, focusX = 0.5, interests, wallpaper, hostName, hostWorn, worn, children, label }: Props) {
  const [ready, setReady] = useState(false)
  const handle = useRef<SceneHandle | null>(null)
  const wornKey = (worn ?? []).join(',')
  useEffect(() => { handle.current?.setWorn?.(worn ?? []) }, [wornKey]) // eslint-disable-line react-hooks/exhaustive-deps
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
          wallpaper={wallpaper}
          hostName={hostName}
          hostWorn={hostWorn}
          worn={worn}
          focusX={focusX}
          className={styles.canvas}
          label={label ?? '땅굴 방 모습'}
          onReady={(h) => { handle.current = h; setReady(true) }}
        />
      </Suspense>
      {ready && (
        <div className={styles.reactions} role="toolbar" aria-label="두더지 리액션">
          {REACTIONS.map((r) => (
            <button key={r.kind} className={styles.reaction} onClick={() => handle.current?.react?.(r.kind)} title={r.label}>
              <span aria-hidden>{r.emoji}</span>{r.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
