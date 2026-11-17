import * as THREE from 'three'
import { fxOn, subscribeFx } from '../../lib/fxLab'
import { catOfSub, fxColor, type HoleFx } from '../../data/interestFx'
import { createOverlay, type OverlayFrame } from './overlay'
import { badge, bubble, glow, glyph, lighten } from './icons'

/*
 * 탐색 들판 관심사 이펙트 (docs/interest-effects.md). holeField 는 만들기·정리만 부름 (배경 굽기·이동 경로 코드는 건드리지 않음)
 *
 * f_bubble 대표 관심사 말풍선: 구멍 위 대표 관심사(맨 앞) 아이콘 말풍선. 서 있는 구멍은 안내판이 있어서 숨김
 * f_expand 가까이 가면 펼쳐짐: 두더지 옆 구멍(약 6.6m 안)은 관심사 3개 알약으로 (겹치는 것 ♥ → 드문 것 ✦ → 고른 순서) + "+N"
 * f_shared 겹치는 관심사 고리: 겹치는 관심사가 있으면 구멍 둘레에 고리가 퍼짐 (겹치는 수만큼 최대 3겹) + ♥N 배지
 * f_rare 드문 관심사 반짝: 250명 미만 관심사가 있으면 금빛 별, 100명 미만이면 무지개 별
 * f_online 접속 중이면 활발: 말풍선이 통통 튀고 초록 점, 연기가 두 배
 * f_smoke 관심사 연기: 대표 관심사 색 연기. 가까운 몇 구멍만 피어오르고 나머지는 멈춘 연기
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
}
export interface FieldFx { dispose(): void }

const EXPAND_R = 6.6, EDGE_R = 10.5, ICON_GAP = 27
const SHARE = '#FF8A5B', GOLD = '#F5C452'
const RAINBOW = Array.from({ length: 12 }, (_, i) => `#${new THREE.Color().setHSL(i / 12, .85, .66).getHexString()}`)

interface Seat {
  info: HoleFx
  x: number; z: number
  color: string
  expand: number
  smokeAcc: number
  phase: number
  // 이번 프레임
  sx: number; sy: number; bx: number; by: number; dist: number; vis: boolean; active: boolean
  /** 화면 밖이라 가장자리 이정표로 보임 */
  pin: boolean
}
interface Puff { s: Seat; x: number; y: number; z: number; age: number; life: number; size: number; drift: number; color: string }

export function createFieldFx(o: FieldFxOptions): FieldFx {
  const { camera } = o
  const seats: Seat[] = []
  for (const info of o.seats) {
    const h = o.holes.get(info.seat)
    if (!h) continue
    seats.push({
      info, x: h.x, z: h.z, color: fxColor(info.cat), expand: 0, smokeAcc: Math.random(), phase: Math.random() * 6,
      sx: 0, sy: 0, bx: 0, by: 0, dist: 0, vis: false, active: false, pin: false,
    })
  }
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
  const inSafe = (x: number, y: number) => x >= safe.x0 && x <= safe.x1 && y >= safe.y0 && y <= safe.y1

  const draw = ({ ctx, W: w, H: h, dt, t, calm }: OverlayFrame) => {
    W = w; H = h
    quiet = still || calm
    measureSafe()
    const s = overlay.mode.dpr
    const here = o.here()
    const cur = o.holes.get(here.seat)
    const vis: Seat[] = [], shown: Seat[] = []
    for (const st of seats) {
      const g = proj(st.x, .08, st.z)
      st.sx = g.x; st.sy = g.y
      st.vis = g.ok && g.x > -120 && g.x < W + 120 && g.y > -60 && g.y < H + 160
      const b = proj(st.x, .95, st.z)
      st.bx = b.x; st.by = b.y
      st.dist = cur ? Math.hypot(st.x - cur.x, st.z - cur.z) : 99
      st.active = false
      const standing = st.info.seat === here.seat && !here.moving
      // 화면 밖 옆 구멍(약 10m 안)은 가장자리 이정표로
      st.pin = !standing && fxOn('f_edge') && b.ok && !inSafe(st.bx, st.by) && st.dist > .1 && st.dist < EDGE_R
      if (st.vis) vis.push(st)
      if (!standing && (st.pin || (st.vis && inSafe(st.bx, st.by + 20)))) shown.push(st)
    }
    // 움직이는 구멍: 두더지에 가까운 순 N개 (화면 안 + 이정표)
    if (!still) [...shown].sort((a, b) => a.dist - b.dist).slice(0, overlay.mode.active).forEach((st) => { st.active = true })
    // 1) 바닥 고리 (겹치는 관심사)
    if (fxOn('f_shared')) for (const st of vis) if (st.info.shared && !st.info.mine) ring(ctx, st, t)
    // 2) 연기
    if (fxOn('f_smoke')) smoke(ctx, vis, dt, t)
    else puffs.length = 0
    // 3) 말풍선·펼친 알약 (먼 것 먼저 → 가까운 것이 위, 이정표는 맨 위)
    shown.sort((a, b) => (a.pin ? 1 : 0) - (b.pin ? 1 : 0) || a.by - b.by)
    for (const st of shown) {
      const near = fxOn('f_expand') && st.dist > .1 && st.dist < EXPAND_R
      st.expand += ((near ? 1 : 0) - st.expand) * Math.min(1, still ? 1 : dt * 7)
      const lively = fxOn('f_online') && st.info.online
      const bob = lively && st.active && !quiet ? Math.abs(Math.sin(t * 3.2 + st.phase)) * -5 : 0
      let x = st.bx, y = st.by + bob
      if (st.pin) {
        // 이정표: 알약·말풍선 높이만큼 안쪽으로 들인 자리 + 바깥쪽 화살표 + 이름
        const pt = pinTo(st.bx, st.by)
        x = Math.min(safe.x1 - pillHalf(st), Math.max(safe.x0 + pillHalf(st), pt.x))
        y = Math.min(safe.y1, Math.max(safe.y0 + 46, pt.y)) + bob
        signpost(ctx, st, x, y, pt.ang)
      }
      const pill = st.expand > .04
      if (pill) drawPill(ctx, st, x, y, s)
      else if (fxOn('f_bubble') || st.pin) drawBubble(ctx, st, x, y, s)
      else continue
      if (lively) {
        const dx = pill ? pillHalf(st) - 4 : 11, dy = pill ? -38 : -32
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#5FBF3A'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.4, 0, Math.PI * 2); ctx.fill()
      }
      if (fxOn('f_shared') && st.info.shared && !st.info.mine) heartBadge(ctx, st, x, y, s)
      if (fxOn('f_rare') && st.info.rarity) sparkle(ctx, st, x, y, t, s)
    }
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

  /** 펼친 알약 반폭 (아이콘 개수에 따라) */
  const pillHalf = (st: Seat) => {
    const n = st.info.icons.length + (st.info.more ? .8 : 0)
    const full = (n * ICON_GAP + 10) / 2
    return 19 + (full - 19) * st.expand
  }
  const drawBubble = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    const b = bubble(st.info.cat, 34, st.color, s)
    const w = b.cv.width / s, h = b.cv.height / s
    ctx.drawImage(b.cv, x - w / 2, y - b.tip / s, w, h)
  }
  const drawPill = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    const k = st.expand
    const half = pillHalf(st), hh = 18
    const cy = y - 24
    ctx.save()
    ctx.shadowColor = 'rgba(60,35,20,.28)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5
    ctx.fillStyle = '#fbf8f4'
    ctx.beginPath(); ctx.roundRect(x - half, cy - hh, half * 2, hh * 2, hh); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x - 5, cy + hh - 1); ctx.lineTo(x, cy + hh + 7); ctx.lineTo(x + 5, cy + hh - 1); ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.lineWidth = 2; ctx.strokeStyle = st.color
    ctx.beginPath(); ctx.roundRect(x - half + 1, cy - hh + 1, half * 2 - 2, hh * 2 - 2, hh - 1); ctx.stroke()
    // 아이콘: 펼치는 동안 가운데에서 양옆으로
    const icons = st.info.icons, n = icons.length + (st.info.more ? .8 : 0)
    ctx.globalAlpha = Math.min(1, k * 1.4)
    for (let i = 0; i < icons.length; i++) {
      const id = icons[i], cat = catOfSub(id) ?? st.info.cat
      const ox = (i - (n - 1) / 2) * ICON_GAP * k
      const b = badge(cat, 23, fxColor(cat), s)
      const bw = b.width / s
      ctx.drawImage(b, x + ox - bw / 2, cy - bw / 2, bw, bw)
      // 표시: 겹치는 것 ♥ · 드문 것 ✦
      const mark = st.info.sharedIds.includes(id) && fxOn('f_shared') ? 'heart' : id === st.info.rareId && fxOn('f_rare') ? 'star4' : null
      if (mark) {
        const g = glyph(mark, 16, mark === 'heart' ? SHARE : GOLD, s)
        ctx.drawImage(g, x + ox + 5, cy - 18, 11, 11)
      }
    }
    if (st.info.more) {
      ctx.fillStyle = '#6e5444'; ctx.font = "700 10px Pretendard, system-ui, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`+${st.info.more}`, x + ((n - 1) / 2) * ICON_GAP * k - 3, cy + .5)
    }
    ctx.globalAlpha = 1
  }
  const heartBadge = (ctx: CanvasRenderingContext2D, st: Seat, x: number, y: number, s: number) => {
    const left = st.expand > .04 ? x - pillHalf(st) + 2 : x - 16
    const top = st.expand > .04 ? y - 46 : y - 36
    const n = st.info.shared
    ctx.fillStyle = SHARE
    ctx.beginPath(); ctx.roundRect(left - 14, top - 8, n > 9 ? 34 : 28, 16, 8); ctx.fill()
    ctx.drawImage(glyph('heart', 16, '#ffffff', s), left - 11, top - 5, 10, 10)
    ctx.fillStyle = '#ffffff'; ctx.font = '700 10px Pretendard, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(String(n), left + 1, top + .5)
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
  const ring = (ctx: CanvasRenderingContext2D, st: Seat, t: number) => {
    // 바닥 원을 화면 타원으로 (카메라가 좌우로 돌지 않아 가로·세로 반지름만 재면 됨)
    const r0 = 1.25
    const rx = Math.abs(proj(st.x + r0, .06, st.z).x - st.sx)
    const ry = Math.abs(proj(st.x, .06, st.z + r0).y - proj(st.x, .06, st.z - r0).y) / 2
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
  const smoke = (ctx: CanvasRenderingContext2D, vis: Seat[], dt: number, t: number) => {
    // 멈춘 연기: 움직이지 않는 구멍 (still 단계·쉬는 중이면 모두)
    for (const st of vis) {
      if (st.active && !quiet) continue
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
      if (!st.active || quiet) continue // 쉬는 중엔 새 연기 없음
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

  const anyOn = () => fxOn('f_bubble') || fxOn('f_expand') || fxOn('f_shared') || fxOn('f_rare') || fxOn('f_online') || fxOn('f_smoke') || fxOn('f_edge')
  // 가속 꺼짐(lite)은 점프하는 1.3초 동안 움직임을 멈춤 (그리는 건 카메라가 멈춘 순간 한 번뿐). 4차 측정: 모두 켜면 점프 fps 가 58 → 53 이었음
  const overlay = createOverlay(o.container, o.after, camera, draw, (calm) => !(overlay.mode.level === 'lite' && o.here().moving) && anyOn() && (puffs.length > 0 || seats.some((x) => x.expand > .01 && x.expand < .99) || (!calm && (fxOn('f_shared') || fxOn('f_rare') || fxOn('f_online') || fxOn('f_smoke')))))
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
  }, 100)
  const unsub = subscribeFx(() => overlay.invalidate())
  return {
    dispose() { unsub(); clearInterval(poll); overlay.dispose(); puffs.length = 0 },
  }
}
