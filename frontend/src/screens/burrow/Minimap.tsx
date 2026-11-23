import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from 'react'
import { useRegularOwnerIds } from '../../api/explore'
import { useSearchParams } from '@/lib/nav'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { floorLabel, me, type FieldData, type Floor, type Resident } from '../../data/field'
import { FieldArt } from './explore-designs/FieldArt'
import { FIELD_BOUNDS, LADDER, MAP_COLORS, buildVillage, camFootprint, camTarget, layoutNow, loadLayout, type Layout, type Village } from './explore-designs/fieldGeo'
import { matchScore, sharedWith } from './explore-designs/match'
import m from './Minimap.module.css'
import { fxOn, fxVersion, getLantern, subscribeFx } from '../../lib/fxLab'
import { closeSeatsOf, fxColor, leadOf, subName, zoneLabel, zoneNamesOf, type ZoneName } from '../../data/interestFx'
import { toSubIds } from '../../data/interests'
import { ZOOM_DIST, ZOOM_SEC, distAt, easeStd, type ZoomLevel } from '../../three/fieldCam'
import { cropOf } from '../../data/field'

/*
 * 미니맵 (전체 마을 지도). 2026-11-16, docs/explore-designs.md
 * - 층 하나 = 마을. 켜진 구역(흙) · 안 켠 구역(잔디색) · 길 · 땅굴(링 색) · 빈 자리 · 내 땅굴(분홍 + 집) · 사다리 · 내 두더지 · 지금 보이는 범위
 * - 단골(노란 별, GET /me/regular-burrows). 마우스를 올리면 닉네임, 누르면 그 땅굴로 바로 이동(onGo). "접속 중" 표시는 없음 (명세 범위 밖, 2026-11-22)
 * - 접기/펼치기(이 브라우저에 기억), 크게 보기 = 전체 마을 지도 팝업(범례 · 단골/겹치는 관심사 필터 · 목록)
 * - 두더지는 자리가 바뀌면 두 구멍 사이를 부드럽게 옮겨 감(moving 일 때). 바깥에서 직접 움직이려면 handleRef.setMole (디자인 B)
 */

export interface MinimapHandle {
  /** 두더지 위치를 직접 (m 단위). 디자인 B 처럼 길을 따라 걸을 때 */
  setMole(x: number, z: number, facing?: number): void
  /** 보이는 범위 다각형 (m 단위 점들). null 이면 숨김 */
  setView(poly: [number, number][] | null): void
  /** 3D 카메라를 마우스로 끌어 옮겼을 때 지금 타깃 (m 단위, three x·z). 카메라 모드의 보이는 범위가 두더지 자리 대신 이 값을 따름. 두더지가 움직이거나 줌이 바뀌면 풀림 */
  setCamera(x: number, z: number): void
}

type View =
  /** 디자인 A 3D 카메라: 사다리꼴 (focusX = 목표점 가로 위치, coverRight = 오른쪽 카드가 가리는 px, level = 줌 단계. 바뀌면 0.5초 동안 따라감) */
  | { kind: 'camera'; focusX: number; coverRight: number; level?: ZoomLevel }
  /** 직접 넣음 (handleRef.setView) */
  | { kind: 'external' }
  | { kind: 'none' }

/** 큰 지도: 들판 전체 */
const VB = { x: FIELD_BOUNDS.x0 - 2, y: FIELD_BOUNDS.z0 - 2.5, w: FIELD_BOUNDS.x1 - FIELD_BOUNDS.x0 + 4, h: FIELD_BOUNDS.z1 - FIELD_BOUNDS.z0 + 4 }
const viewBox = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`
/** 작은 지도: 켜진 구역 + 둘레 7m (안 켠 구역은 가장자리만 잔디색으로 보임). 가로 248 · 세로 290px 안에 맞춤 */
const MINI = { w: 248, h: 290, margin: 7 }
function miniFrame(v: Village | null, maxH = MINI.h) {
  const b = v?.litBox ?? { x0: FIELD_BOUNDS.x0, x1: FIELD_BOUNDS.x1, z0: FIELD_BOUNDS.z0, z1: FIELD_BOUNDS.z1 }
  const x = b.x0 - MINI.margin, y = b.z0 - MINI.margin, w = b.x1 - b.x0 + MINI.margin * 2, h = b.z1 - b.z0 + MINI.margin * 2
  const k = Math.min(MINI.w / w, maxH / h)
  return { x, y, w, h, vb: `${x} ${y} ${w} ${h}`, pw: Math.round(w * k), ph: Math.round(h * k), k }
}
const STORE = 'digul.minimap'
/** ?map=big 데모 주소로 팝업을 연 적이 있는지 (들판을 옮겨 미니맵이 다시 생겨도 또 열지 않게) */
let bigOpenedOnce = false

function useLayout(): Layout | null {
  const [L, setL] = useState<Layout | null>(layoutNow)
  useEffect(() => { if (!L) loadLayout().then(setL).catch(() => undefined) }, [L])
  return L
}
export function useVillage(field: FieldData): Village | null {
  const L = useLayout()
  return useMemo(() => (L ? buildVillage(L, field.zones, field.residents.map((r) => r.seat), field.mySeat, cropOf(field.floor).id) : null), [L, field])
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const poly = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')

export default function Minimap({
  field, floor, seat, moving, view = { kind: 'none' }, onGo, onLadder, selected, moveMs = 820, camDelayMs = 420, camMs = 400,
  handleRef, onExpand, className, style, title,
}: {
  field: FieldData
  floor: Floor
  /** 내 두더지가 서 있는(가는) 자리 */
  seat: number
  /** 자리가 바뀔 때 옮겨 가는 중인지 (true 면 부드럽게) */
  moving?: boolean
  view?: View
  /** 땅굴을 누름 → 그 땅굴로 */
  onGo?: (seat: number) => void
  onLadder?: () => void
  /** 따로 강조할 자리 (디자인 C·D: 지금 고른 땅굴) */
  selected?: number | null
  moveMs?: number
  camDelayMs?: number
  camMs?: number
  handleRef?: Ref<MinimapHandle>
  /** 크게 보기 대신 할 일 (디자인 B 는 지도를 전체 보기로) */
  onExpand?: () => void
  className?: string
  style?: CSSProperties
  title?: string
}) {
  const v = useVillage(field)
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(STORE) !== 'closed' } catch { return true } })
  // 데모용: 주소 ?map=big 이면 전체 마을 지도 팝업을 열고 시작
  const [params] = useSearchParams()
  const [big, setBig] = useState(() => { if (params.get('map') !== 'big' || onExpand || bigOpenedOnce) return false; bigOpenedOnce = true; return true })
  const toggle = (on: boolean) => { setOpen(on); try { localStorage.setItem(STORE, on ? 'open' : 'closed') } catch { /* 저장소 없음 */ } }
  const regulars = useRegularOwnerIds()
  useSyncExternalStore(subscribeFx, fxVersion)
  const fxMap = fxOn('f_minimap')
  const myInterests = useMemo(() => me().interests, [])
  const bySeat = useMemo(() => new Map(field.residents.map((r) => [r.seat, r])), [field])
  // 관심사 이펙트 "동네 이름표" (f_zones): 구역마다 유난히 많이 모인 관심사
  const zoneNames = useMemo(() => zoneNamesOf(field.residents), [field])
  // 미니맵 ♥ (f_mapheart): 이 들판에서 나와 잘 맞는 쪽 자리만 (data/interestFx closeSeatsOf)
  const close = useMemo(() => closeSeatsOf(field.residents, myInterests), [field, myInterests])
  const lan = getLantern()

  const root = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const moleG = useRef<SVGGElement>(null)
  const viewP = useRef<SVGPolygonElement>(null)
  // 지금 두더지·보이는 범위 (팝업을 열 때도 같은 값으로 그림)
  const cur = useRef<{ mole: [number, number]; view: [number, number][] | null }>({ mole: [LADDER.x + 1.9, LADDER.z - 1.4], view: null })
  const sceneSize = useRef({ w: 16, h: 9 })
  // 화면이 낮으면 지도도 낮게 (왼쪽 위 버튼 3개 아래 ~ 왼쪽 아래 버튼 위에 들어가게)
  const [maxH, setMaxH] = useState(MINI.h)
  const [hover, setHover] = useState<{ seat: number; x: number; y: number } | null>(null)

  const posOf = (n: number): [number, number] => {
    const h = v?.seats.get(n)
    return h?.occupied ? [h.x, h.z] : [LADDER.x + 1.9, LADDER.z - 1.4] // 구멍이 없으면 사다리 옆 흙 위 (3D 와 같음)
  }
  // 줌 단계 (3D 와 같은 거리·타깃 한계, three/fieldCam.ts). zoomT = 줌 전환 중이면 [시작 타깃, 시작 거리, 진행 0~1]
  const level: ZoomLevel = view.kind === 'camera' ? view.level ?? 'near' : 'near'
  const lvRef = useRef(level)
  const zoomT = useRef<{ t0: [number, number]; d0: number; e: number } | null>(null)
  // 3D 에서 끌어 옮긴 카메라 타깃 (있으면 두더지 자리에서 계산하지 않고 이 값). 점프·줌이 시작되면 아래 효과들이 씀과 동시에 풀음
  const panT = useRef<[number, number] | null>(null)
  const footprint = (p: [number, number]) => {
    if (!v || view.kind !== 'camera') return null
    const [tx, tz] = panT.current ?? camTarget(v, p[0], p[1], lvRef.current)
    return footprintT(tx, tz)
  }
  const footprintT = (tx0: number, tz0: number) => {
    if (!v || view.kind !== 'camera') return null
    let tx = tx0, tz = tz0
    let D = ZOOM_DIST[lvRef.current]
    const z = zoomT.current
    if (z) { tx = z.t0[0] + (tx - z.t0[0]) * z.e; tz = z.t0[1] + (tz - z.t0[1]) * z.e; D = distAt(z.d0, D, z.e) }
    const { w, h } = sceneSize.current
    const u1 = Math.max(0.3, (w - view.coverRight) / w)
    return camFootprint(tx, tz, w / h, view.focusX, u1, D)
  }
  const drawMole = (p: [number, number], k = 1) => {
    cur.current.mole = p
    moleG.current?.setAttribute('transform', `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) scale(${k.toFixed(3)})`)
  }
  const drawView = (pts: [number, number][] | null) => {
    cur.current.view = pts
    if (!viewP.current) return
    if (pts) { viewP.current.setAttribute('points', poly(pts)); viewP.current.style.display = '' } else viewP.current.style.display = 'none'
  }

  useImperativeHandle(handleRef, () => ({
    setMole: (x, z) => drawMole([x, z]),
    setView: (pts) => drawView(pts),
    setCamera: (x, z) => { if (view.kind !== 'camera') return; panT.current = [x, z]; drawView(footprintT(x, z)) },
  }))

  // 장면 크기 (카메라 사다리꼴 비율)
  useEffect(() => {
    const scene = (root.current?.offsetParent ?? root.current?.parentElement) as HTMLElement | null
    if (!scene) return
    const fitH = () => setMaxH(Math.max(150, Math.min(MINI.h, window.innerHeight - 64 - 92 - 215 - 84))) // 64 = 위 메뉴 줄
    const ro = new ResizeObserver(() => {
      sceneSize.current = { w: scene.clientWidth || 16, h: scene.clientHeight || 9 }
      fitH()
      if (view.kind === 'camera') drawView(footprint(cur.current.mole))
    })
    ro.observe(scene)
    window.addEventListener('resize', fitH)
    return () => { ro.disconnect(); window.removeEventListener('resize', fitH) }
  }, [view.kind, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 자리가 바뀌면 두더지(와 보이는 범위)를 옮김. moving 이면 디자인 A 점프 리듬: 두더지 0~moveMs, 카메라 camDelay 뒤 camMs
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (!v) return
    // 바깥에서 움직이는 경우(디자인 B): 접었다 펴면 마지막 값으로 다시 그림
    if (view.kind === 'external') { drawMole(cur.current.mole); drawView(cur.current.view); return }
    const to = posOf(seat)
    const from = prev.current != null && prev.current !== seat ? posOf(prev.current) : null
    prev.current = seat
    // 끌어 둔 카메라였으면 그 타깃에서 새 구멍 타깃으로 (3D 점프 카메라와 같이). 풀고 시작
    const panFrom = panT.current
    panT.current = null
    if (!from || !moving || reduceMotion()) { drawMole(to); drawView(footprint(to)); return }
    const camFrom = cur.current.view ? panFrom ?? camTarget(v, from[0], from[1], lvRef.current) : null
    const camEnd = panFrom ? camTarget(v, to[0], to[1], lvRef.current) : null
    let raf = 0
    const t0 = performance.now()
    const step = () => {
      const t = performance.now() - t0
      const k = Math.min(1, t / moveMs)
      const e = ease(k)
      drawMole([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e], 1 + 0.45 * Math.sin(Math.PI * k))
      if (camFrom) {
        const c = ease(Math.min(1, Math.max(0, (t - camDelayMs) / camMs)))
        if (panFrom && camEnd) drawView(footprintT(panFrom[0] + (camEnd[0] - panFrom[0]) * c, panFrom[1] + (camEnd[1] - panFrom[1]) * c))
        else {
          const tgt: [number, number] = [from[0] + (to[0] - from[0]) * c, from[1] + (to[1] - from[1]) * c]
          drawView(footprint(tgt))
        }
      }
      if (k < 1 || t < camDelayMs + camMs) raf = requestAnimationFrame(step)
      else { drawMole(to); drawView(footprint(to)) }
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); drawMole(to); drawView(footprint(to)) }
  }, [seat, v, open]) // eslint-disable-line react-hooks/exhaustive-deps
  // 펼칠 때·카메라 값이 바뀔 때 다시 그림
  useEffect(() => { if (v && view.kind === 'camera') drawView(footprint(cur.current.mole)) }, [view.kind === 'camera' ? view.focusX : 0, view.kind === 'camera' ? view.coverRight : 0, open]) // eslint-disable-line react-hooks/exhaustive-deps
  // 줌 단계가 바뀌면 보이는 범위도 3D 처럼 0.5초 동안 (거리 로그 보간 + 타깃 같은 곡선)
  useEffect(() => {
    const prevLv = lvRef.current
    if (prevLv === level) return
    lvRef.current = level
    if (!v || view.kind !== 'camera' || reduceMotion()) { zoomT.current = null; drawView(footprint(cur.current.mole)); return }
    const p = cur.current.mole
    const t0 = panT.current ?? camTarget(v, p[0], p[1], prevLv), d0 = ZOOM_DIST[prevLv]
    panT.current = null // 줌도 끌어 둔 타깃에서 구멍 타깃으로 돌아옴 (3D 와 같음)
    const s = performance.now()
    let raf = 0
    const step = () => {
      const k = Math.min(1, (performance.now() - s) / (ZOOM_SEC * 1000))
      zoomT.current = k < 1 ? { t0, d0, e: easeStd(k) } : null
      drawView(footprint(cur.current.mole))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); zoomT.current = null; drawView(footprint(cur.current.mole)) }
  }, [level, v]) // eslint-disable-line react-hooks/exhaustive-deps

  const hitAt = (e: { clientX: number; clientY: number }, r: number) => {
    const el = svg.current
    if (!el || !v) return null
    const ctm = el.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    let best: number | null = null, bd = r
    for (const h of v.holes) { const dd = Math.hypot(h.x - p.x, h.z - p.y); if (dd < bd) { bd = dd; best = h.seat } }
    if (best != null) return { seat: best }
    if (Math.hypot(p.x - LADDER.x, p.y - LADDER.z) < 2.4) return { ladder: true }
    return null
  }
  const onMove = (e: React.PointerEvent) => {
    const hit = hitAt(e, 2.8)
    const rr = root.current!.getBoundingClientRect()
    if (hit?.seat != null) setHover({ seat: hit.seat, x: e.clientX - rr.left, y: e.clientY - rr.top })
    else setHover(null)
    ;(e.currentTarget as SVGElement).style.cursor = hit ? 'pointer' : 'default'
  }
  const onClick = (e: React.MouseEvent) => {
    const hit = hitAt(e, 2.8)
    if (hit?.seat != null) onGo?.(hit.seat)
    else if (hit?.ladder) onLadder?.()
  }

  const residents = field.residents
  const label = title ?? `${floorLabel(floor)} 마을`
  if (!open) {
    return (
      <button className={`${m.opener} ${className ?? ''}`} style={style} onClick={() => toggle(true)} aria-label="마을 지도 펼치기">
        <MapIcon /> 마을 지도 <span className={m.openerSub}>{floorLabel(floor)}</span>
      </button>
    )
  }
  const hoverR = hover ? bySeat.get(hover.seat) : undefined
  const fr = miniFrame(v, maxH)
  // 지도 한 칸(px/m)이 클수록 구멍 표시를 조금 작게 (구역 1~2개일 때 너무 굵지 않게)
  const holeScale = Math.min(1.5, Math.max(1.05, 4.6 / fr.k))
  return (
    <div ref={root} className={`${m.box} ${className ?? ''}`} style={style} data-fx-avoid="" role="region" aria-label={`미니맵: ${label}`} data-portrait={fr.pw < 205 ? '' : undefined}>
      <div className={m.head}>
        <strong className="display">{label}</strong>
        <span className={m.count}>땅굴 {residents.length}</span>
        <button className={m.iconBtn} onClick={() => (onExpand ? onExpand() : setBig(true))} aria-label="크게 보기" title="크게 보기"><ExpandIcon /></button>
        <button className={m.iconBtn} onClick={() => toggle(false)} aria-label="미니맵 접기" title="접기"><FoldIcon /></button>
      </div>
      <div className={m.mapWrap}>
        <svg ref={svg} className={m.map} viewBox={fr.vb} width={fr.pw} height={fr.ph} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={onClick} aria-hidden>
          <rect x={fr.x} y={fr.y} width={fr.w} height={fr.h} fill={MAP_COLORS.grass} />
          {v && <FieldArt v={v} detail="mini" />}
          {v && fxOn('f_zones') && <ZoneLabels v={v} names={zoneNames} size={Math.max(2.1, 10 / fr.k)} />}
          {v && <Holes v={v} bySeat={bySeat} regulars={regulars} scale={holeScale} selected={selected} hoverSeat={hover?.seat ?? null} close={close} />}
          <polygon ref={viewP} className={m.view} points="" style={{ display: 'none' }} />
          <g ref={moleG} className={m.mole}><MoleMark pulseKey={seat} /></g>
        </svg>
        {hover && hoverR && (
          <span className={m.tip} style={{ left: hover.x, top: hover.y }}>
            {hoverR.mine ? '내 땅굴' : hoverR.user.nickname}
            {!hoverR.mine && regulars.includes(hoverR.user.id) && <b className={m.star}>★</b>}
          </span>
        )}
      </div>
      <div className={m.legend} aria-hidden>
        <span><i className={m.lgMole} />나</span>
        <span><i className={m.lgMine} />내 땅굴</span>
        <span><b className={m.star}>★</b>단골</span>
        {view.kind !== 'none' && <span><ViewIcon />보이는 곳</span>}
        {fxMap && <span><i className={m.lgFx} />색 = 대표 관심사</span>}
        {fxOn('f_mapheart') && <span><b className={m.lgHeart}>♥</b>잘 맞는 이웃</span>}
        {lan && <span><i className={m.lgLamp} />등불 = {subName(lan)}</span>}
      </div>
      <VillageModal open={big} onClose={() => setBig(false)} field={field} floor={floor} v={v} bySeat={bySeat} regulars={regulars} myInterests={myInterests} zoneNames={zoneNames} close={close}
        mole={view.kind === 'external' ? cur.current.mole : posOf(seat)}
        viewPts={view.kind === 'camera' ? footprint(posOf(seat)) : view.kind === 'external' ? cur.current.view : null} selected={selected}
        onGo={(n) => { setBig(false); onGo?.(n) }} onLadder={onLadder ? () => { setBig(false); onLadder() } : undefined} />
    </div>
  )
}

/* ---------- 구멍 (작은 지도 · 큰 지도 같이) ---------- */
function Holes({ v, bySeat, regulars, scale, selected, hoverSeat, dim, labels, close }: {
  v: Village; bySeat: Map<number, Resident>; regulars: string[]; scale: number; selected?: number | null; hoverSeat: number | null
  /** 나와 잘 맞는 자리 (미니맵 ♥, f_mapheart) */
  close?: Set<number>
  /** 흐리게 할 자리 (필터에 안 맞음) */
  dim?: (r: Resident) => boolean
  /** 이름표를 붙일 자리 */
  labels?: (r: Resident) => string | null
}) {
  // 관심사 이펙트 "미니맵 관심사 색" (docs/interest-effects.md F12): 땅굴 링을 대표 관심사(맨 앞) 카테고리 색으로
  useSyncExternalStore(subscribeFx, fxVersion)
  const fxMap = fxOn('f_minimap')
  // 2차: 나와 겹치는 땅굴에 ♥ (f_mapheart) · 관심사 등불을 켜면 그 관심사 땅굴만 노란 빛, 나머지는 흐리게 (f_lantern)
  const fxHeart = fxOn('f_mapheart')
  const lan = getLantern()
  return (
    <g>
      {v.holes.map((h) => {
        const r = bySeat.get(h.seat)
        if (!r) return null
        const mine = !!r.mine
        const subs = toSubIds(r.user.interests)
        const lit = !!lan && !mine && subs.includes(lan)
        const faded = dim?.(r) || (!!lan && !mine && !lit)
        const R = (mine ? 1.45 : 1.1) * scale
        const lab = labels?.(r)
        const heart = fxHeart && !mine && !!close?.has(h.seat)
        return (
          <g key={h.seat} transform={`translate(${h.x} ${h.z})`} opacity={faded ? 0.32 : 1}>
            {lit && <><circle r={R + 2.2 * scale} fill="#FFC24A" opacity={0.55} /><circle r={R + 1.1 * scale} fill="none" stroke="#F06A3A" strokeWidth={0.5 * scale} /></>}
            {(selected === h.seat || hoverSeat === h.seat) && <circle r={R + 0.9 * scale} fill="none" stroke="#fff" strokeWidth={0.45 * scale} />}
            <circle r={R} fill={fxMap && !mine ? fxColor(leadOf(r.user.interests)?.cat) : h.ring} stroke={mine ? '#fff' : 'rgba(90,55,30,.55)'} strokeWidth={(mine ? 0.42 : 0.22) * scale} />
            <circle r={R * 0.45} fill={MAP_COLORS.holeIn} />
            {mine && <path transform={`translate(0 ${-R - 1.5 * scale}) scale(${0.42 * scale})`} d="M-3 1 L0 -2 L3 1 V4 H-3 Z" fill="#c8643a" stroke="#fff" strokeWidth={0.8} strokeLinejoin="round" />}
            {!mine && regulars.includes(r.user.id) && <path transform={`translate(${-R * 0.85} ${-R * 0.85}) scale(${0.36 * scale})`} d={STAR} fill="#f6c443" stroke="#8a5a1a" strokeWidth={0.5} />}
            {heart && <path transform={`translate(${R * 0.95} ${R * 0.7}) scale(${0.42 * scale})`} d={HEART} fill="#FF8A5B" stroke="#fff" strokeWidth={0.7} strokeLinejoin="round" />}
            {lab && <text y={R + 2 * scale} textAnchor="middle" fontSize={1.35 * scale} className={m.holeLabel}>{lab}</text>}
          </g>
        )
      })}
    </g>
  )
}
const STAR = 'M0 -3 L.9 -.9 L3 -.9 L1.3 .5 L1.9 2.7 L0 1.4 L-1.9 2.7 L-1.3 .5 L-3 -.9 L-.9 -.9 Z'
const HEART = 'M0 2.6 C-3.4 .4 -2.8 -2.8 0 -1 C2.8 -2.8 3.4 .4 0 2.6 Z'

/** 동네 이름표 (관심사 이펙트 f_zones): 켜진 구역 위쪽 가장자리에 "음악 동네" (구역 카테고리 색 글자 + 흰 바탕) */
function ZoneLabels({ v, names, size, inside = false }: { v: Village; names: ZoneName[]; size: number; inside?: boolean }) {
  return (
    <g pointerEvents="none">
      {v.zonesOn.map((z) => {
        const n = names.find((x) => x.zone === z.zone)
        if (!n) return null
        const south = Math.max(z.bounds.z[0], z.bounds.z[1]) > -1
        // 작은 지도는 바깥 여백(7m)에, 크게 보기는 여백이 좁아 구역 안쪽 가장자리에
        const off = inside ? -size * 1.2 : size * 1.15
        const x = (z.bounds.x[0] + z.bounds.x[1]) / 2, y = south ? Math.max(z.bounds.z[0], z.bounds.z[1]) + off : Math.min(z.bounds.z[0], z.bounds.z[1]) - off
        const text = zoneLabel(n)
        const w = text.length * size * 0.95 + size * 1.2
        return (
          <g key={z.zone} transform={`translate(${x} ${y})`}>
            <rect x={-w / 2} y={-size * 0.85} width={w} height={size * 1.7} rx={size * 0.85} fill="rgba(255,250,242,.92)" stroke={fxColor(n.cat)} strokeWidth={size * 0.12} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={700} fill={fxColor(n.cat)} className={m.zoneLabel}>{text}</text>
          </g>
        )
      })}
    </g>
  )
}

/** 내 두더지 표시. 둘레 물결은 자리가 바뀔 때마다 세 번만 (계속 움직이면 저사양 PC 에서 미니맵을 계속 다시 그림) */
function MoleMark({ pulseKey }: { pulseKey?: number }) {
  return (
    <>
      <circle key={pulseKey} className={m.molePulse} r={2.6} />
      <circle r={1.9} fill="#6b4a3a" stroke="#fff" strokeWidth={0.55} />
      <circle cy={0.75} r={0.62} fill="#f08e86" />
      <circle cx={-0.6} cy={-0.25} r={0.22} fill="#fff" /><circle cx={0.6} cy={-0.25} r={0.22} fill="#fff" />
    </>
  )
}

/* ---------- 크게 보기: 전체 마을 지도 팝업 ---------- */
type Filter = 'all' | 'regular' | 'shared'
/** 나와 같은 관심사: 서버가 준 isShared(r.shared)가 먼저, 없으면(목 데이터를 바로 쓰는 시안) 내 관심사와 비교 */
const sharedOf = (r: Resident, myInterests: string[]) => r.shared ?? sharedWith(r.user, myInterests)

function VillageModal({ open, onClose, field, floor, v, bySeat, regulars, myInterests, zoneNames, close, mole, viewPts, selected, onGo, onLadder }: {
  open: boolean; onClose: () => void; field: FieldData; floor: Floor; v: Village | null; bySeat: Map<number, Resident>; regulars: string[]; myInterests: string[]; zoneNames: ZoneName[]; close: Set<number>
  mole: [number, number]; viewPts: [number, number][] | null; selected?: number | null; onGo: (seat: number) => void; onLadder?: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  // 팝업이 열려 있는 동안 뒤의 탐색 화면(방향키 이동·Enter 입장)이 키를 받지 않는 것은 각 단축키가 lib/a11y.ts shortcutAllowed 로
  // aria-modal 팝업을 확인해서 처리함 (2026-11-16). 예전에는 여기서 window 캡처 단계로 키를 막았는데, 그러면 팝업 안 React 키 처리도 같이 막혀서 뺌
  const others = field.residents.filter((r) => !r.mine)
  const test: Record<Filter, (r: Resident) => boolean> = {
    all: () => true,
    regular: (r) => regulars.includes(r.user.id),
    shared: (r) => sharedOf(r, myInterests).length > 0,
  }
  const count = (f: Filter) => others.filter(test[f]).length
  const list = others.filter(test[filter]).sort((a, b) => (filter === 'shared' ? matchScore(b.user, myInterests) - matchScore(a.user, myInterests) : a.seat - b.seat))
  const pick = (e: React.MouseEvent) => {
    const el = svg.current, ctm = el?.getScreenCTM()
    if (!el || !ctm || !v) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    let best: number | null = null, bd = 2.2
    for (const h of v.holes) { const dd = Math.hypot(h.x - p.x, h.z - p.y); if (dd < bd) { bd = dd; best = h.seat } }
    if (best != null) onGo(best)
    else if (onLadder && Math.hypot(p.x - LADDER.x, p.y - LADDER.z) < 2) onLadder()
  }
  const move = (e: React.MouseEvent) => {
    const el = svg.current, ctm = el?.getScreenCTM()
    if (!el || !ctm || !v) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    let best: number | null = null, bd = 2.2
    for (const h of v.holes) { const dd = Math.hypot(h.x - p.x, h.z - p.y); if (dd < bd) { bd = dd; best = h.seat } }
    setHover(best)
    el.style.cursor = best != null || Math.hypot(p.x - LADDER.x, p.y - LADDER.z) < 2 ? 'pointer' : 'default'
  }
  const hr = hover != null ? bySeat.get(hover) : undefined
  const hp = hover != null ? v?.seats.get(hover) : undefined
  const chips: [Filter, string][] = [['all', '모두'], ['regular', '단골'], ['shared', '겹치는 관심사']]
  return (
    <Modal open={open} onClose={onClose} width={1080} labelledBy="village-title">
      <div className={m.modal}>
        <h2 id="village-title" className="display">{floorLabel(floor)} 마을 지도</h2>
        <p className={m.lead}>땅굴을 누르면 바로 그 앞으로 가요. 지금 땅굴 {field.residents.length}개</p>
        <div className={m.bigGrid}>
          <div className={m.bigMap}>
            <svg ref={svg} viewBox={viewBox} onClick={pick} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label={`${floorLabel(floor)} 마을 전체 지도`}>
              <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill={MAP_COLORS.grass} />
              {v && <FieldArt v={v} detail="big" />}
              {v && fxOn('f_zones') && <ZoneLabels v={v} names={zoneNames} size={2.2} inside />}
              {v && (
                <Holes v={v} bySeat={bySeat} regulars={regulars} scale={1.22} selected={selected} hoverSeat={hover} close={close}
                  dim={filter === 'all' ? undefined : (r) => !r.mine && !test[filter](r)}
                  labels={(r) => (r.mine ? '내 땅굴' : filter !== 'all' && test[filter](r) ? r.user.nickname : null)} />
              )}
              {viewPts && <polygon className={m.view} points={poly(viewPts)} />}
              <g transform={`translate(${mole[0]} ${mole[1]}) scale(.8)`} className={m.mole}><MoleMark /></g>
            </svg>
            {hr && hp && (
              <span className={m.bigTip} style={{ left: `${((hp.x - VB.x) / VB.w) * 100}%`, top: `${((hp.z - VB.y) / VB.h) * 100}%` }}>
                <strong>{hr.mine ? '내 땅굴' : hr.user.nickname}</strong>
                {!hr.mine && <small>{hr.seat}번 자리 · 같은 관심사 {sharedOf(hr, myInterests).length}개</small>}
              </span>
            )}
          </div>
          <div className={m.side}>
            <div className={m.filters} role="group" aria-label="강조해서 보기">
              {chips.map(([f, name]) => (
                <button key={f} className={filter === f ? m.fOn : m.f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {name}{f !== 'all' && <span>{count(f)}</span>}
                </button>
              ))}
            </div>
            <ul className={m.list} aria-label="땅굴 목록">
              {list.length ? list.map((r) => {
                const sh = sharedOf(r, myInterests)
                return (
                  <li key={r.seat} onMouseEnter={() => setHover(r.seat)} onMouseLeave={() => setHover(null)}>
                    <Avatar size={30} />
                    <span className={m.who}>
                      <strong>{r.user.nickname}{regulars.includes(r.user.id) && <b className={m.star}>★</b>}</strong>
                      <small>{r.seat}번 자리{sh.length ? ` · 같은 관심사 ${sh.length}개` : ''}</small>
                    </span>
                    <button className={`btn btn-line ${m.go}`} onClick={() => onGo(r.seat)}>이동</button>
                  </li>
                )
              }) : <li className={m.empty}>{filter === 'regular' ? '이 마을에는 단골 땅굴이 없어요' : '해당하는 땅굴이 없어요'}</li>}
            </ul>
            <dl className={m.bigLegend}>
              <div><dt><i className={m.lgMole} /></dt><dd>내 두더지</dd></div>
              <div><dt><i className={m.lgMine} /></dt><dd>내 땅굴</dd></div>
              <div><dt><i className={m.lgHole} /></dt><dd>땅굴 (링 색은 자리마다)</dd></div>
              <div><dt><i className={m.lgPad} /></dt><dd>빈 자리 (올 사람 자리)</dd></div>
              <div><dt><b className={m.star}>★</b></dt><dd>단골</dd></div>
              <div><dt><i className={m.lgLadder} /></dt><dd>사다리 (다른 캠퍼스-층)</dd></div>
              {viewPts && <div><dt><ViewIcon /></dt><dd>지금 화면에 보이는 곳</dd></div>}
              {fxOn('f_mapheart') && <div><dt><b className={m.lgHeart}>♥</b></dt><dd>나와 잘 맞는 이웃 (이 마을 위쪽 1/4)</dd></div>}
            </dl>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const ViewIcon = () => (
  <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden><path d="M3.5 9h7L13 1H1z" fill="rgba(140,197,106,.5)" stroke="#6e8f4f" strokeWidth="1.2" strokeLinejoin="round" /></svg>
)
const MapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></svg>
)
const ExpandIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
)
const FoldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
)
