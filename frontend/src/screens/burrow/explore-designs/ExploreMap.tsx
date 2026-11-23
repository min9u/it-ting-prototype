import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import RoomModeToggle from '../../../components/RoomModeToggle'
import { type Resident } from '../../../data/field'
import { useRegularOwnerIds } from '../../../api/explore'
import Minimap, { useVillage, type MinimapHandle } from '../Minimap'
import { EmptyField, ExploreOverlays, ExploreTools, HomeButton, OwnerPanel, PANEL_COVER, SignCard, capture, useExploreBase, useExploreKeys } from './common'
import { FieldArt } from './FieldArt'
import { FIELD_BOUNDS, LADDER, MAP_COLORS, cellKey, nearestInDir, route, type Dir } from './fieldGeo'
import { isRare } from './match'
import { Mole2D } from './parts'
import { getMyWorn } from '../../../data/moleItems'
import { HomeIcon } from '../../../components/Icons'
import s from '../Burrow.module.css'
import rv from '../../../components/RoomView.module.css'
import d from './designs.module.css'
import b from './map.module.css'

/*
 * 탐색 디자인 B — 마을 지도 (2D 일러스트 탑뷰). 2026-11-16, docs/explore-designs.md
 * - 층 하나(마을)를 지도처럼: 끌어서 옮기기 · 휠/버튼으로 확대·축소 · 전체 보기 · 내 두더지 보기
 * - 땅굴(구멍)을 누르면 두더지가 길을 따라 걸어가고, 도착하면 안내판. 방향키 = 그 방향 ±45° 가장 가까운 땅굴(디자인 A 와 같은 규칙)
 * - 위쪽 필터: 모두 · 단골 · 겹치는 관심사 · 접속 중 (맞는 땅굴만 진하게 + 이름표)
 * - 3D 를 안 씀 (SVG 바탕 한 장 + 땅굴 버튼). 끄는 동안만 will-change 로 레이어를 옮기고, 멈추면 다시 선명하게
 * 배치·길은 3D 들판과 같은 fieldLayout150.json (fieldGeo.ts)
 */

const BASE = 10 // 바탕 SVG 기본 배율 (px/m)
const G = { x0: FIELD_BOUNDS.x0 - 6, z0: FIELD_BOUNDS.z0 - 6, w: FIELD_BOUNDS.x1 - FIELD_BOUNDS.x0 + 12, h: FIELD_BOUNDS.z1 - FIELD_BOUNDS.z0 + 12 }
const K_MIN = 5, K_MAX = 30
// 화면에서 지도가 잘 보이는 곳: 위 필터 아래 ~ 모드 토글 위, 왼쪽 버튼·미니맵 줄 오른쪽 (가운데 맞추기·따라가기 기준)
const TOP_SAFE = 96, BOTTOM_SAFE = 140, LEFT_SAFE = 320
const START_K = 12
type Filter = 'all' | 'regular' | 'shared' | 'online'
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ExploreMap() {
  const base = useExploreBase()
  const { field, bySeat, floor } = base
  const v = useVillage(field)
  const regulars = useRegularOwnerIds() // GET /me/regular-burrows
  const worn = useMemo(() => getMyWorn(), [])
  const [panelOpen, setPanelOpen] = useState(base.params.get('panel') !== 'closed')
  const [seat, setSeat] = useState(base.startSeat)
  const [walking, setWalking] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [hover, setHover] = useState<number | null>(null)
  const scene = useRef<HTMLDivElement>(null)
  const ground = useRef<SVGSVGElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const moleEl = useRef<HTMLDivElement>(null)
  const signEl = useRef<HTMLDivElement>(null)
  const mm = useRef<MinimapHandle>(null)
  const cam = useRef({ k: 10, px: 0, py: 0 })
  const camAnim = useRef<number>(0)
  const mole = useRef({ x: 0, z: 0, facing: 1 as 1 | -1 })
  const walk = useRef<{ raf: number; seat: number } | null>(null)
  const seatRef = useRef(seat)
  seatRef.current = seat
  const cover = panelOpen ? PANEL_COVER : 0
  const focusX = panelOpen ? 0.403 : 0.5

  const holePos = useCallback((n: number): [number, number] => {
    const h = v?.seats.get(n)
    return h?.occupied ? [h.x, h.z] : [LADDER.x + 1.9, LADDER.z - 1.4]
  }, [v])

  /* ---------- 카메라 (px/m 배율 k, 들판 원점의 화면 위치 px·py) ---------- */
  const size = () => ({ W: scene.current?.clientWidth ?? 1440, H: scene.current?.clientHeight ?? 896 })
  const usable = () => { const { W, H } = size(); return { x0: LEFT_SAFE, x1: W - cover, y0: TOP_SAFE, y1: H - BOTTOM_SAFE, W, H } }
  const clampCam = () => {
    const c = cam.current, u = usable()
    c.k = Math.min(K_MAX, Math.max(K_MIN, c.k))
    if (!v) return
    // 화면(쓸 수 있는 곳) 가운데가 켜진 구역 둘레 안에 있게
    const lb = v.litBox, m = 6
    const cx = (u.x0 + u.x1) / 2, cy = (u.y0 + u.y1) / 2
    const wx = (cx - c.px) / c.k, wz = (cy - c.py) / c.k
    const nx = Math.min(lb.x1 + m, Math.max(lb.x0 - m, wx)), nz = Math.min(lb.z1 + m, Math.max(lb.z0 - m, wz))
    c.px = cx - nx * c.k; c.py = cy - nz * c.k
  }
  const applyCam = () => {
    clampCam()
    const { k, px, py } = cam.current
    if (ground.current) ground.current.style.transform = `translate(${px + G.x0 * k}px, ${py + G.z0 * k}px) scale(${k / BASE})`
    const L = layer.current
    if (L) {
      L.style.setProperty('--k', String(k)); L.style.setProperty('--px', String(px)); L.style.setProperty('--py', String(py))
      L.dataset.tier = k < 9 ? 'far' : k < 16 ? 'mid' : 'near'
    }
    const u = usable()
    // 미니맵의 보이는 곳 = 오른쪽 카드에 가리지 않는 장면 전체
    mm.current?.setView([[(0 - px) / k, (u.H - py) / k], [(u.x1 - px) / k, (u.H - py) / k], [(u.x1 - px) / k, (0 - py) / k], [(0 - px) / k, (0 - py) / k]])
    placeSign()
  }
  /** 안내판: 두더지 오른쪽 위 (왼쪽 아래 미니맵과 안 겹치게). 오른쪽 카드에 닿으면 왼쪽으로 */
  const placeSign = () => {
    const el = signEl.current
    if (!el) return
    const { k, px } = cam.current
    el.dataset.side = px + mole.current.x * k + 320 > usable().x1 ? 'left' : 'right'
  }
  /** 화면 가운데(쓸 수 있는 곳)에 world 점이 오도록 (부드럽게) */
  const centerOn = (x: number, z: number, k = cam.current.k, ms = 450) => {
    const u = usable()
    const cx = (u.x0 + u.x1) / 2, cy = (u.y0 + u.y1) / 2
    animateCam({ k, px: cx - x * k, py: cy - z * k }, ms)
  }
  const animateCam = (to: { k: number; px: number; py: number }, ms: number) => {
    cancelAnimationFrame(camAnim.current)
    const from = { ...cam.current }
    if (ms <= 0 || reduceMotion()) { Object.assign(cam.current, to); applyCam(); return }
    const t0 = performance.now()
    setLayerMoving(true)
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms), e = ease(t)
      // 배율은 로그로 보간 (확대가 고르게 보임)
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e)
      // 화면 가운데 world 점도 보간
      const u = usable(), cx = (u.x0 + u.x1) / 2, cy = (u.y0 + u.y1) / 2
      const fw = [(cx - from.px) / from.k, (cy - from.py) / from.k], tw = [(cx - to.px) / to.k, (cy - to.py) / to.k]
      const wx = fw[0] + (tw[0] - fw[0]) * e, wz = fw[1] + (tw[1] - fw[1]) * e
      Object.assign(cam.current, { k, px: cx - wx * k, py: cy - wz * k })
      applyCam()
      if (t < 1) camAnim.current = requestAnimationFrame(step)
      else setLayerMoving(false)
    }
    camAnim.current = requestAnimationFrame(step)
  }
  const fitAll = (ms = 450) => {
    if (!v) return
    const u = usable(), lb = v.litBox, pad = 4
    const k = Math.min(14, Math.max(K_MIN, Math.min((u.x1 - u.x0 - 60) / (lb.x1 - lb.x0 + pad * 2), (u.y1 - u.y0) / (lb.z1 - lb.z0 + pad * 2))))
    centerOn((lb.x0 + lb.x1) / 2, (lb.z0 + lb.z1) / 2, k, ms)
  }
  const zoomBy = (f: number, at?: { x: number; y: number }) => {
    const c = cam.current, u = usable()
    const p = at ?? { x: (u.x0 + u.x1) / 2, y: (u.y0 + u.y1) / 2 }
    const k = Math.min(K_MAX, Math.max(K_MIN, c.k * f))
    const wx = (p.x - c.px) / c.k, wz = (p.y - c.py) / c.k
    return { k, px: p.x - wx * k, py: p.y - wz * k }
  }
  // 끌거나 움직이는 동안만 레이어를 합성 레이어로 (멈추면 다시 선명하게 그림)
  const movingT = useRef(0)
  const setLayerMoving = (on: boolean) => {
    window.clearTimeout(movingT.current)
    const g = ground.current
    if (!g) return
    if (on) g.style.willChange = 'transform'
    else movingT.current = window.setTimeout(() => { g.style.willChange = 'auto' }, 160)
  }

  /* ---------- 두더지 ---------- */
  const drawMole = () => {
    const el = moleEl.current, p = mole.current
    if (el) { el.style.setProperty('--x', String(p.x)); el.style.setProperty('--z', String(p.z)); el.dataset.facing = String(p.facing) }
    mm.current?.setMole(p.x, p.z)
    placeSign()
  }
  /** 걸어가는 동안 두더지가 화면 가장자리에 가까우면 카메라가 따라감 */
  const follow = () => {
    const c = cam.current, u = usable(), p = mole.current
    const sx = c.px + p.x * c.k, sy = c.py + p.z * c.k
    const m = 150
    let dx = 0, dy = 0
    if (sx < u.x0 + m) dx = u.x0 + m - sx; else if (sx > u.x1 - m) dx = u.x1 - m - sx
    if (sy < u.y0 + m * 0.6) dy = u.y0 + m * 0.6 - sy; else if (sy > u.y1 - m * 0.6) dy = u.y1 - m * 0.6 - sy
    if (dx || dy) { c.px += dx * 0.18; c.py += dy * 0.18; applyCam() }
  }

  const walkTo = useCallback((target: number) => {
    if (!v || base.leaving || !bySeat.has(target)) return
    const cur = mole.current
    const startCell = cellKey(Math.round(cur.x / 2), Math.round(cur.z / 2))
    const fromCell = v.adj.has(startCell) ? startCell : v.holeCell.get(seatRef.current) ?? startCell
    if (target === seatRef.current && !walk.current) return
    const pts = route(v, fromCell, target)
    const path: [number, number][] = [[cur.x, cur.z], ...pts]
    const cum = [0]
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    const len = cum[cum.length - 1]
    if (walk.current) cancelAnimationFrame(walk.current.raf)
    setSeat(target); setWalking(true); setHover(null)
    const dur = reduceMotion() ? 0 : Math.min(2400, Math.max(500, (len / 12) * 1000))
    const t0 = performance.now()
    const at = (dist: number): [number, number] => {
      let i = 1
      while (i < cum.length - 1 && cum[i] < dist) i++
      const seg = cum[i] - cum[i - 1] || 1, f = Math.min(1, Math.max(0, (dist - cum[i - 1]) / seg))
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]
    }
    const step = () => {
      const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1
      // 걷기는 처음·끝만 살짝 느리게
      const e = t < 0.15 ? (t / 0.15) ** 2 * 0.075 : t > 0.85 ? 1 - ((1 - t) / 0.15) ** 2 * 0.075 : 0.075 + (t - 0.15) / 0.7 * 0.85
      const [x, z] = at(len * e)
      if (Math.abs(x - mole.current.x) > 0.01) mole.current.facing = x < mole.current.x ? -1 : 1
      mole.current.x = x; mole.current.z = z
      drawMole(); follow()
      if (t < 1) { walk.current = { raf: requestAnimationFrame(step), seat: target }; return }
      walk.current = null
      setWalking(false)
      base.rememberSeat(target)
    }
    walk.current = { raf: requestAnimationFrame(step), seat: target }
  }, [v, base, bySeat]) // eslint-disable-line react-hooks/exhaustive-deps

  // 처음: 서 있는 자리에 두더지, 켜진 구역 전체가 보이게 (자리가 화면 밖이면 그 자리 쪽으로)
  useLayoutEffect(() => {
    if (!v) return
    const [x, z] = holePos(seat)
    Object.assign(mole.current, { x, z })
    // 내 두더지 둘레부터 (이름표가 보이는 배율). 마을 전체는 '전체' 버튼 · 0 키 · 미니맵
    centerOn(x, z, START_K, 0)
    drawMole()
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (walk.current) cancelAnimationFrame(walk.current.raf); cancelAnimationFrame(camAnim.current) }, [])
  // 오른쪽 카드를 접고 펴면 쓸 수 있는 폭이 바뀜
  useEffect(() => { applyCam() }, [cover]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = scene.current
    if (!el) return
    const ro = new ResizeObserver(() => applyCam())
    ro.observe(el)
    return () => ro.disconnect()
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 끌기 · 휠 ---------- */
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('[data-ui]')) return
    cancelAnimationFrame(camAnim.current)
    drag.current = { x: e.clientX, y: e.clientY, px: cam.current.px, py: cam.current.py, moved: false }
    suppressClick.current = false
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g) return
    const dx = e.clientX - g.x, dy = e.clientY - g.y
    if (!g.moved && Math.hypot(dx, dy) < 5) return
    if (!g.moved) { g.moved = true; setLayerMoving(true); capture(scene.current, e.pointerId, true); setHover(null) }
    cam.current.px = g.px + dx; cam.current.py = g.py + dy
    applyCam()
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const g = drag.current
    drag.current = null
    if (g?.moved) { suppressClick.current = true; setLayerMoving(false); capture(scene.current, e.pointerId, false) }
  }
  useEffect(() => {
    const el = scene.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      cancelAnimationFrame(camAnim.current)
      Object.assign(cam.current, zoomBy(Math.exp(-e.deltaY * 0.0016), { x: e.clientX - r.left, y: e.clientY - r.top }))
      setLayerMoving(true); applyCam(); setLayerMoving(false)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }) // 매 렌더 최신 함수

  /* ---------- 키 ---------- */
  const here = bySeat.get(seat)
  const enter = () => { if (!walking) base.enter(here) }
  useExploreKeys(!base.leaving, {
    dir: (dir: Dir) => {
      if (walking || !v) return
      const [x, z] = holePos(seat)
      const n = nearestInDir(v.holes, { x, z, seat }, dir)
      if (n != null) walkTo(n)
    },
    enter,
    key: (e) => {
      if (e.key === '+' || e.key === '=') { animateCam(zoomBy(1.35), 220); return true }
      if (e.key === '-' || e.key === '_') { animateCam(zoomBy(1 / 1.35), 220); return true }
      if (e.key === '0') { fitAll(); return true }
      return false
    },
  })

  const goHome = () => { if (field.mySeat) { walkTo(field.mySeat) } }
  const goSeat = (n: number) => { if (suppressClick.current) { suppressClick.current = false; return } walkTo(n) }

  /* ---------- 필터 ---------- */
  const match: Record<Filter, (r: Resident) => boolean> = {
    all: () => true,
    regular: (r) => regulars.includes(r.user.id),
    shared: (r) => base.shared(r).length > 0,
    online: (r) => !!r.user.online,
  }
  const others = field.residents.filter((r) => !r.mine)
  const count = (f: Filter) => others.filter(match[f]).length
  const chips: [Filter, string][] = [['all', '모두'], ['regular', '단골'], ['shared', '겹치는 관심사'], ['online', '접속 중']]

  const ladderStyle = { '--x': LADDER.x, '--z': LADDER.z } as CSSProperties
  return (
    <main className={s.page}>
      <div ref={scene} className={`${rv.scene} ${b.scene}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        role="application" aria-label={`${floor.campus}-${floor.floor}층 마을 지도. 땅굴을 누르면 두더지가 길을 따라 걸어가요`}>
        {v && (
          <svg ref={ground} className={b.ground} viewBox={`${G.x0} ${G.z0} ${G.w} ${G.h}`} width={G.w * BASE} height={G.h * BASE} aria-hidden>
            <rect x={G.x0} y={G.z0} width={G.w} height={G.h} fill={MAP_COLORS.grass} />
            <FieldArt v={v} detail="rich" />
          </svg>
        )}
        <div ref={layer} className={b.layer} data-tier="mid" data-filter={filter}>
          {v && v.holes.map((h) => {
            const r = bySeat.get(h.seat)
            if (!r) return null
            const sh = base.shared(r)
            const on = !r.mine && !!r.user.online
            const reg = !r.mine && regulars.includes(r.user.id)
            const hit = filter === 'all' || r.mine || match[filter](r)
            return (
              <button key={h.seat} className={b.hole} data-mine={r.mine ? '' : undefined} data-hit={filter !== 'all' && hit && !r.mine ? '' : undefined}
                data-dim={!hit ? '' : undefined} data-here={h.seat === seat ? '' : undefined} data-hover={hover === h.seat ? '' : undefined}
                style={{ '--x': h.x, '--z': h.z, '--ring': h.ring } as CSSProperties}
                onClick={() => goSeat(h.seat)} onPointerEnter={() => setHover(h.seat)} onPointerLeave={() => setHover((c) => (c === h.seat ? null : c))}
                aria-label={r.mine ? `내 땅굴 (${h.seat}번 자리)` : `${r.user.nickname}님의 땅굴, 같은 관심사 ${sh.length}개${on ? ', 접속 중' : ''}`}>
                <span className={b.ring} aria-hidden />
                {r.mine && <span className={b.house} aria-hidden><HomeIcon size={12} /></span>}
                {on && <i className={b.on} aria-hidden />}
                {reg && <i className={b.star} aria-hidden>★</i>}
                {!r.mine && sh.length > 0 && <i className={b.badge} data-one={sh.length === 1 ? '' : undefined} aria-hidden title={`같은 관심사 ${sh.length}개`}>{sh.length}</i>}
                <span className={b.name}>
                  {r.mine ? '내 땅굴' : r.user.nickname}
                  {!r.mine && sh[0] && isRare(sh[0]) && <em className={b.rare}>✦ {sh[0]}</em>}
                </span>
              </button>
            )
          })}
          {v && (
            <button className={b.ladder} style={ladderStyle} onClick={() => !suppressClick.current && base.setModal('floor')} aria-label="사다리: 다른 캠퍼스-층으로">
              <span className={b.ladderIcon} aria-hidden />
              <span className={b.name}>사다리 · 다른 층</span>
            </button>
          )}
          <div ref={moleEl} className={b.mole} data-walking={walking ? '' : undefined} aria-hidden>
            <Mole2D worn={worn} size={44} className={b.moleSvg} />
          </div>
          {!walking && here && v && (
            <div ref={(el) => { signEl.current = el; placeSign() }} className={b.sign} data-ui style={{ '--x': holePos(seat)[0], '--z': holePos(seat)[1] } as CSSProperties}>
              <SignCard base={base} r={here} onEnter={enter} />
            </div>
          )}
        </div>

        <div data-ui><ExploreTools base={base} /></div>
        <div className={b.filters} data-ui role="group" aria-label="강조해서 보기" style={{ left: `${focusX * 100}%` }}>
          {chips.map(([f, name]) => (
            <button key={f} className={filter === f ? b.fOn : b.f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {name}{f !== 'all' && <span>{count(f)}</span>}
            </button>
          ))}
        </div>
        <div className={b.zoom} data-ui style={{ right: cover + 22 }}>
          <button onClick={() => animateCam(zoomBy(1.35), 220)} aria-label="확대">＋</button>
          <button onClick={() => animateCam(zoomBy(1 / 1.35), 220)} aria-label="축소">－</button>
          <button onClick={() => fitAll()} aria-label="켜진 구역 전체 보기" title="전체 보기 (0)" className={b.zoomWide}>전체</button>
          <button onClick={() => { const p = mole.current; centerOn(p.x, p.z, Math.max(cam.current.k, 14)) }} aria-label="내 두더지 보기" title="내 두더지 보기" className={b.zoomWide}>나</button>
        </div>

        <div data-ui><EmptyField base={base} left={focusX} top="16%" /></div>
        <div data-ui>
          <Minimap field={field} floor={floor} seat={seat} view={{ kind: 'external' }} handleRef={mm} onGo={walkTo} onLadder={() => base.setModal('floor')}
            selected={seat} onExpand={() => fitAll()} />
        </div>
        <span data-ui><HomeButton base={base} atHome={seat === field.mySeat} onHome={goHome} /></span>
        <p className={d.keyHint} style={{ left: `${focusX * 100}%` }}>
          <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> 옆 땅굴로 · 땅굴을 누르면 길 따라 이동 · 끌어서 지도 옮기기 · <kbd>Enter</kbd> 들어가기
        </p>
        <span data-ui><RoomModeToggle style={{ left: `${focusX * 100}%` }} /></span>
      </div>

      <OwnerPanel base={base} r={here} open={panelOpen} setOpen={setPanelOpen} />
      <ExploreOverlays base={base} />
    </main>
  )
}
