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
  /** 연출 없이 다 차려진 방으로 시작 (천장 구멍·두더지·가구 낙하 없음) */
  still?: boolean
  /**
   * 3D 가 다 차려질 때까지 자리표시 그림 대신 로딩 애니메이션을 보여 주고, 다 되면 3D 를 한 번에 페이드 인
   * (시작 화면, 2026-11-12 사용자 제보: 그림 → 사라짐 → 가구가 하나씩 뜸 → 번잡함)
   */
  loader?: boolean
  /** 3D 가 다 차려짐 (loader 와 같이 씀) */
  onLoaded?: () => void
}

/**
 * 3D 땅굴 (src/three/roomScene.ts).
 * 3D가 준비될 때까지(또는 WebGL을 못 쓰면) 디자이너 확인 렌더(핸드오프 v2 room_glb_check.png, 같은 카메라) 자리표시를 같은 자리에 보여 준다.
 * 구도는 roomScene 과 같음: 4:3 그림 높이 = 장면 높이의 114.5%, 위로 5.4%, 가로 가운데 = focusX.
 */
/**
 * 로딩 그림: 흙더미에서 고개를 내민 두더지 (벡터로 그림. 예전 mole-mound.png 는 흰 배경에서 잘라 낸 작은 그림이라
 * 어두운 배경에서 가장자리에 흰 테두리가 보였음, 2026-11-12 사용자 제보). 머리만 통통 움직임 (.loaderHead)
 */
function LoaderMole() {
  return (
    <svg viewBox="0 0 120 96" width="132" height="106" aria-hidden>
      <g className={styles.loaderHead}>
        <path d="M34 66 C34 30 44 14 60 14 C76 14 86 30 86 66 Z" fill="#7d5644" />
        <path d="M42 34 C45 24 51 19 57 18" stroke="#a07a64" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
        <path d="M57 14 L55 8 M60 13 L60 6 M63 14 L66 8" stroke="#4e3428" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="44" cy="44" rx="5" ry="3" fill="#e9967a" opacity=".55" />
        <ellipse cx="76" cy="44" rx="5" ry="3" fill="#e9967a" opacity=".55" />
        <circle cx="50" cy="36" r="3.4" fill="#2a1a12" />
        <circle cx="70" cy="36" r="3.4" fill="#2a1a12" />
        <circle cx="51.2" cy="34.8" r="1.1" fill="#fff" />
        <circle cx="71.2" cy="34.8" r="1.1" fill="#fff" />
        <ellipse cx="60" cy="44" rx="4.6" ry="3.4" fill="#f08f86" />
      </g>
      <path d="M6 94 C8 70 30 58 60 58 C90 58 112 70 114 94 Z" fill="#c8643a" />
      <path d="M6 94 C8 84 20 78 30 80 C44 83 52 90 60 94 Z" fill="#b5552f" opacity=".55" />
      <path d="M78 66 C92 68 104 76 110 88" stroke="#e08a5e" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".6" />
      <circle cx="40" cy="78" r="2.4" fill="#9c4526" />
      <circle cx="84" cy="82" r="2" fill="#9c4526" />
      <circle cx="66" cy="86" r="1.6" fill="#9c4526" />
      <g className={styles.loaderHead}>
        <ellipse cx="46" cy="60" rx="7.5" ry="5" fill="#f2c0a6" />
        <ellipse cx="74" cy="60" rx="7.5" ry="5" fill="#f2c0a6" />
        <path d="M42 58 v4 M46 57.5 v4.5 M50 58 v4 M70 58 v4 M74 57.5 v4.5 M78 58 v4" stroke="#d99a80" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export default function RoomView({ ownerId, focusX = 0.5, interests, wallpaper, hostName, hostWorn, worn, children, label, still, loader, onLoaded }: Props) {
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // loader: 3D 를 못 만드는 환경(WebGL 없음)이면 8초 뒤 자리표시 그림으로
  const [gaveUp, setGaveUp] = useState(false)
  const handle = useRef<SceneHandle | null>(null)
  const wornKey = (worn ?? []).join(',')
  useEffect(() => { handle.current?.setWorn?.(worn ?? []) }, [wornKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loader || ready) return
    const id = setTimeout(() => setGaveUp(true), 8000)
    return () => clearTimeout(id)
  }, [loader, ready])
  const latestLoaded = useRef(onLoaded)
  latestLoaded.current = onLoaded
  const shown = loader ? loaded : ready
  return (
    <div className={styles.scene} data-owner={ownerId}>
      {loader && !loaded && !gaveUp && (
        <div className={styles.loader} style={{ left: `${focusX * 100}%` }} role="status">
          <span className={styles.loaderArt} aria-hidden>
            <LoaderMole />
            <i /><i /><i />
          </span>
          <span className={styles.loaderText}>땅굴 파는 중<span aria-hidden className={styles.loaderDots}><b>.</b><b>.</b><b>.</b></span></span>
        </div>
      )}
      {(loader ? gaveUp && !ready : !ready) && (
        <div className={styles.stage} style={{ left: `${focusX * 100}%` }}>
          <img src={roomCutout} alt={label ?? '땅굴 방 모습'} className={styles.room} draggable={false} />
        </div>
      )}
      <Suspense fallback={null}>
        <RoomCanvas
          ownerId={ownerId}
          interests={interests}
          wallpaper={wallpaper}
          still={still}
          hostName={hostName}
          hostWorn={hostWorn}
          worn={worn}
          focusX={focusX}
          className={loader ? `${styles.canvas} ${loaded ? styles.canvasIn : styles.canvasHidden}` : styles.canvas}
          label={label ?? '땅굴 방 모습'}
          onReady={(h) => {
            handle.current = h; setReady(true)
            ;(h.loaded ?? Promise.resolve()).then(() => { if (handle.current !== h) return; setLoaded(true); latestLoaded.current?.() })
          }}
        />
      </Suspense>
      {shown && (
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
