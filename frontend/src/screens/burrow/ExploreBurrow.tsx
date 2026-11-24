import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/nav'
import { useQueryClient } from '@tanstack/react-query'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton from '../../components/SceneButton'
import { EmptyMole, Toast } from '../../components/Feedback'
import { HomeIcon } from '../../components/Icons'
import { ErrorState } from '../../components/AsyncState'
import { getMyWorn } from '../../data/moleItems'
import { cropOf, floorLabel, me } from '../../data/field'
import {
  exploreKeys, parsePlace, placeId, resetDailyRecommendationDemo, samePlace, useDailyRecommendation, useField, useHomePlace,
  type FieldPlace, type FieldVM,
} from '../../api/explore'
import type { HoleFieldHandle } from '../../three/holeField'
import { ZOOM_LEVELS, ZOOM_NAME, type ZoomLevel } from '../../three/fieldCam'
import { FloorPickerModal, RecommendModal, RegularsModal } from './ExploreModals'
import Minimap, { type MinimapHandle } from './Minimap'
import { NotePanel, RoomNoteBody, useNotePanel } from './RoomNote'
import SceneBoundary from '../../components/SceneBoundary'
import FxPanel from '../../components/FxPanel'
import LanternPicker from '../../components/LanternPicker'
import { closeSeatsOf, holeFxOf, type HoleFx } from '../../data/interestFx'
import { stillFor, stillStyle } from '../../three/stills'
import { isActivatable, shortcutAllowed } from '../../lib/a11y'
import rv from '../../components/RoomView.module.css'
import s from './Burrow.module.css'
import x from './Explore.module.css'

const HoleFieldCanvas = lazy(() => import('../../three/HoleFieldCanvas'))

/** 땅굴로 들어갈 때 화면이 어두워지는 시간 (ms) */
const ENTER_FADE = 450
/** 줌 휠: 누적 deltaY 가 이만큼이면 한 단계, 한 단계 바꾼 뒤 이 시간(ms) 동안 들어오는 휠은 무시 (camera_zoom_spec 6) */
const WHEEL_STEP = 80, WHEEL_QUIET = 250

/**
 * 땅굴 메인 – 탐색 (Figma 02 F5 787:3619 · 03 Screens 디자인 참고, 3D 핸드오프 v3.9 들판 + v3.8 두더지 잡기 이동). 2026-11-16 새로 만듦
 * - 들판 = 학기 하나의 캠퍼스-층 하나 (00 공통 19). 주소 ?floor=<학기|캠퍼스|층>&seat=<자리> 로 보던 자리를 기억 (뒤로 가기 하면 그대로)
 * - 두더지는 늘 구멍 하나에 서 있음. 방향키 = 그 방향 ±45° 가장 가까운 구멍, 구멍 누르기 = 바로 그 구멍, 이동 중엔 입력 잠금
 * - Enter / 방노트 안 "땅굴 놀러가기" = 화면이 어두워진 뒤 그 땅굴로 (내 구멍이면 내 땅굴). 땅굴에서 탐색으로 나오면 어두운 화면에서 밝아짐. 두더지 옆 안내판 카드는 없앰(2026-11-20)
 * - 왼쪽 위: 단골 땅굴 · 추천 친구(= 오늘의 추천 친구 팝업, 오늘 아직 안 받았으면 빨간 점) · 캠퍼스-층. 사다리를 눌러도 캠퍼스-층 고르기
 * - 오른쪽 사이드바 "방노트" (2026-11-20, 명세 05 탐색 3 dev 9ea6698): 들어올 때마다 접혀 있고(펼친 것을 기억하지 않음) 오른쪽 위에 "방노트" 버튼만. 누르면 펼쳐져 가장 가까운(서 있는) 땅굴 주인 정보
 *   (닉네임·소속·관심사·Q&A)와 "땅굴 놀러가기"(Enter, 내 구멍이면 "내 땅굴 들어가기")가 들어 있고, "접기"로 다시 버튼만. 펼친 채 다른 구멍으로 가면 그 주인 정보로 바뀜
 *   아래 가운데: 내 땅굴 / 탐색, 왼쪽 아래: 내 땅굴로 돌아가기
 * - 줌 (3D 핸드오프 v3.10, docs/explore-field-v3-10.md): 가까이·중간·멀리 3단계. 휠(누적 ±80 이면 한 단계, 250ms 쉼) · +/− 키 · 오른쪽 아래 버튼.
 *   전환 0.5초. 주소 ?zoom=mid|far 로 기억 (땅굴에 들어갔다 뒤로 오면 같은 단계)
 * - 작물: 층마다 한 종류 (data/field.ts cropOf)
 * - 2026-11-22 API v1 (docs/backend/api-v1/05-explore-visit.md): 들판 = GET /terms/{termId}/fields/{campusFloorId} (입구 · 주인 카드 값 한 번에),
 *   주소 ?floor=<학기 id>|<캠퍼스-층 id>, 없으면 내 땅굴의 들판(이번 학기 + 내 캠퍼스-층). 추천 친구 빨간 점 = GET /me/daily-recommendation 의 hasReceived.
 *   "접속 중" 표시는 없음 (명세 README "이번 범위에 없는 것"). 방노트에 자기소개는 없음 (명세 탐색 3 은 적지만 들판 API 가 주지 않음, 백엔드 질문)
 * 데모용 쿼리: ?panel=open (방노트 펼친 채로) · ?modal=regulars|recommend|floor · ?recommend=reset (오늘 받은 추천 지우기, 목 서버) · ?zoom=mid|far
 */
export default function ExploreBurrow() {
  const [params] = useSearchParams()
  const home = useHomePlace()
  const asked = parsePlace(params.get('floor'))
  const place = asked ?? home.place
  const q = useField(place)
  const field = q.data
  if (!field) {
    const err = q.error ?? (!place ? home.error : null)
    return (
      <main className={s.page}>
        <div className={`${rv.scene} ${x.sceneBg}`}>
          {err ? (
            <div className={x.emptyField} style={{ left: '50%' }}>
              <ErrorState error={err} onRetry={() => void q.refetch()} retrying={q.isFetching} title="들판을 불러오지 못했어요" />
              {asked && <Link className="btn btn-line" to="/burrow/explore">내 들판으로</Link>}
            </div>
          ) : <span className={x.loading} style={{ left: '50%' }} role="status">들판으로 나가는 중…</span>}
        </div>
      </main>
    )
  }
  return <ExploreField field={field} home={home.place} />
}

function ExploreField({ field, home }: { field: FieldVM; home: FieldPlace | null }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const floor = field.floor
  const bySeat = useMemo(() => new Map(field.residents.map((r) => [r.seat, r])), [field])
  const occupied = useMemo(() => field.residents.map((r) => r.seat), [field])
  const others = field.residents.filter((r) => !r.mine).length
  // 관심사 이펙트: 자리마다 대표 관심사·겹치는 관심사·드문 관심사·접속 (docs/interest-effects.md)
  const fxSeats = useMemo(() => {
    const mineInt = me().interests
    const close = closeSeatsOf(field.residents, mineInt)
    return field.residents.map((r) => holeFxOf(r.seat, r.user, !!r.mine, mineInt)).filter((x): x is HoleFx => !!x).map((h) => ({ ...h, close: close.has(h.seat) }))
  }, [field])
  const seatParam = Number(params.get('seat'))
  const startSeat = bySeat.has(seatParam) ? seatParam : field.mySeat ?? field.residents[0]?.seat ?? 0
  const crop = cropOf(floor)
  // 줌 단계 (주소에 기억). 장면이 단계를 바꾸면 onZoom 으로 알려 줌
  const zoomParam = params.get('zoom') as ZoomLevel | null
  const [zoom, setZoom] = useState<ZoomLevel>(zoomParam && ZOOM_LEVELS.includes(zoomParam) ? zoomParam : 'near')
  const sceneEl = useRef<HTMLDivElement | null>(null)

  const [seat, setSeat] = useState(startSeat)
  const [moving, setMoving] = useState(false)
  // 방노트: 들어오면 접혀 있음 (?panel=open 이면 펼친 채로). 접고 펼치기·초점 이동은 RoomNote 의 useNotePanel (방문자 뷰와 같음)
  const note = useNotePanel(params.get('panel') === 'open')
  const panelOpen = note.open
  const [modal, setModal] = useState<null | 'regulars' | 'recommend' | 'floor'>(() => {
    const m = params.get('modal'); return m === 'regulars' || m === 'recommend' || m === 'floor' ? m : null
  })
  const [hover, setHover] = useState<{ seat: number; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  // 3D 를 못 만듦 (SceneBoundary): 어두운 막·로딩 글자를 거두고 정지 그림을 보여 줌
  const [failed3d, setFailed3d] = useState(false)
  const handle = useRef<HoleFieldHandle | null>(null)
  const mapRef = useRef<MinimapHandle | null>(null)
  const worn = useMemo(() => getMyWorn(), [])
  // 오늘의 추천을 받았는지 (GET /me/daily-recommendation, 받는 중에는 점을 안 띄움)
  const daily = useDailyRecommendation()
  const recDone = daily.data?.hasReceived ?? true
  const seatInUrl = useRef(params.get('seat'))

  const here = bySeat.get(seat)
  const owner = here?.user
  const mine = me()
  // 나와 같은 관심사 (서버의 isShared)
  const shared = owner && !here?.mine ? here?.shared ?? [] : []
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
      // 줌: + (= 키 포함) 가까이, − 멀리
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); handle.current?.zoomBy(-1); return }
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') { e.preventDefault(); handle.current?.zoomBy(1); return }
      // Enter 가 버튼·링크·탭 자체의 동작이면 그쪽에 맡김
      if (e.key === 'Enter' && !isActivatable(e.target)) { e.preventDefault(); enter() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, leaving, enter])

  // 줌 휠 (3D 캔버스 위에서만. 미니맵·버튼·패널 위 휠은 그대로): 누적 ±80 이면 한 단계, 바꾼 뒤 250ms 동안 들어오는 휠은 무시
  useEffect(() => {
    const el = sceneEl.current
    if (!el) return
    let acc = 0, quietUntil = 0, last = 0
    const onWheel = (e: WheelEvent) => {
      // Ctrl + 휠(브라우저 확대·트랙패드 집기)은 브라우저에 맡김
      if (modal || leaving || e.ctrlKey || !(e.target instanceof HTMLCanvasElement)) return
      e.preventDefault()
      const now = performance.now()
      if (now < quietUntil) return
      if (now - last > WHEEL_QUIET) acc = 0 // 한동안 안 굴렸으면 새로 셈
      last = now
      acc += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1)
      if (Math.abs(acc) < WHEEL_STEP) return
      const step = acc > 0 ? 1 : -1
      acc = 0; quietUntil = now + WHEEL_QUIET
      handle.current?.zoomBy(step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [modal, leaving])

  useEffect(() => {
    if (params.get('recommend') === 'reset' && resetDailyRecommendationDemo()) void qc.invalidateQueries({ queryKey: exploreKeys.daily })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goFloor = (p: FieldPlace, seatNo?: number) => {
    setModal(null)
    const next = new URLSearchParams(params)
    next.set('floor', placeId(p))
    if (seatNo) next.set('seat', String(seatNo)); else next.delete('seat')
    next.delete('modal')
    setParams(next)
  }
  const atHomeField = !home || samePlace(field.place, home)
  const goHome = () => {
    if (!atHomeField && home) { goFloor(home); return }
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
    // 마우스로 끌어 옮긴 카메라 → 미니맵 "보이는 곳"
    onCamera: (cx: number, cz: number) => mapRef.current?.setCamera(cx, cz),
    onZoom: (lv: ZoomLevel) => {
      setZoom(lv); setHover(null)
      setParams((p) => { const q = new URLSearchParams(p); if (lv === 'near') q.delete('zoom'); else q.set('zoom', lv); return q }, { replace: true })
    },
  }
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom)

  const hoverUser = hover ? bySeat.get(hover.seat) : null

  return (
    <main className={s.page}>
      <div ref={sceneEl} className={`${rv.scene} ${x.sceneBg}`}>
        {/* 3D 를 못 만들면(WebGL 없음 등) 3D 자리에 GPU 로 미리 찍은 들판 그림 (three/stills.ts, docs/rendering-experiments-3.md 4번) */}
        <SceneBoundary onError={() => setFailed3d(true)} fallback={<img src={fieldStill.src} alt="" aria-hidden draggable={false} style={stillStyle(fieldStill, focusX)} />}>
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
            fx={fxSeats}
            crop={crop.id}
            zoom={zoom}
            className={rv.canvas}
            label={`${floorLabel(floor)} 들판 (${crop.name}밭). 두더지가 구멍 위에 서 있어요`}
          />
        </Suspense>
        </SceneBoundary>

        {/* 마우스를 올린 구멍의 이름표 */}
        {hover && hoverUser && (
          <span className={x.nameTag} style={{ left: hover.x, top: hover.y }}>
            {hoverUser.mine ? '내 땅굴' : hoverUser.user.nickname}
          </span>
        )}

        {/* data-fx-avoid: 관심사 이펙트 이정표가 이 버튼 줄·미니맵 밑에 숨지 않게 비켜 감 (three/interestFx/fieldFx.ts) */}
        <div className={x.leftTools} data-fx-avoid="">
          <SceneButton tone="paper" onClick={() => setModal('regulars')}>단골 땅굴</SceneButton>
          <SceneButton tone="paper" onClick={() => setModal('recommend')}>
            추천 친구 {!recDone && <><i className={x.redDot} aria-hidden /><span className="sr-only">(오늘 아직 안 받음)</span></>}
          </SceneButton>
          <SceneButton tone="paper" onClick={() => setModal('floor')} aria-label={`지금 들판 ${floorLabel(floor)}. 캠퍼스-층 고르기`}>
            {floorLabel(floor)} <span aria-hidden className={x.caret}>▾</span>
          </SceneButton>
          {/* 관심사 등불 (관심사 이펙트 f_lantern, docs/interest-effects.md 2차): 켜 둔 때만 보임 */}
          <LanternPicker residents={field.residents} myInterests={mine.interests} />
        </div>

        {others === 0 && ready && (
          <div className={x.emptyField} style={{ left: `${focusX * 100}%` }}>
            <EmptyMole message="이 들판에는 아직 다른 땅굴이 없어요">
              <button className="btn btn-cta" onClick={() => setModal('floor')}>다른 캠퍼스-층 가보기</button>
            </EmptyMole>
          </div>
        )}

        {(!atHomeField || (field.mySeat && seat !== field.mySeat)) && (
          <SceneButton tone="cream" className={x.homeBtn} onClick={goHome} disabled={moving}>
            <HomeIcon size={16} /> 내 땅굴로 돌아가기
          </SceneButton>
        )}

        {/* 미니맵 (전체 마을 지도, docs/explore-designs.md). 보이는 범위는 줌 단계를 따라감 */}
        {ready && <Minimap handleRef={mapRef} field={field} floor={floor} seat={seat} moving={moving} view={{ kind: 'camera', focusX, coverRight: panelOpen ? 372 : 0, level: zoom }} onGo={(n) => { handle.current?.goSeat(n) }} onLadder={() => setModal('floor')} />}

        {/* 줌 3단계 (+ 가까이 · 점 = 가까이/중간/멀리 · − 멀리). 이펙트 버튼 위 */}
        {ready && (
          <div className={x.zoom} style={{ right: panelOpen ? 388 : 33 }} role="group" aria-label="들판 보기 거리">
            <button className={x.zoomStep} onClick={() => handle.current?.zoomBy(-1)} disabled={zoomIdx <= 0} aria-label="가까이 보기 (+ 키)" title="가까이 (+)">+</button>
            {ZOOM_LEVELS.map((lv) => (
              <button key={lv} className={x.zoomDot} onClick={() => handle.current?.zoom(lv)} aria-pressed={zoom === lv} aria-label={`${ZOOM_NAME[lv]} 보기`} title={ZOOM_NAME[lv]}><i /></button>
            ))}
            <button className={x.zoomStep} onClick={() => handle.current?.zoomBy(1)} disabled={zoomIdx >= ZOOM_LEVELS.length - 1} aria-label="멀리 보기 (− 키)" title="멀리 (−)">−</button>
          </div>
        )}

        <p className={x.hint} style={{ left: `${focusX * 100}%` }}>
          <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> 옆 구멍으로 · 구멍을 누르면 바로 이동 · <kbd>+</kbd><kbd>−</kbd> 휠 멀리·가까이 · <kbd>Enter</kbd> 땅굴에 들어가기
        </p>
        <RoomModeToggle style={{ left: `${focusX * 100}%` }} />
        {/* 관심사 이펙트 켜고 끄기 (docs/interest-effects.md). 정보 패널 왼쪽 아래 */}
        <FxPanel area="field" style={{ right: panelOpen ? 388 : 33 }} />
        {!ready && !failed3d && <span className={x.loading} style={{ left: `${focusX * 100}%` }} role="status">들판으로 나가는 중…</span>}
      </div>

      {/* 방노트: 가장 가까운(서 있는) 땅굴 주인 정보 + 땅굴 놀러가기. 접힌 동안은 오른쪽 위 "방노트" 버튼만 (MyBurrow 와 같은 모양) */}
      <NotePanel panel={note} title={!owner ? '빈 들판' : here?.mine ? '내 땅굴' : `${owner.nickname}님 땅굴`}>
        {owner ? (
          <RoomNoteBody owner={owner} shared={shared} mine={!!here?.mine}>
            {/* 땅굴 놀러가기: 두더지 옆 안내판 대신 여기, 관심사 바로 아래·Q&A 위. Enter 키로 들어가는 것도 그대로 (위 keydown) */}
            <button className={`btn btn-cta ${x.noteEnter}`} onClick={enter} disabled={moving || leaving}>
              {here?.mine ? '내 땅굴 들어가기' : '땅굴 놀러가기'} <kbd className={x.kbd}>Enter</kbd>
            </button>
          </RoomNoteBody>
        ) : (
          <p className={x.panelEmpty}>이 들판엔 아직 땅굴이 없어요. 사다리를 누르거나 왼쪽 위 캠퍼스-층 버튼으로 다른 들판에 가 보세요.</p>
        )}
      </NotePanel>

      <RegularsModal open={modal === 'regulars'} onClose={() => setModal(null)} onRemoved={(n) => setToast(`${n}님을 단골에서 뺐어요`)} />
      <RecommendModal open={modal === 'recommend'} onClose={() => setModal(null)} />
      <FloorPickerModal open={modal === 'floor'} current={field.place} onClose={() => setModal(null)} onPick={(p) => goFloor(p)} />
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast ?? ''} />

      {/* 땅굴로 들어갈 때 어두워짐 · 들판에 나올 때(땅굴에서 나옴·처음 들어옴) 어두운 화면에서 밝아짐 */}
      <div className={`${x.fade} ${leaving ? x.fadeIn : ready || failed3d ? x.fadeOut : x.fadeHold}`} aria-hidden />
    </main>
  )
}
