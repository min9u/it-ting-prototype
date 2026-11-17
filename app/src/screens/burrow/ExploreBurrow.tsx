import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RoomModeToggle from '../../components/RoomModeToggle'
import Avatar from '../../components/Avatar'
import InterestChip from '../../components/InterestChip'
import SceneButton from '../../components/SceneButton'
import { EmptyMole, Toast } from '../../components/Feedback'
import { HomeIcon } from '../../components/Icons'
import { getMyWorn } from '../../data/moleItems'
import { MY_FLOOR, affOf, fieldOf, floorLabel, me, parseFloor, todaysPicks, type Floor } from '../../data/field'
import type { HoleFieldHandle } from '../../three/holeField'
import { FloorPickerModal, RecommendModal, RegularsModal } from './ExploreModals'
import Minimap from './Minimap'
import SceneBoundary from '../../components/SceneBoundary'
import { stillFor, stillStyle } from '../../three/stills'
import { isActivatable, shortcutAllowed } from '../../lib/a11y'
import rv from '../../components/RoomView.module.css'
import s from './Burrow.module.css'
import x from './Explore.module.css'

const HoleFieldCanvas = lazy(() => import('../../three/HoleFieldCanvas'))

/** 땅굴로 들어갈 때 화면이 어두워지는 시간 (ms) */
const ENTER_FADE = 450

/**
 * 땅굴 메인 – 탐색 (Figma 02 F5 787:3619 · 03 Screens 디자인 참고, 3D 핸드오프 v3.9 들판 + v3.8 두더지 잡기 이동). 2026-11-16 새로 만듦
 * - 들판 = 학기 하나의 캠퍼스-층 하나 (00 공통 19). 주소 ?floor=<학기|캠퍼스|층>&seat=<자리> 로 보던 자리를 기억 (뒤로 가기 하면 그대로)
 * - 두더지는 늘 구멍 하나에 서 있음. 방향키 = 그 방향 ±45° 가장 가까운 구멍, 구멍 누르기 = 바로 그 구멍, 이동 중엔 입력 잠금
 * - Enter / 안내판 "땅굴 놀러가기" = 화면이 어두워진 뒤 그 땅굴로 (내 구멍이면 내 땅굴). 땅굴에서 탐색으로 나오면 어두운 화면에서 밝아짐
 * - 왼쪽 위: 단골 땅굴 · 오늘의 추천 친구(오늘 아직 안 받았으면 빨간 점) · 캠퍼스-층. 사다리를 눌러도 캠퍼스-층 고르기
 * - 오른쪽: 서 있는 구멍의 땅굴 주인 정보 (접기). 아래 가운데: 내 땅굴 / 탐색, 왼쪽 아래: 내 땅굴로 돌아가기
 * 데모용 쿼리: ?panel=closed · ?modal=regulars|recommend|floor · ?recommend=reset (오늘 받은 추천 지우기)
 */
export default function ExploreBurrow() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const floor: Floor = parseFloor(params.get('floor') ?? '') ?? MY_FLOOR
  const field = useMemo(() => fieldOf(floor), [floor.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const bySeat = useMemo(() => new Map(field.residents.map((r) => [r.seat, r])), [field])
  const occupied = useMemo(() => field.residents.map((r) => r.seat), [field])
  const others = field.residents.filter((r) => !r.mine).length
  const seatParam = Number(params.get('seat'))
  const startSeat = bySeat.has(seatParam) ? seatParam : field.mySeat ?? field.residents[0]?.seat ?? 0

  const [seat, setSeat] = useState(startSeat)
  const [moving, setMoving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [modal, setModal] = useState<null | 'regulars' | 'recommend' | 'floor'>(() => {
    const m = params.get('modal'); return m === 'regulars' || m === 'recommend' || m === 'floor' ? m : null
  })
  const [hover, setHover] = useState<{ seat: number; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  const handle = useRef<HoleFieldHandle | null>(null)
  // 안내판 위치: 장면이 두더지 머리 화면 좌표를 알려 줌. 안내판이 나중에 붙어도 마지막 값을 씀
  const anchor = useRef({ x: 0, y: 0, vis: false })
  const signEl = useRef<HTMLDivElement | null>(null)
  const placeSign = () => {
    const el = signEl.current, a = anchor.current
    if (!el) return
    el.style.left = `${a.x}px`; el.style.top = `${a.y}px`
    el.dataset.hidden = a.vis ? '0' : '1'
  }
  const worn = useMemo(() => getMyWorn(), [])
  // 오늘의 추천을 받았는지 (팝업을 닫을 때 다시 읽음)
  const [recTick, setRecTick] = useState(0)
  const recDone = useMemo(() => !!todaysPicks(), [recTick])
  const seatInUrl = useRef(params.get('seat'))

  const here = bySeat.get(seat)
  const owner = here?.user
  const mine = me()
  const shared = owner && !here?.mine ? owner.interests.filter((i) => mine.interests.includes(i)) : []
  const focusX = panelOpen ? 0.403 : 0.5
  const fieldStill = stillFor('field')

  // 들판이 바뀌면 처음 자리로
  useEffect(() => { setSeat(startSeat); setReady(false); setHover(null) }, [floor.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const enter = useCallback(() => {
    if (!here || moving || leaving) return
    setLeaving(true)
    window.setTimeout(() => navigate(here.mine ? '/burrow' : `/burrow/${here.user.id}`, { state: { from: 'explore' } }), ENTER_FADE)
  }, [here, moving, leaving, navigate])

  // 방향키 · Enter (팝업이 열려 있거나 글을 쓰는 중이면 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 글 쓰는 중 · 한글 조합 중 · 조합키 · 팝업(aria-modal, 미니맵 크게 보기 포함)이 열려 있으면 쉼 (lib/a11y.ts)
      if (modal || leaving || !shortcutAllowed(e)) return
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' } as const)[e.code as 'ArrowUp']
      if (dir) { e.preventDefault(); handle.current?.move(dir); return }
      // Enter 가 버튼·링크·탭 자체의 동작이면 그쪽에 맡김
      if (e.key === 'Enter' && !isActivatable(e.target)) { e.preventDefault(); enter() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, leaving, enter])

  useEffect(() => {
    if (params.get('recommend') === 'reset') import('../../data/field').then((m) => { m.resetToday(); setRecTick((n) => n + 1) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goFloor = (f: Floor, seatNo?: number) => {
    setModal(null)
    const next = new URLSearchParams(params)
    next.set('floor', f.id)
    if (seatNo) next.set('seat', String(seatNo)); else next.delete('seat')
    next.delete('modal')
    setParams(next)
  }
  const goHome = () => {
    if (floor.id !== MY_FLOOR.id) { goFloor(MY_FLOOR, field.mySeat ?? undefined); return }
    if (field.mySeat) handle.current?.goSeat(field.mySeat)
  }

  const events = {
    onStand: (n: number) => {
      setSeat(n); setMoving(false)
      // 주소에 지금 자리 기억 (땅굴에 들어갔다 뒤로 오면 같은 자리)
      if (seatInUrl.current !== String(n)) {
        seatInUrl.current = String(n)
        setParams((p) => { const q = new URLSearchParams(p); q.set('seat', String(n)); if (!q.get('floor')) q.set('floor', floor.id); return q }, { replace: true })
      }
    },
    onMove: (_: number, to: number) => { setMoving(true); setHover(null); setSeat(to) },
    onHover: (n: number | null, hx: number, hy: number) => setHover(n == null ? null : { seat: n, x: hx, y: hy }),
    onLadder: () => setModal('floor'),
    onAnchor: (ax: number, ay: number, vis: boolean) => { anchor.current = { x: ax, y: ay, vis }; placeSign() },
  }

  const hoverUser = hover ? bySeat.get(hover.seat) : null

  return (
    <main className={s.page}>
      <div className={`${rv.scene} ${x.sceneBg}`}>
        {/* 3D 를 못 만들면(WebGL 없음 등) 3D 자리에 GPU 로 미리 찍은 들판 그림 (three/stills.ts, docs/rendering-experiments-3.md 4번) */}
        <SceneBoundary fallback={<img src={fieldStill.src} alt="" aria-hidden draggable={false} style={stillStyle(fieldStill, focusX)} />}>
        <Suspense fallback={null}>
          <HoleFieldCanvas
            fieldKey={floor.id}
            occupied={occupied}
            zones={field.zones}
            mySeat={field.mySeat}
            startSeat={startSeat}
            worn={worn}
            focusX={focusX}
            events={events}
            onReady={(h) => { handle.current = h; h.loaded?.then(() => setReady(true)) }}
            className={rv.canvas}
            label={`${floorLabel(floor)} 들판. 두더지가 구멍 위에 서 있어요`}
          />
        </Suspense>
        </SceneBoundary>

        {/* 서 있는 구멍의 안내판 (두더지 머리 왼쪽 위) */}
        {ready && here && !moving && (
          <div ref={(el) => { signEl.current = el; placeSign() }} className={x.sign} data-hidden="1" role="group" aria-label={here.mine ? '내 땅굴 안내판' : `${owner!.nickname}님의 땅굴 안내판`}>
            <div className={x.signCard}>
              <div className={x.signOwner}>
                <Avatar size={40} />
                <div>
                  <strong>{here.mine ? '내 땅굴' : `${owner!.nickname}님의 땅굴`}</strong>
                  <small>{here.mine ? `${floorLabel(floor)} · ${here.seat}번 자리` : `같은 관심사 ${shared.length}개`}</small>
                </div>
              </div>
              {!here.mine && shared.length > 0 && <div className={x.signTags}>{shared.slice(0, 3).map((t) => <InterestChip key={t} label={t} />)}</div>}
              <button className={`btn btn-cta ${x.signBtn}`} onClick={enter}>
                {here.mine ? '내 땅굴 들어가기' : '땅굴 놀러가기'} <kbd className={x.kbd}>Enter</kbd>
              </button>
            </div>
          </div>
        )}
        {/* 마우스를 올린 구멍의 이름표 */}
        {hover && hoverUser && (
          <span className={x.nameTag} style={{ left: hover.x, top: hover.y }}>
            {hoverUser.mine ? '내 땅굴' : hoverUser.user.nickname}
            {!hoverUser.mine && hoverUser.user.online && <i className={x.onDot} aria-label="접속 중" />}
          </span>
        )}

        <div className={x.leftTools}>
          <SceneButton tone="paper" onClick={() => setModal('regulars')}>단골 땅굴</SceneButton>
          <SceneButton tone="paper" onClick={() => setModal('recommend')}>
            오늘의 추천 친구 {!recDone && <><i className={x.redDot} aria-hidden /><span className="sr-only">(오늘 아직 안 받음)</span></>}
          </SceneButton>
          <SceneButton tone="paper" onClick={() => setModal('floor')} aria-label={`지금 들판 ${floorLabel(floor)}. 캠퍼스-층 고르기`}>
            {floorLabel(floor)} <span aria-hidden className={x.caret}>▾</span>
          </SceneButton>
        </div>

        {others === 0 && ready && (
          <div className={x.emptyField} style={{ left: `${focusX * 100}%` }}>
            <EmptyMole message="이 들판에는 아직 다른 땅굴이 없어요">
              <button className="btn btn-cta" onClick={() => setModal('floor')}>다른 캠퍼스-층 가보기</button>
            </EmptyMole>
          </div>
        )}

        {(floor.id !== MY_FLOOR.id || (field.mySeat && seat !== field.mySeat)) && (
          <SceneButton tone="cream" className={x.homeBtn} onClick={goHome} disabled={moving}>
            <HomeIcon size={16} /> 내 땅굴로 돌아가기
          </SceneButton>
        )}

        {/* 미니맵 (전체 마을 지도, docs/explore-designs.md) */}
        {ready && <Minimap field={field} floor={floor} seat={seat} moving={moving} view={{ kind: 'camera', focusX, coverRight: panelOpen ? 372 : 0 }} onGo={(n) => { handle.current?.goSeat(n) }} onLadder={() => setModal('floor')} />}

        <p className={x.hint} style={{ left: `${focusX * 100}%` }}>
          <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> 옆 구멍으로 · 구멍을 누르면 바로 이동 · <kbd>Enter</kbd> 땅굴에 들어가기
        </p>
        <RoomModeToggle style={{ left: `${focusX * 100}%` }} />
        {!ready && <span className={x.loading} style={{ left: `${focusX * 100}%` }} role="status">들판으로 나가는 중…</span>}
      </div>

      {/* 가장 가까운(서 있는) 땅굴 주인 정보 */}
      {panelOpen ? (
        <aside className={s.roomInfo} aria-label="땅굴 주인 정보">
          <div className={s.panelHead}>
            <h2 className="display">{!owner ? '빈 들판' : here?.mine ? '내 땅굴' : `${owner.nickname}님의 땅굴`}</h2>
            <button className="link-accent" onClick={() => setPanelOpen(false)}>접기 ›</button>
          </div>
          {owner ? (
            <>
              <div className={s.profile}>
                <Avatar size={64} />
                <div>
                  <p className={`display ${s.nick}`}>{owner.nickname} {owner.online && !here?.mine && <small className={s.online}>● 접속 중</small>}</p>
                  <p className={s.aff}>{affOf(owner)}</p>
                </div>
              </div>
              <div className={`${s.introBox} ${s.introRead}`}>
                <span className={s.introHead}><strong>자기소개</strong></span>
                <p className={s.introP}>{owner.intro || '아직 작성한 자기소개가 없어요.'}</p>
              </div>
              <dl className={s.details}>
                <div><dt>관심 분야</dt><dd>{owner.interests.slice(0, 3).join(', ')}{owner.interests.length > 3 && ` 외 ${owner.interests.length - 3}개`}</dd></div>
                {!here?.mine && <div><dt>겹치는 관심사</dt><dd className={x.shared}>{shared.length ? shared.join(', ') : '아직 없어요'}</dd></div>}
              </dl>
              {owner.qna?.length ? (
                <>
                  <h3 className={`display ${s.qnaTitle}`}>Q&amp;A</h3>
                  <dl className={s.qna}>{owner.qna.slice(0, 3).map((q) => <div key={q.q}><dt>{q.q}</dt><dd>{q.a}</dd></div>)}</dl>
                </>
              ) : null}
            </>
          ) : (
            <p className={x.panelEmpty}>이 들판엔 아직 땅굴이 없어요. 사다리를 누르거나 왼쪽 위 캠퍼스-층 버튼으로 다른 들판에 가 보세요.</p>
          )}
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)}><span className="display">땅굴 정보</span><Avatar size={22} /></button>
      )}

      <RegularsModal open={modal === 'regulars'} onClose={() => setModal(null)} onRemoved={(n) => setToast(`${n}님을 단골에서 뺐어요`)} />
      <RecommendModal open={modal === 'recommend'} onClose={() => { setModal(null); setRecTick((n) => n + 1) }} />
      <FloorPickerModal open={modal === 'floor'} current={floor} onClose={() => setModal(null)} onPick={(f) => goFloor(f, f.id === MY_FLOOR.id ? field.mySeat ?? undefined : undefined)} />
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast ?? ''} />

      {/* 땅굴로 들어갈 때 어두워짐 · 들판에 나올 때(땅굴에서 나옴·처음 들어옴) 어두운 화면에서 밝아짐 */}
      <div className={`${x.fade} ${leaving ? x.fadeIn : ready ? x.fadeOut : x.fadeHold}`} aria-hidden />
    </main>
  )
}
