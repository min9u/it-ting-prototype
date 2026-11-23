import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { RoomSceneHandle } from '../three/roomScene'
import type { HostScreen } from '../three/engine'
import { ROOM_FRAME } from '../three/roomFrame'
import { stillFor } from '../three/stills'
import type { FurnChoice } from '../data/myBurrow'
import type { RoomStyle } from '../data/roomStyle'
import { lookDiverse, subscribeLook } from '../lib/roomLookLab'
import styles from './RoomView.module.css'
import MoundMole from './MoundMole'
import SceneBoundary from './SceneBoundary'
import { useReducedMotion } from '../lib/useReducedMotion'

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
   * (시작 화면, 2026-11-12 사용자 제보: 그림 → 사라짐 → 가구가 하나씩 뜸 → 번잡함). 같은 날 모든 땅굴 화면 기본값으로 (자리표시 그림이 조잡해 보임).
   * false 면 예전처럼 자리표시 그림 → 3D
   */
  loader?: boolean
  /** 3D 가 다 차려짐 (loader 와 같이 씀) */
  onLoaded?: () => void
  /** 방명록 우체통: 새 방명록이 있음 (깃발 올림·편지·발광). 바뀌면 장면을 다시 만들지 않고 바꿈 */
  mailbox?: boolean
  /** 우체통을 누름 → 방명록 전체 보기 */
  onMailbox?: () => void
  /**
   * 집주인 두더지 머리 바로 위에 띄울 UI (남의 땅굴의 '대화 요청하기' 말풍선). 아래 가운데가 머리 꼭대기에 오게 둠.
   * 3D 장면이 알려 주는 위치(SceneHandle.onHostScreen)를 ref 로 직접 옮겨서 매 프레임 React 렌더가 없음.
   * 집주인이 안 보이거나 입장 연출·리액션 말풍선 중이면 숨김. 3D 를 못 쓰면 예전처럼 방 가운데쯤 고정
   */
  hostBubble?: ReactNode
  /**
   * 세부 관심사마다 고른 가구 단어 (세부 관심사 id → 단어). 앱 화면은 늘 빈 값 = 맨 앞 단어(명세: 가구는 고르지 않음).
   * 실험실(/lab/rooms)이 단어를 바꿔 볼 때만 씀. 바뀌면 장면을 다시 만들지 않고 그 자리만 갈아 끼움
   */
  furniture?: FurnChoice
  /** 안 보이는 동안 그리기 멈춤 (랜딩에서 투명하게 숨긴 층, docs/rendering-experiments-2.md) */
  paused?: boolean
  /**
   * 3D 가 준비되는 동안 로딩 애니메이션 대신 빌드에 넣은 정지 그림(three/stills.ts 'room')을 보여 줌. 그 그림과 같은 방일 때만
   * (랜딩: 같은 관심사 6개·연출 없음). 다른 방이면 가구가 바뀌어 보여서 쓰지 않음 (docs/rendering-experiments-3.md 5번)
   */
  loadingStill?: boolean
  /** 관심사 이펙트를 켬 (내 땅굴·남의 땅굴만. 시작 화면·온보딩 미리 보기는 안 씀). viewer = 남의 땅굴에서 내 관심사 (docs/interest-effects.md) */
  fx?: { viewer?: string[]; talk?: 'open' | 'slow' | null }
  /**
   * 꾸미기 값 (data/roomLook.ts roomLookOf 의 style: 색 테마 · 껍데기 색 · 무늬 · 모양). 없으면 디자이너 원래 모습.
   * 🎨 땅굴 색 다양하게를 끄면(lib/roomLookLab.ts) 넘겨도 원래 모습. 바뀌면 장면을 다시 만들지 않고 갈아 입힘
   */
  style?: RoomStyle | null
}

/**
 * 3D 땅굴 (src/three/roomScene.ts).
 * 3D가 준비될 때까지(또는 WebGL을 못 쓰면) 같은 구도의 고해상도 정지 그림(three/stills.ts, GPU 로 미리 찍은 방, 2026-11-16 3차.
 * 예전엔 디자이너 확인 렌더 1200px)을 같은 자리에 보여 준다. 이 브라우저에서 예전에 구운 같은 방 그림이 있으면(저사양, IndexedDB) 그걸 먼저.
 * 구도는 roomScene 과 같음 (three/roomFrame.ts ROOM_FRAME): 4:3 그림, 가로 가운데 = focusX.
 */
/**
 * 로딩 그림: 흙더미에서 고개를 내민 두더지 (벡터로 그림. 예전 mole-mound.png 는 흰 배경에서 잘라 낸 작은 그림이라
 * 어두운 배경에서 가장자리에 흰 테두리가 보였음, 2026-11-12 사용자 제보). 머리만 통통 움직임 (.loaderHead)
 */
function LoaderMole() {
  return <MoundMole width={132} height={106} headClass={styles.loaderHead} />
}

export default function RoomView({ ownerId, focusX = 0.5, interests, wallpaper, hostName, hostWorn, worn, children, label, still, loader = true, onLoaded, mailbox = false, onMailbox, hostBubble, furniture, paused, loadingStill = false, fx, style: styleIn }: Props) {
  const diverse = useSyncExternalStore(subscribeLook, lookDiverse)
  const style = diverse ? styleIn ?? null : null
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // 3D 장면이 예전에 구운 같은 구도의 그림을 이미 깔았음 (SceneHandle.still) → 로딩 애니메이션 없이 장면을 바로 보임
  const [stillUp, setStillUp] = useState(false)
  // 3D 를 못 쓰거나(WebGL 없음·SceneBoundary 가 잡은 실패) 8초 넘게 안 뜨면 보일 고해상도 정지 그림 (three/stills.ts)
  const fallbackStill = stillFor('room', { host: !!hostName })
  // 움직임 줄이기 설정이면 입장 연출(천장 구멍 · 낙하 · 가구 떨어짐) 없이 다 차려진 방으로
  const calm = useReducedMotion()
  // loader: 3D 를 못 만드는 환경(WebGL 없음)이면 8초 뒤 자리표시 그림으로
  const [gaveUp, setGaveUp] = useState(false)
  const handle = useRef<RoomSceneHandle | null>(null)
  const wornKey = (worn ?? []).join(',')
  useEffect(() => { handle.current?.setWorn?.(worn ?? []) }, [wornKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // 우체통: 처음 값은 장면을 만들 때 넘기고(mailboxRef), 그 뒤 바뀌면 setMailbox. 누르기 콜백은 최신 것을 부름
  const mailboxRef = useRef(mailbox)
  mailboxRef.current = mailbox
  useEffect(() => { handle.current?.setMailbox?.(mailbox) }, [mailbox])
  // 고른 가구 단어: 처음 값은 장면을 만들 때, 그 뒤는 handle 로
  const furnRef = useRef(furniture)
  furnRef.current = furniture
  const furnKey = Object.entries(furniture ?? {}).sort().join(',')
  useEffect(() => { if (furnRef.current) (handle.current as RoomSceneHandle | null)?.setFurniture?.(furnRef.current) }, [furnKey])
  // 꾸미기 값: 처음 값은 장면을 만들 때(getStyle), 그 뒤 바뀌면(🎨 스위치 · 꾸미기 테마) setStyle. styleMounted = 지금 장면에 입힌 값
  const styleRef = useRef(style)
  styleRef.current = style
  const styleKey = JSON.stringify(style ?? null)
  const styleMounted = useRef<string | null>(null)
  const getStyle = () => { styleMounted.current = JSON.stringify(styleRef.current ?? null); return styleRef.current ?? null }
  const syncStyle = (h: RoomSceneHandle | null) => {
    const k = JSON.stringify(styleRef.current ?? null)
    if (!h || styleMounted.current === k) return
    styleMounted.current = k
    h.setStyle?.(styleRef.current ?? null)
  }
  useEffect(() => { syncStyle(handle.current) }, [styleKey])
  const onMailboxRef = useRef(onMailbox)
  onMailboxRef.current = onMailbox
  useEffect(() => {
    if (!loader || ready) return
    const id = setTimeout(() => setGaveUp(true), 8000)
    return () => clearTimeout(id)
  }, [loader, ready])
  const latestLoaded = useRef(onLoaded)
  latestLoaded.current = onLoaded
  const shown = loader ? loaded : ready
  const canvasOn = loaded || stillUp
  // 집주인 머리 위 자리: 마지막 위치를 기억해 두고, 3D 가 보일 때만 켬
  const anchor = useRef<HTMLDivElement>(null)
  const hostAt = useRef<HostScreen | null>(null)
  const shownRef = useRef(shown)
  shownRef.current = shown
  const placeHost = () => {
    const a = anchor.current
    if (!a) return
    const p = hostAt.current
    // 위로는 말풍선 키(약 56px)만큼 남겨서, 확대해 머리가 화면 위로 나가도 말풍선은 화면 안에
    if (p) a.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(Math.max(p.y, 60))}px, 0)`
    const on = !!p && shownRef.current
    if (on) a.dataset.on = ''; else delete a.dataset.on
  }
  useEffect(placeHost, [shown])
  // loadingStill 이면 그림을 3D 아래에 계속 둠 (3D 가 0.6초에 걸쳐 나타나는 동안 비지 않게. 방 바깥은 둘 다 투명)
  const placeholder = loader ? (gaveUp && !ready) || loadingStill : !ready
  return (
    <div className={styles.scene} data-owner={ownerId}>
      {loader && !canvasOn && !gaveUp && !loadingStill && (
        <div className={styles.loader} style={{ left: `${focusX * 100}%` }} role="status">
          <span className={styles.loaderArt} aria-hidden>
            <LoaderMole />
            <i /><i /><i />
          </span>
          <span className={styles.loaderText}>땅굴 파는 중<span aria-hidden className={styles.loaderDots}><b>.</b><b>.</b><b>.</b></span></span>
        </div>
      )}
      {placeholder && (
        <div className={styles.stage} style={{ left: `${focusX * 100}%`, top: `${ROOM_FRAME.top * 100}%`, height: `${ROOM_FRAME.h * 100}%` }}>
          <img src={fallbackStill.src} alt={label ?? fallbackStill.alt} className={styles.room} draggable={false} />
        </div>
      )}
      {/* 3D 청크를 못 받거나 WebGL 이 없으면 로딩을 거두고 바로 자리표시 그림으로 (SceneBoundary) */}
      <SceneBoundary onError={() => setGaveUp(true)}>
      <Suspense fallback={null}>
        <RoomCanvas
          ownerId={ownerId}
          interests={interests}
          wallpaper={wallpaper}
          still={still || calm}
          hostName={hostName}
          hostWorn={hostWorn}
          worn={worn}
          mailbox={mailboxRef.current}
          furniture={furnRef.current}
          getStyle={getStyle}
          fx={fx}
          onMailbox={() => onMailboxRef.current?.()}
          focusX={focusX}
          className={loader ? `${styles.canvas} ${canvasOn ? styles.canvasIn : styles.canvasHidden}` : styles.canvas}
          label={label ?? '땅굴 방 모습'}
          paused={paused}
          overlay={hostBubble != null && (
            <div ref={anchor} className={styles.hostAnchor}>{hostBubble}</div>
          )}
          onReady={(h) => {
            handle.current = h; setReady(true)
            syncStyle(h as RoomSceneHandle)
            ;(h as RoomSceneHandle).setMailbox?.(mailboxRef.current)
            if (furnRef.current) (h as RoomSceneHandle).setFurniture?.(furnRef.current)
            hostAt.current = null; placeHost()
            h.still?.then((ok) => { if (ok && handle.current === h) setStillUp(true) })
            h.onHostScreen?.((p) => { if (handle.current !== h) return; hostAt.current = p; placeHost() })
            ;(h.loaded ?? Promise.resolve()).then(() => { if (handle.current !== h) return; setLoaded(true); latestLoaded.current?.() })
          }}
        />
      </Suspense>
      </SceneBoundary>
      {shown && (
        <div className={styles.reactions} role="toolbar" aria-label="두더지 리액션">
          {REACTIONS.map((r) => (
            <button key={r.kind} className={styles.reaction} onClick={() => handle.current?.react?.(r.kind)} title={r.label}>
              <span aria-hidden>{r.emoji}</span>{r.label}
            </button>
          ))}
        </div>
      )}
      {placeholder && hostBubble != null && (
        <div className={styles.hostStatic} style={{ left: `${(focusX - 0.01) * 100}%` }}>{hostBubble}</div>
      )}
      {children}
    </div>
  )
}
