import * as THREE from 'three'
import { fxOn, getLantern, subscribeFx } from '../../lib/fxLab'
import { catName, catOfSub, fxColor, subName, zoneLabel, zoneNamesOf, type HoleFx, type ZoneName } from '../../data/interestFx'
import { createOverlay, type OverlayFrame } from './overlay'
import { badge, bubble, glow, glyph, lighten, sticker, stickerSize, tag } from './icons'

/*
 * 탐색 들판 관심사 이펙트 (docs/interest-effects.md). holeField 는 만들기·정리만 부름 (배경 굽기·이동 경로 코드는 건드리지 않음)
 *
 * f_bubble 대표 관심사 말풍선: 구멍 위 대표 관심사(맨 앞) 아이콘 말풍선. 서 있는 구멍은 안내판이 있어서 숨김
 * f_expand 가까이 가면 펼쳐짐: 두더지 옆 구멍(약 6.6m 안)은 관심사 3개 알약으로 (겹치는 것 ♥ → 드문 것 ✦ → 고른 순서) + "+N".
 *   2차: 첫 관심사는 이름까지 ("♥ 캠핑") → 아이콘만으로는 무슨 관심사인지 몰랐음
 * f_shared 겹치는 관심사 고리: 겹치는 관심사가 있으면 구멍 둘레에 고리가 퍼짐 (겹치는 수만큼 최대 3겹) + ♥N 배지
 * f_rare 드문 관심사 반짝: 250명 미만 관심사가 있으면 금빛 별, 100명 미만이면 무지개 별 (기준 data/rarity.ts)
 * f_online 접속 중이면 활발: 말풍선이 통통 튀고 초록 점, 연기가 두 배
 * f_smoke 관심사 연기: 대표 관심사 색 연기. 가까운 몇 구멍만 피어오르고 나머지는 멈춘 연기
 * f_lantern 관심사 등불 (2차): 고른 관심사(lib/fxLab getLantern)를 가진 땅굴만 등불·이름표, 나머지 말풍선은 흐리게.
 *   화면 밖이면 거리와 상관없이 가까운 4곳을 가장자리 이정표로
 * f_radar 잘 맞는 이웃 신호 (2차): 이 들판에서 잘 맞는 정도(겹치는 관심사마다 1 + 1000/인원)가 가장 큰 이웃 쪽 가장자리에서 4초마다 신호 + 이름
 * f_zones 동네 이름표 (2차): 두더지가 다른 구역(25자리)에 들어서면 위에 "음악 동네 · 25집 중 9집" 띠 (DOM). 미니맵에도 이름(Minimap.tsx)
 * 움직이는 구멍 수는 단계별 상한 (overlay.ts: GPU 12 · 가속 꺼짐 5 · 아주 느린 PC 0)
 */

export interface FieldFxOptions {
  container: HTMLElement
  after: Element
  camera: THREE.PerspectiveCamera
  holes: Map<number, { seat: number; x: number; z: number }>
  seats: HoleFx[]
  /** 두더지가 서 있는(또는 가는) 자리와 이동 중인지 */
  here: () => { seat: number; moving: boolean }
  /**
   * 카메라 거리 (m, 줌 단계 v3.10: near 12 · mid 24 · far 46). 멀리 볼수록 한 화면 구멍이 많아서(near 2.5 → far 약 42개)
   * 말풍선을 가까운 순으로 줄임 (BUBBLE_CAP). 없으면 near
   */
  dist?: () => number
}
/** 줌 단계별 말풍선 수 상한 (가까운 순. 등불을 켠 땅굴·이정표는 따로). mid 는 한 화면 구멍 약 12개라 거의 다, far 는 약 42개라 8개 */
const BUBBLE_CAP = { mid: 14, far: 8 }
export interface FieldFx { dispose(): void }

const EXPAND_R = 6.6, EDGE_R = 10.5, ICON_GAP = 27
const SHARE = '#FF8A5B', GOLD = '#F5C452', LAMP = '#FFC24A'
const RAINBOW = Array.from({ length: 12 }, (_, i) => `#${new THREE.Color().setHSL(i / 12, .85, .66).getHexString()}`)
const FONT_NAME = "700 11.5px Pretendard, 'Pretendard Variable', system-ui, sans-serif"
/** 잘 맞는 이웃 신호 간격 (초) */
const PING_EVERY = 4
const now = () => performance.now() / 1000

interface Seat {
  info: HoleFx
  x: number; z: number
  color: string
  expand: number
  smokeAcc: number
  phase: number
  /** 펼친 알약 첫 관심사 이름 폭 (px, 한 번만 잼) */
  nameW: number
  // 이번 프레임
  sx: number; sy: number; bx: number; by: number; dist: number; vis: boolean; active: boolean
  /** 화면 밖이라 가장자리 이정표로 보임 */
  pin: boolean
  /** 등불: 고른 관심사를 가짐 / 흐리게 */
  lit: boolean; dim: boolean
  /** 이번 프레임에 그린 자리 (신호를 이정표 위에 겹쳐 그리려고) */
  px: number; py: number
}
interface Puff { s: Seat; x: number; y: number; z: number; age: number; life: number; size: number; drift: number; color: string }

export function createFieldFx(o: FieldFxOptions): FieldFx {
  const { camera } = o
  const seats: Seat[] = []
  for (const info of o.seats) {
    const h = o.holes.get(info.seat)
    if (!h) continue
    seats.push({
      info, x: h.x, z: h.z, color: fxColor(info.cat), expand: 0, smokeAcc: Math.random(), phase: Math.random() * 6, nameW: -1,
      sx: 0, sy: 0, bx: 0, by: 0, dist: 0, vis: false, active: false, pin: false, lit: false, dim: false, px: 0, py: 0,
    })
  }
  // 잘 맞는 이웃: 들판 전체에서 하나 (내 땅굴 빼고, 점수 0 이면 없음)
  const best = seats.filter((st) => !st.info.mine && st.info.score > 0).sort((a, b) => b.info.score - a.info.score)[0] ?? null
  // 동네 이름표: 구역마다 (data/interestFx zoneNamesOf)
  const zones: ZoneName[] = zoneNamesOf(o.seats.map((x) => ({ seat: x.seat, user: { interests: x.subs } })))
  const zoneOf = (seat: number) => zones.find((z) => z.zone === Math.ceil(seat / 25)) ?? null

  const puffs: Puff[] = []
  const v = new THREE.Vector3()
  let W = 1, H = 1
  const P = { x: 0, y: 0, ok: false }
  const proj = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera)
    P.x = (v.x * .5 + .5) * W; P.y = (-v.y * .5 + .5) * H; P.ok = v.z < 1 && v.z > -1
    return P
  }
  let still = false
  /** 이번 프레임은 멈춘 모습 (still 단계 또는 가속 꺼짐에서 쉬는 중, overlay calm) */
  let quiet = false

  /** 화면 안 안전한 곳 (정보 패널에 가린 오른쪽·아래 조작 줄을 뺌). 카메라 view offset 으로 장면 가운데(focusX)를 알아냄 */
  const safe = { x0: 0, x1: 0, y0: 0, y1: 0, cx: 0, cy: 0 }
  const measureSafe = () => {
    const view = (camera as THREE.PerspectiveCamera).view
    const focus = view?.enabled ? (W / 2 - view.offsetX) / W : .5
    // 장면이 왼쪽으로 치우쳐 있으면(focusX < 0.5) 오른쪽 정보 패널(오른쪽 32 + 폭 340)이 열려 있음 (ExploreBurrow, 미니맵 coverRight 와 같은 값)
    safe.x0 = 30; safe.x1 = (focus < .49 ? W - 372 : W) - 30
    safe.y0 = 70; safe.y1 = H - 150
    safe.cx = focus * W; safe.cy = H * .5
  }
  /** 화면 가운데에서 (x, y) 쪽으로 가다 안전한 곳 가장자리에 닿는 점 */
  const pinTo = (x: number, y: number) => {
    const dx = x - safe.cx, dy = y - safe.cy
    let k = 1
    if (dx > 0) k = Math.min(k, (safe.x1 - safe.cx) / dx); else if (dx < 0) k = Math.min(k, (safe.x0 - safe.cx) / dx)
    if (dy > 0) k = Math.min(k, (safe.y1 - safe.cy) / dy); else if (dy < 0) k = Math.min(k, (safe.y0 - safe.cy) / dy)
    return { x: safe.cx + dx * k, y: safe.cy + dy * k, ang: Math.atan2(dy, dx) }
  }
  /**
   * 왼쪽 위 버튼 줄·미니맵 (data-fx-avoid) 자리 (2차: 이정표가 그 밑에 숨었음).
   * 그리는 중에 getBoundingClientRect 를 부르면 점프 직후처럼 화면이 막 바뀐 때 강제 레이아웃이 생겨서(가속 꺼짐 점프 가장 긴 간격이 늘었음),
   * 크기가 바뀔 때(ResizeObserver, 레이아웃이 끝난 뒤 불림)만 재고, 새로 생긴 요소는 1초마다 찾기만 함 (querySelectorAll 은 레이아웃을 안 함)
   */
  const avoid: { x0: number; y0: number; x1: number; y1: number }[] = []
  const avoidEls = new Set<HTMLElement>()
  const remeasureAvoid = () => {
    avoid.length = 0
    const cr = o.container.getBoundingClientRect()
    for (const el of avoidEls) {
      if (!el.isConnected) { avoidEls.delete(el); continue }
      const r = el.getBoundingClientRect()
      if (r.width && r.height) avoid.push({ x0: r.left - cr.left - 6, y0: r.top - cr.top - 6, x1: r.right - cr.left + 6, y1: r.bottom - cr.top + 6 })
    }
  }
  const avoidRo = new ResizeObserver(() => { remeasureAvoid(); overlay?.invalidate() })
  avoidRo.observe(o.container)
  const findAvoid = () => {
    ;(o.container.closest('main') ?? o.container.parentElement)?.querySelectorAll<HTMLElement>('[data-fx-avoid]').forEach((el) => {
      if (!avoidEls.has(el)) { avoidEls.add(el); avoidRo.observe(el) }
    })
  }
  findAvoid()
  const avoidPoll = window.setInterval(findAvoid, 1000)
  const measureAvoid = () => { /* ResizeObserver 가 채움 */ }
  /** 상자 (x0..x1, y0..y1) 가 비켜야 할 자리와 겹치면 그 오른쪽으로 옮긴 가운데 x */
  const dodge = (x: number, half: number, y0: number, y1: number) => {
    for (let k = 0; k < 3; k++) {
      const hit = avoid.find((a) => x - half < a.x1 && x + half > a.x0 && y0 < a.y1 && y1 > a.y0)
      if (!hit) break
      x = hit.x1 + half + 4
    }
    return x
  }
  const inSafe = (x: number, y: number) => x >= safe.x0 && x <= safe.x1 && y >= safe.y0 && y <= safe.y1 && !avoid.some((a) => x > a.x0 && x < a.x1 && y > a.y0 - 20 && y < a.y1 + 40)
  /** 이정표끼리 겹치면 가장자리를 따라 비켜 놓음 (같은 방향 이웃이 둘이면 겹쳐 보였음, 2차) */
  const pinTaken: { x: number; y: number; w: number }[] = []
  /** 이정표 하나의 세로 칸 (등불을 켜면 위에 등이 달려서 더 김) */
  let pinGap = 62
  const unpile = (x: number, y: number, half: number) => {
    for (let k = 0; k < 6; k++) {
      const hit = pinTaken.find((p) => Math.abs(p.x - x) < p.w + half + 6 && Math.abs(p.y - y) < pinGap - 4)
      if (!hit) break
      // 위·아래 가장자리면 옆으로, 왼쪽·오른쪽 가장자리면 아래로
      const onSide = x <= safe.x0 + half + 2 || x >= safe.x1 - half - 2
      if (onSide) y = Math.min(safe.y1, hit.y + pinGap); else x = Math.min(safe.x1 - half, Math.max(safe.x0 + half, hit.x + (x >= hit.x ? 1 : -1) * (hit.w + half + 8)))
    }
    pinTaken.push({ x, y, w: half })
    return { x, y }
  }

  /* ---------- 동네 이름표 (DOM 띠) ---------- */
  const banner = document.createElement('div')
  banner.setAttribute('role', 'status')
  Object.assign(banner.style, {
    position: 'absolute', top: '58px', left: '50%', transform: 'translate(-50%, -6px)', zIndex: '4', pointerEvents: 'none',
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 6px', borderRadius: '999px',
    background: 'rgba(62,42,31,.86)', color: '#fff8ee', font: "400 15px/1 'Do Hyeon', Pretendard, sans-serif",
    boxShadow: '0 6px 16px rgba(60,35,20,.25)', opacity: '0', transition: 'opacity .35s, transform .35s', whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>)
  o.container.append(banner)
  let bannerZone = -1, bannerTimer = 0, bannerOn = false
  const showBanner = (z: ZoneName) => {
    banner.replaceChildren()
    const b = badge(z.cat, 22, fxColor(z.cat), Math.min(window.devicePixelRatio || 1, 2))
    const ic = document.createElement('canvas')
    ic.width = b.width; ic.height = b.height
    Object.assign(ic.style, { width: '26px', height: '26px' })
    ic.getContext('2d')!.drawImage(b, 0, 0)
    const small = document.createElement('small')
    Object.assign(small.style, { font: '600 12px/1 Pretendard, system-ui, sans-serif', color: '#f3dcc8' })
    small.textContent = `${z.total}집 중 ${z.n}집`
    small.title = `이 동네 ${z.total}집 중 ${z.n}집이 ${catName(z.cat)} 관심사를 가졌어요`
    banner.append(ic, document.createTextNode(zoneLabel(z)), small)
    banner.style.left = `${safe.cx || W / 2}px`
    banner.style.opacity = '1'; banner.style.transform = 'translate(-50%, 0)'
    bannerOn = true
    clearTimeout(bannerTimer)
    bannerTimer = window.setTimeout(() => { banner.style.opacity = '0'; banner.style.transform = 'translate(-50%, -6px)'; bannerOn = false; overlay.refresh() }, 3400)
    overlay.invalidate()
  }
  const checkZone = (seat: number, moving: boolean) => {
    if (!fxOn('f_zones') || moving) return
    const z = zoneOf(seat)
    const k = z ? z.zone : 0
    if (k === bannerZone) return
    bannerZone = k
    if (z) showBanner(z)
  }

  const draw = ({ ctx, W: w, H: h, dt, t, calm }: OverlayFrame) => {
    W = w; H = h
    quiet = still || calm
    measureSafe()
    measureAvoid()
    measureNames()
    // 동네 이름표 띠가 떠 있는 동안 위쪽 이정표는 띠 아래로
    if (bannerOn) safe.y0 = 112
    const s = overlay.mode.dpr
    const here = o.here()
    const cur = o.holes.get(here.seat)
    const lan = fxOn('f_lantern') ? getLantern() : null
    pinGap = lan ? 112 : 62
    const vis: Seat[] = [], shown: Seat[] = []
    for (const st of seats) {
      const g = proj(st.x, .08, st.z)
      st.sx = g.x; st.sy = g.y
      st.vis = g.ok && g.x > -120 && g.x < W + 120 && g.y > -60 && g.y < H + 160
      const b = proj(st.x, .95, st.z)
      st.bx = b.x; st.by = b.y
      const front = b.ok
      if (!front && cur) {
        // 카메라 뒤(남쪽 아래)라 투영이 뒤집힘 → 서 있는 구멍에서 그쪽으로 3m 간 점의 화면 방향으로 멀리 (가장자리 이정표 방향만 맞으면 됨)
        const dx = st.x - cur.x, dz = st.z - cur.z, l = Math.hypot(dx, dz) || 1
        const q = proj(cur.x + dx / l * 3, .95, cur.z + dz / l * 3), qx = q.x, qy = q.y
        const c = proj(cur.x, .95, cur.z)
        st.bx = c.x + (qx - c.x) * 60; st.by = c.y + (qy - c.y) * 60
      }
      st.dist = cur ? Math.hypot(st.x - cur.x, st.z - cur.z) : 99
      st.active = false
      st.lit = !!lan && !st.info.mine && st.info.subs.includes(lan)
      st.dim = !!lan && !st.lit
      const standing = st.info.seat === here.seat && !here.moving
      // 화면 밖 옆 구멍(약 10m 안)은 가장자리 이정표로. 등불을 켰으면 등불 땅굴만 (거리 상관없이, 아래에서 가까운 4곳)
      const off = (front || !!cur) && !inSafe(st.bx, st.by) && st.dist > .1
      st.pin = !standing && off && (lan ? false : fxOn('f_edge') && st.dist < EDGE_R)
      if (st.vis) vis.push(st)
    }
    if (lan) seats.filter((st) => st.lit && st.info.seat !== here.seat && !inSafe(st.bx, st.by)).sort((a, b) => a.dist - b.dist).slice(0, 4).forEach((st) => { st.pin = true })
    for (const st of seats) {
      const standing = st.info.seat === here.seat && !here.moving
      if (!standing && (st.pin || (st.vis && inSafe(st.bx, st.by + 20)))) shown.push(st)
    }
    // 멀리 볼 때(줌 mid·far)는 말풍선을 두더지에서 가까운 순으로 상한까지만 (등불 땅굴·이정표·잘 맞는 이웃은 늘 보임)
    const D = o.dist?.() ?? 12
    const cap = D > 34 ? BUBBLE_CAP.far : D > 17 ? BUBBLE_CAP.mid : Infinity
    if (shown.length > cap) {
      const keep = new Set(shown.filter((st) => st.pin || st.lit || st === best))
      for (const st of [...shown].filter((x) => !keep.has(x)).sort((a, b) => a.dist - b.dist).slice(0, Math.max(0, cap - keep.size))) keep.add(st)
      for (let i = shown.length - 1; i >= 0; i--) if (!keep.has(shown[i])) shown.splice(i, 1)
    }
    // 움직이는 구멍: 두더지에 가까운 순 N개 (화면 안 + 이정표)
    if (!still) [...shown].sort((a, b) => a.dist - b.dist).slice(0, overlay.mode.active).forEach((st) => { st.active = true })
    // 1) 바닥: 등불 웅덩이 · 겹치는 관심사 고리
    if (lan) for (const st of vis) if (st.lit && st.info.seat !== here.seat) lampPool(ctx, st, t)
    // 고리는 "잘 맞는" 쪽만 (data/interestFx closeSeatsOf, 2차). ♥N 배지는 하나라도 겹치면 그대로
    if (fxOn('f_shared')) for (const st of vis) if (st.info.close && !st.info.mine && !st.dim && st.info.seat !== here.seat) ring(ctx, st, t)
    // 2) 연기
    if (fxOn('f_smoke')) smoke(ctx, vis, dt, t)
    else puffs.length = 0
    // 3) 말풍선·펼친 알약 (먼 것 먼저 → 가까운 것이 위, 이정표는 맨 위)
    shown.sort((a, b) => (a.pin ? 1 : 0) - (b.pin ? 1 : 0) || a.by - b.by)
    pinTaken.length = 0
    for (const st of shown) {
      const near = fxOn('f_expand') && st.dist > .1 && st.dist < EXPAND_R && !st.dim
      st.expand += ((near ? 1 : 0) - st.expand) * Math.min(1, still ? 1 : dt * 7)
      const lively = fxOn('f_online') && st.info.online && !st.dim
      const bob = lively && st.active && !quiet ? Math.abs(Math.sin(t * 3.2 + st.phase)) * -5 : 0
      let x = st.bx, y = st.by + bob
      ctx.globalAlpha = st.dim ? .32 : 1
      if (st.pin) {
        // 이정표: 알약·말풍선 높이만큼 안쪽으로 들인 자리 + 바깥쪽 화살표 + 이름
        const pt = pinTo(st.bx, st.by)
        const half = pillHalf(st)
        x = Math.min(safe.x1 - half, Math.max(safe.x0 + half, pt.x))
        y = Math.min(safe.y1, Math.max(safe.y0 + 46, pt.y));
        ({ x, y } = unpile(x, y, half))
        x = dodge(x, half + 14, y - 62, y + 22)
        y += bob
        signpost(ctx, st, x, y, pt.ang)
      }
      st.px = x; st.py = y
      if (st.lit) lantern(ctx, st, x, y, t, s, lan!)
      const pill = st.expand > .04
      if (pill) drawPill(ctx, st, x, y, s)
      else if (fxOn('f_bubble') || st.pin || st.lit) drawBubble(ctx, st, x, y, s)
      else { ctx.globalAlpha = 1; continue }
      if (lively) {
        const dx = pill ? pillHalf(st) - 4 : 11, dy = pill ? -38 : -32
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#5FBF3A'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.4, 0, Math.PI * 2); ctx.fill()
      }
      if (fxOn('f_shared') && st.info.shared && !st.info.mine && !st.dim) heartBadge(ctx, st, x, y, s)
      if (fxOn('f_rare') && st.info.rarity && !st.dim) sparkle(ctx, st, x, y, t, s)
      ctx.globalAlpha = 1
    }
    ctx.globalAlpha = 1
    // 4) 잘 맞는 이웃 신호
    if (fxOn('f_radar') && best && !lan && best.info.seat !== here.seat) radar(ctx, best, shown.includes(best), t, s)
    checkZone(here.seat, here.moving)
  }

  /** 이정표: 바깥쪽을 가리키는 작은 화살표 + 이름표 (말풍선 아래) */
  const signpost = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, ang: number) => {
    const cy = y - 24
    const r = Math.max(pillHalf(st), 17) + 12
    // 화살표: 알약 둘레에서 이웃 쪽으로
    const ax = x + Math.cos(ang) * r, ay = cy + Math.sin(ang) * 20
    ctx.save()
    ctx.translate(ax, ay); ctx.rotate(ang)
    ctx.fillStyle = 'rgba(62,42,31,.82)'
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -7); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill()
    ctx.restore()
    // 이름
    const name = st.info.name
    if (!name) return
    ctx.font = "700 11px Pretendard, system-ui, sans-serif"
    const tw = ctx.measureText(name).width
    ctx.fillStyle = 'rgba(62,42,31,.82)'
    ctx.beginPath(); ctx.roundRect(x - tw / 2 - 7, y + 1, tw + 14, 18, 9); ctx.fill()
    ctx.fillStyle = '#fbf4ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(name, x, y + 10.5)
  }

  /** 펼친 알약의 첫 관심사 이름 ("♥ 캠핑" / "✦ 다도") */
  const firstLabel = (st: Seat) => {
    const id = st.info.icons[0]
    if (!id) return ''
    const mark = st.info.sharedIds.includes(id) && fxOn('f_shared') ? '♥ ' : id === st.info.rareId && fxOn('f_rare') ? '✦ ' : ''
    return `${mark}${subName(id)}`
  }
  /** 이름 폭은 처음 한 번 (이 모듈이 만든 캔버스로 잼). 켜고 끄기에 따라 ♥·✦ 표시가 바뀌면 다시 */
  const meter = document.createElement('canvas').getContext('2d')!
  let nameKey = ''
  const measureNames = () => {
    const k = `${fxOn('f_shared')}|${fxOn('f_rare')}`
    if (k === nameKey) return
    nameKey = k
    meter.font = FONT_NAME
    for (const st of seats) st.nameW = Math.ceil(meter.measureText(firstLabel(st)).width)
  }
  const measureName = (_ctx: CanvasRenderingContext2D, st: Seat) => { measureNames(); return st.nameW }
  /** 펼친 알약 반폭 (아이콘 개수 + 첫 이름에 따라) */
  const pillHalf = (st: Seat) => {
    const n = st.info.icons.length + (st.info.more ? .8 : 0)
    const nameW = st.nameW > 0 ? st.nameW + 6 : 46
    const full = (n * ICON_GAP + 10 + nameW) / 2
    return 19 + (full - 19) * st.expand
  }
  const drawBubble = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    const b = bubble(st.info.cat, 34, st.color, s)
    const w = b.cv.width / s, h = b.cv.height / s
    ctx.drawImage(b.cv, x - w / 2, y - b.tip / s, w, h)
  }
  const drawPill = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    const k = st.expand
    measureName(ctx, st)
    const half = pillHalf(st), hh = 18
    const cy = y - 24
    const a0 = ctx.globalAlpha
    ctx.save()
    ctx.shadowColor = 'rgba(60,35,20,.28)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5
    ctx.fillStyle = '#fbf8f4'
    ctx.beginPath(); ctx.roundRect(x - half, cy - hh, half * 2, hh * 2, hh); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x - 5, cy + hh - 1); ctx.lineTo(x, cy + hh + 7); ctx.lineTo(x + 5, cy + hh - 1); ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.lineWidth = 2; ctx.strokeStyle = st.color
    ctx.beginPath(); ctx.roundRect(x - half + 1, cy - hh + 1, half * 2 - 2, hh * 2 - 2, hh - 1); ctx.stroke()
    // 내용: [아이콘 이름] [아이콘] [아이콘] [+N] 를 왼쪽부터. 펼치는 동안 가운데에서 나타남
    const icons = st.info.icons
    ctx.globalAlpha = a0 * Math.min(1, k * 1.4)
    let cx = x - half + 6
    const step = (w: number) => { const c = cx + w / 2; cx += w; return x + (c - x) * k }
    for (let i = 0; i < icons.length; i++) {
      const id = icons[i], cat = catOfSub(id) ?? st.info.cat
      const ix = step(ICON_GAP)
      const b = badge(cat, 23, fxColor(cat), s)
      const bw = b.width / s
      ctx.drawImage(b, ix - bw / 2, cy - bw / 2, bw, bw)
      // 표시: 겹치는 것 ♥ · 드문 것 ✦
      const mark = st.info.sharedIds.includes(id) && fxOn('f_shared') ? 'heart' : id === st.info.rareId && fxOn('f_rare') ? 'star4' : null
      if (mark) {
        const g = glyph(mark, 16, mark === 'heart' ? SHARE : GOLD, s)
        ctx.drawImage(g, ix + 5, cy - 18, 11, 11)
      }
      if (i === 0) {
        // 첫 관심사 이름 (2차)
        const nw = st.nameW + 6
        const tx = step(nw) - nw / 2 + 1
        ctx.font = FONT_NAME; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillStyle = st.info.sharedIds.includes(id) && fxOn('f_shared') ? '#b23a2e' : '#3e2a1f'
        ctx.fillText(firstLabel(st), tx, cy + .5)
      }
    }
    if (st.info.more) {
      const mx = step(ICON_GAP * .8)
      ctx.fillStyle = '#6e5444'; ctx.font = "700 10px Pretendard, system-ui, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`+${st.info.more}`, mx - 2, cy + .5)
    }
    ctx.globalAlpha = a0
  }
  const heartBadge = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    // 2차: 조금 크게 (♥1 이 작아서 안 읽혔음)
    const left = st.expand > .04 ? x - pillHalf(st) + 2 : x - 17
    const top = st.expand > .04 ? y - 47 : y - 38
    const n = st.info.shared
    const w = n > 9 ? 38 : 32
    ctx.fillStyle = SHARE
    ctx.beginPath(); ctx.roundRect(left - 15, top - 10, w, 20, 10); ctx.fill()
    ctx.strokeStyle = '#fffaf2'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.drawImage(glyph('heart', 16, '#ffffff', s), left - 11, top - 6, 12, 12)
    ctx.fillStyle = '#ffffff'; ctx.font = '800 12px Pretendard, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(String(n), left + 3, top + .5)
  }
  const sparkle = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, t: number, s: number) => {
    const legend = st.info.rarity === 'legend'
    const r = st.expand > .04 ? pillHalf(st) + 6 : 24
    const n = quiet ? 2 : 4
    for (let i = 0; i < n; i++) {
      const a = (quiet ? .6 : t * .9 + st.phase) + i * (Math.PI * 2 / n)
      const tw = quiet ? .85 : .35 + .65 * Math.max(0, Math.sin(t * 3.3 + i * 2.1 + st.phase))
      const sz = (8 + (i % 2) * 5) * tw
      if (sz < 1.5) continue
      const col = legend ? RAINBOW[(i * 3 + (quiet ? 0 : Math.floor(t * 5))) % 12] : i % 2 ? GOLD : '#FFF1B8'
      const g = glyph('star4', 24, col, s)
      ctx.drawImage(g, x + Math.cos(a) * r - sz / 2, y - 24 + Math.sin(a) * r * .6 - sz / 2, sz, sz)
    }
  }
  const ellipseOf = (st: Seat, r0: number) => ({
    rx: Math.abs(proj(st.x + r0, .06, st.z).x - st.sx),
    ry: Math.abs(proj(st.x, .06, st.z + r0).y - proj(st.x, .06, st.z - r0).y) / 2,
  })
  const ring = (ctx: CanvasRenderingContext2D, st: Seat, t: number) => {
    // 바닥 원을 화면 타원으로 (카메라가 좌우로 돌지 않아 가로·세로 반지름만 재면 됨)
    const { rx, ry } = ellipseOf(st, 1.25)
    const waves = Math.min(3, st.info.shared)
    ctx.save()
    ctx.strokeStyle = SHARE
    if (quiet || !st.active) {
      ctx.globalAlpha = .75; ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(st.sx, st.sy, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2); ctx.stroke()
    } else {
      for (let i = 0; i < waves; i++) {
        const u = ((t / 1.8) + i / waves + st.phase) % 1
        const k = 1 + u * .55
        ctx.globalAlpha = (1 - u) * .85
        ctx.lineWidth = 3.2 - u * 1.6
        ctx.beginPath(); ctx.ellipse(st.sx, st.sy, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
  }
  /** 등불: 구멍 둘레 따뜻한 빛 웅덩이 */
  const lampPool = (ctx: CanvasRenderingContext2D, st: Seat, t: number) => {
    const { rx, ry } = ellipseOf(st, 1.9)
    const k = quiet ? 1 : .85 + .15 * Math.sin(t * 2.2 + st.phase)
    ctx.save()
    ctx.globalAlpha = .55 * k
    ctx.translate(st.sx, st.sy); ctx.scale(1, ry / Math.max(1, rx))
    ctx.drawImage(glow(LAMP, 64, .25), -rx, -rx, rx * 2, rx * 2)
    ctx.restore()
  }
  /** 등불: 말풍선 위 흔들리는 등 + 고른 관심사 이름표 */
  const lantern = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, t: number, s: number, lan: string) => {
    const sw = quiet ? 0 : Math.sin(t * 2 + st.phase) * .12
    const top = y - (st.expand > .04 ? 48 : 44)
    ctx.save()
    ctx.globalAlpha = .7
    ctx.drawImage(glow(LAMP, 64, .3), x - 30, top - 52, 60, 60)
    ctx.globalAlpha = 1
    ctx.translate(x, top - 6); ctx.rotate(sw)
    ctx.strokeStyle = 'rgba(62,42,31,.7)'; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke()
    const g = sticker('lantern', 22, '#F06A3A', s), z = stickerSize(22, 22)
    ctx.drawImage(g, -z / 2, -8 - z, z, z)
    ctx.restore()
    if (st.pin) return // 이정표는 이름이 이미 있음
    const cat = catOfSub(lan) ?? st.info.cat
    const cv = tag({ text: `${st.info.name}`, cat, catColor: fxColor(cat), s, h: 20, bg: '#3e2a1f', fg: '#fff8ee' })
    const w = cv.width / s, h = cv.height / s
    ctx.drawImage(cv, x - w / 2, y + 2, w, h)
  }
  /** 잘 맞는 이웃 신호: 화면 안이면 금빛 점선 고리, 밖이면 가장자리에서 4초마다 퍼지는 물결 + 이름 */
  const radar = (ctx: CanvasRenderingContext2D, st: Seat, onScreen: boolean, t: number, s: number) => {
    const rt = now()
    const ph = (rt % PING_EVERY) / PING_EVERY // 0..1
    let x: number, y: number, ang: number
    if (onScreen) { x = st.px; y = st.py - 24; ang = -Math.PI / 2 }
    else {
      const pt = pinTo(st.bx, st.by)
      x = Math.min(safe.x1 - 26, Math.max(safe.x0 + 26, pt.x)); y = Math.min(safe.y1 - 10, Math.max(safe.y0 + 30, pt.y)); ang = pt.ang
      x = dodge(x, 30, y - 30, y + 30)
    }
    ctx.save()
    if (onScreen) {
      // 말풍선 둘레 금빛 점선 고리 (돌아감)
      const r = (st.expand > .04 ? pillHalf(st) : 19) + 9
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.setLineDash([5, 4]); ctx.lineDashOffset = quiet ? 0 : -t * 14
      ctx.beginPath(); ctx.ellipse(x, y, r, 25, 0, 0, Math.PI * 2); ctx.stroke()
    } else {
      // 가장자리 물결 세 겹 (바깥쪽을 향한 반원)
      const waves = quiet ? [.35] : [ph, (ph + .33) % 1, (ph + .66) % 1]
      for (const u of waves) {
        ctx.globalAlpha = (1 - u) * .9
        ctx.strokeStyle = SHARE; ctx.lineWidth = 3.2 - u * 1.8
        ctx.beginPath(); ctx.arc(x, y, 10 + u * 34, ang - 1.1, ang + 1.1); ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = SHARE
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fffaf2'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.restore()
    // 이름표: 신호가 퍼지는 앞쪽 2.4초 동안 (움직임 없는 단계·쉬는 중엔 늘)
    const show = quiet || ph < .6
    if (!show) return
    const a = quiet ? 1 : Math.min(1, ph / .08, (0.6 - ph) / .1)
    const cv = tag({ text: `잘 맞는 이웃 · ${st.info.name} ♥${st.info.shared}`, icon: 'heart', iconColor: '#ffffff', bg: SHARE, fg: '#ffffff', s, h: 22 })
    const w = cv.width / s, h = cv.height / s
    // 화면 안쪽으로 비켜서 (가장자리 물결·다른 이정표와 안 겹치게)
    let lx = 0, ly = 0
    for (let k = 0; k < 4; k++) {
      const d = onScreen ? 0 : 46 + k * 40
      lx = x - Math.cos(ang) * d - w / 2; ly = y - Math.sin(ang) * d - h / 2 + (onScreen ? -44 - k * 28 : 0)
      lx = Math.min(safe.x1 - w, Math.max(safe.x0, lx)); ly = Math.min(safe.y1 - h, Math.max(safe.y0, ly))
      lx = dodge(lx + w / 2, w / 2, ly, ly + h) - w / 2
      const cx = lx + w / 2, cy = ly + h / 2
      if (!pinTaken.some((p) => Math.abs(p.x - cx) < p.w + w / 2 + 4 && cy > p.y - 62 && cy < p.y + 30)) break
    }
    if (!onScreen) {
      // 이름표 → 신호 점 점선 (이름표가 가장자리에서 떨어져 있어도 어느 쪽인지 보이게)
      ctx.save(); ctx.globalAlpha = a * .8; ctx.strokeStyle = SHARE; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(lx + w / 2, ly + h / 2); ctx.lineTo(x, y); ctx.stroke(); ctx.restore()
    }
    ctx.globalAlpha = a
    ctx.drawImage(cv, lx, ly, w, h)
    ctx.globalAlpha = 1
  }
  const smoke = (ctx: CanvasRenderingContext2D, vis: Seat[], dt: number, t: number) => {
    // 멈춘 연기: 움직이지 않는 구멍 (still 단계·쉬는 중이면 모두)
    for (const st of vis) {
      if ((st.active && !quiet) || st.dim) continue
      const sp = glow(lighten(st.color, .25), 48, .3)
      for (let i = 0; i < 3; i++) {
        const yy = .35 + i * .45, p = proj(st.x + Math.sin(i * 1.7 + st.phase) * .12, yy, st.z)
        const z = 26 + i * 12
        ctx.globalAlpha = .34 - i * .08
        ctx.drawImage(sp, p.x - z / 2, p.y - z / 2, z, z)
      }
    }
    ctx.globalAlpha = 1
    if (still) return
    const cap = overlay.mode.level === 'full' ? 140 : 40
    for (const st of vis) {
      if (!st.active || quiet || st.dim) continue // 쉬는 중엔 새 연기 없음
      const rate = fxOn('f_online') && st.info.online ? 2.4 : 1.2
      st.smokeAcc += dt * rate
      while (st.smokeAcc >= 1) {
        st.smokeAcc -= 1
        if (puffs.length < cap) puffs.push({ s: st, x: st.x + (Math.random() - .5) * .3, y: .2, z: st.z + (Math.random() - .5) * .2, age: 0, life: 2.4 + Math.random() * .6, size: .3 + Math.random() * .15, drift: Math.random() * 6, color: lighten(st.color, Math.random() * .35) })
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      p.age += dt
      if (p.age >= p.life || !p.s.vis) { puffs.splice(i, 1); continue }
      const u = p.age / p.life
      p.y += dt * .7
      const sp = proj(p.x + Math.sin(p.age * 1.4 + p.drift) * .25 * u, p.y, p.z)
      const sx = sp.x, sy = sp.y // proj 는 같은 객체를 돌려주므로 다음 proj 전에 값을 받아 둠
      const ppm = Math.abs(proj(p.x, p.y + .5, p.z).y - sy) * 2 // 이 높이에서 1m 가 몇 px
      const z = p.size * (1 + u * 1.6) * ppm
      ctx.globalAlpha = Math.min(1, u / .12) * (1 - u) * .5
      ctx.drawImage(glow(p.color, 48, .3), sx - z / 2, sy - z / 2, z, z)
    }
    ctx.globalAlpha = 1
    void t
  }

  const anyOn = () => fxOn('f_bubble') || fxOn('f_expand') || fxOn('f_shared') || fxOn('f_rare') || fxOn('f_online') || fxOn('f_smoke') || fxOn('f_edge') || fxOn('f_lantern') || fxOn('f_radar') || fxOn('f_zones')
  // 가속 꺼짐(lite)은 점프하는 1.3초 동안 움직임을 멈춤 (그리는 건 카메라가 멈춘 순간 한 번뿐). 4차 측정: 모두 켜면 점프 fps 가 58 → 53 이었음
  const overlay = createOverlay(o.container, o.after, camera, draw, (calm) => !(overlay.mode.level === 'lite' && o.here().moving) && anyOn() && (puffs.length > 0 || seats.some((x) => x.expand > .01 && x.expand < .99)
    || (!calm && (fxOn('f_shared') || fxOn('f_rare') || fxOn('f_online') || fxOn('f_smoke') || (fxOn('f_radar') && !!best) || (fxOn('f_lantern') && !!getLantern())))))
  still = overlay.mode.level === 'still'
  // 서 있는 자리가 바뀌면(점프) 다시 그림 (still 단계에서도 펼침·숨김이 바뀌므로)
  let lastSeat = -1
  const poll = window.setInterval(() => {
    const h = o.here(); const k = h.seat * 2 + (h.moving ? 1 : 0)
    if (k === lastSeat) return
    lastSeat = k
    // 가속 꺼짐: 점프하는 동안(약 1.3초)은 겹 캔버스를 합성에서도 빼 둠 (화면 가득한 투명 층 하나를 매 프레임 섞는 일이 WARP 에서 점프 fps 를 깎았음)
    if (overlay.mode.level === 'lite') overlay.setHidden(h.moving)
    overlay.invalidate()
    // 동네 이름표는 겹 캔버스가 쉬어도 (still 단계·쉬는 중) 자리가 바뀌면 바로
    checkZone(h.seat, h.moving)
  }, 100)
  const unsub = subscribeFx(() => { overlay.invalidate(); if (!fxOn('f_zones')) { banner.style.opacity = '0'; bannerZone = -1 } })
  return {
    dispose() { unsub(); clearInterval(poll); clearInterval(avoidPoll); avoidRo.disconnect(); clearTimeout(bannerTimer); overlay.dispose(); banner.remove(); puffs.length = 0 },
  }
}
