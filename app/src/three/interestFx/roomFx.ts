import * as THREE from 'three'
import { fxOn, subscribeFx } from '../../lib/fxLab'
import {
  RARITY_LABEL, SUB_TOTAL, catName, fxColor, leadOf, mainFurnitureOf, neighborsWith, peopleCount, rarestOf, rarityOf, rarityRank, sharedSubs,
  subName, subsOfCat, type Rarity,
} from '../../data/interestFx'
import { createOverlay, type OverlayFrame } from './overlay'
import { badge, glow, glyph, lighten, toRgba } from './icons'

/*
 * 땅굴 안 관심사 이펙트 (docs/interest-effects.md). roomScene 은 만들기·마우스 올림·정리만 부름
 *
 * r_particles 관심사 숨결: 카테고리 주 가구(피아노·이젤 …)와 세부 관심사 소품에서 그 관심사다운 입자.
 *   음악 음표 · 사진 플래시 반짝 · 자연 잎 · 게임 픽셀(계단식으로 오름) · 공예 물감 방울 · 책 종이 · 과학 별 반짝 ·
 *   차 김 · 아웃도어 모닥불 불티 · 영화 팝콘 · 반려동물 바닥 발자국
 * r_card 관심사 카드: 가구에 마우스를 올리면 관심사·고른 사람 수·드문 정도·내 들판 이웃 수·(남의 땅굴) 같이 좋아함 + 말 걸기 한마디
 * r_shared 나와 같은 관심사 (남의 땅굴): 그 가구에 따뜻한 빛 + "나도" 배지 + 하트
 * r_rare 가장 드문 관심사: 방에서 가장 드문 관심사 가구에 반짝이 + "드문 취미" 배지 (아주 드물면 무지개)
 * r_beam 대표 관심사 빛줄기: 천장 구멍에서 내려오는 빛과 떠다니는 먼지를 대표 관심사 색으로
 */

export interface RoomFxItem { g: THREE.Object3D; sub: string | null; category: string; rowId: string; type: string }

export interface RoomFxOptions {
  container: HTMLElement
  /** 이 뒤에 겹 캔버스를 붙임 (WebGL 캔버스) */
  after: Element
  camera: THREE.PerspectiveCamera
  /** 관심사 가구 목록 (꾸미기에서 갈아 끼우면 바뀌므로 함수) */
  items: () => RoomFxItem[]
  ownerId?: string
  /** 방 주인 관심사 */
  interests: string[]
  /** 남의 땅굴이면 내 관심사 (나와 같은 관심사) */
  viewer?: string[]
  /** 천장 구멍 가운데 (빛줄기 위쪽) */
  hole: THREE.Vector3
  /** 입장 연출 중 (천장 구멍·가구 낙하) → 이펙트를 숨겼다가 끝나면 서서히 */
  intro: () => boolean
}

export interface RoomFx {
  /** 마우스를 올린 가구 (없으면 null). 카드를 띄웠으면 true → 장면의 이름표는 숨김 */
  hover(g: THREE.Object3D | null, action: string | null): boolean
  dispose(): void
}

interface Em {
  item: RoomFxItem
  cat: string
  color: string
  kind: 'main' | 'prop' | 'pet' | 'none'
  top: THREE.Vector3
  center: THREE.Vector3
  half: number
  acc: number
  heartAcc: number
  flashAt: number
  step: number
  shared: boolean
  rare: Rarity | null
  // 이번 프레임 화면 값
  sx: number; sy: number; ppm: number; on: boolean
}

interface P {
  em: Em
  kind: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  age: number; life: number
  size: number
  rot: number; vr: number
  color: string
  seed: number
}

const RATE_MAIN = 1.7, RATE_PROP = 0.45, PET_STEP = 0.42, HEART_RATE = 0.8
/** 입자 크기 배율 (첫 스크린샷에서 너무 작아 보였음) */
const K = 1.45
const pickOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const PAL = {
  nature: ['#5FAE45', '#8CC56A', '#3F8A3A', '#A9D46F'],
  game: ['#58C4F6', '#F5C452', '#E8743B', '#8CC56A', '#B784F0'],
  craft: ['#E8705A', '#F2C14E', '#4E8FD0', '#6FB24A', '#B784F0'],
  science: ['#ffffff', '#C9CCFF', '#FFE08A'],
  outdoor: ['#FFB347', '#FF7A3A', '#FFD27A'],
  movie: ['#FFF6D8', '#FFE9A8', '#FFF0C0'],
}
/** 무지개 반짝이 색 (hsl 을 그때그때 만들면 글리프 캐시가 끝없이 늘어서 12단계로) */
const RAINBOW = Array.from({ length: 12 }, (_, i) => {
  const c = new THREE.Color().setHSL(i / 12, 0.85, 0.68)
  return `#${c.getHexString()}`
})
const GOLD = '#F5C452', SHARE = '#FF8A7A', SPRITE = 24

export function createRoomFx(o: RoomFxOptions): RoomFx {
  const { camera } = o
  const shared = new Set(o.viewer ? sharedSubs(o.interests, o.viewer) : [])
  const rarest = rarestOf(o.interests)
  const lead = leadOf(o.interests)
  const ems: Em[] = []
  let itemsRef: RoomFxItem[] | null = null
  let boxAge = 99
  const box = new THREE.Box3()
  /** 관심사 가구 → 이펙트 자리 (위 가운데·크기). 1초마다 다시 잼 (갈아 끼우기·모양 바꾸기) */
  const measure = () => {
    const items = o.items()
    if (items !== itemsRef || items.length !== ems.length) {
      itemsRef = items
      ems.length = 0
      for (const it of items) {
        const pet = it.type === 'pet'
        const main = !it.sub && it.rowId === mainFurnitureOf(it.category)
        // 반려동물 용품(침대·집)은 동물이 발자국을 내므로 입자 없음
        const kind: Em['kind'] = pet ? 'pet' : main ? 'main' : it.sub && it.category !== 'pet' ? 'prop' : 'none'
        ems.push({
          item: it, cat: it.category, color: fxColor(it.category), kind, top: new THREE.Vector3(), center: new THREE.Vector3(), half: .3,
          acc: Math.random(), heartAcc: Math.random(), flashAt: 1 + Math.random() * 3, step: 0,
          shared: !!it.sub && shared.has(it.sub), rare: null, sx: 0, sy: 0, ppm: 100, on: false,
        })
      }
      // 가장 드문 관심사: 그 관심사의 가구 하나 (동물이 있으면 동물, 없으면 소품)
      const r = rarest ? ems.filter((e) => e.item.sub === rarest.id) : []
      const target = r.find((e) => e.kind === 'pet') ?? r[0]
      if (target && rarest) target.rare = rarest.rarity
    }
    for (const e of ems) {
      e.item.g.updateMatrixWorld(true)
      box.setFromObject(e.item.g)
      if (box.isEmpty()) continue
      box.getCenter(e.center)
      e.top.set(e.center.x, box.max.y, e.center.z)
      e.half = Math.max(.08, Math.min(.9, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2))
    }
    boxAge = 0
  }

  /* ---------- 화면 투영 ---------- */
  const v = new THREE.Vector3()
  const S = { x: 0, y: 0, ok: false }
  let W = 1, H = 1
  const proj = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera)
    S.x = (v.x * .5 + .5) * W; S.y = (-v.y * .5 + .5) * H; S.ok = v.z < 1 && v.z > -1
    return S
  }
  const camRight = new THREE.Vector3()

  /* ---------- 입자 ---------- */
  const ps: P[] = []
  const spawn = (e: Em, small: boolean) => {
    const r = Math.random
    const p: P = {
      em: e, kind: e.cat, x: e.top.x + (r() - .5) * e.half * 1.1, y: e.top.y + .02, z: e.top.z + (r() - .5) * e.half * .5,
      vx: 0, vy: 0, vz: 0, age: 0, life: 2, size: .12, rot: 0, vr: 0, color: e.color, seed: r() * 10,
    }
    const k = (small ? .75 : 1) * K
    switch (e.cat) {
      case 'music': p.vy = .36; p.vx = (r() - .5) * .1; p.life = 2.4; p.size = .16 * k; p.color = r() < .5 ? e.color : lighten(e.color, .45); p.rot = (r() - .5) * .5; break
      case 'photo': p.kind = 'flash'; p.y = e.top.y - r() * .25; p.vy = .04; p.life = .55; p.size = .16 * k; p.color = '#ffffff'; break
      case 'nature': p.vy = .2; p.vx = (r() - .5) * .22; p.life = 3; p.size = .13 * k; p.vr = (r() - .5) * 2.5; p.rot = r() * 6; p.color = pickOf(PAL.nature); break
      case 'game': p.vy = .34; p.vx = (r() - .5) * .12; p.life = 1.8; p.size = .07 * k; p.color = pickOf(PAL.game); break
      case 'craft': p.vy = .75 + r() * .3; p.vx = (r() - .5) * .45; p.vz = (r() - .5) * .2; p.life = 1.3; p.size = (.045 + r() * .03) * k; p.color = pickOf(PAL.craft); break
      case 'book': p.vy = .2; p.vx = (r() - .5) * .15; p.life = 2.6; p.size = .12 * k; p.color = '#fffaf0'; p.vr = (r() - .5) * .8; break
      case 'science': {
        const a = r() * Math.PI * 2, rr = e.half + .1 + r() * .25
        p.x = e.center.x + Math.cos(a) * rr; p.z = e.center.z + Math.sin(a) * rr * .5; p.y = e.top.y - .1 + r() * .55
        p.vy = .03; p.life = 1.6; p.size = (.1 + r() * .08) * k; p.color = pickOf(PAL.science); break
      }
      case 'tea_coffee': p.x = e.top.x + (r() - .5) * e.half * .5; p.vy = .22; p.life = 2.4; p.size = .16 * k; p.color = '#ffffff'; break
      case 'outdoor': p.vy = .5 + r() * .3; p.vx = (r() - .5) * .15; p.life = 1.3 + r() * .5; p.size = .06 * k; p.color = pickOf(PAL.outdoor); break
      case 'movie': p.vy = 1 + r() * .4; p.vx = (r() - .5) * .5; p.vz = (r() - .5) * .3; p.life = 1.2; p.size = .075 * k; p.color = pickOf(PAL.movie); p.vr = (r() - .5) * 6; break
      default: p.vy = .3; p.life = 2; p.kind = 'star'; p.color = '#ffffff'
    }
    ps.push(p)
  }
  /** 반려동물: 동물 둘레를 도는 발자국 (바닥에 찍히고 사라짐) */
  const pawStep = (e: Em) => {
    e.step++
    const R = e.half + .35, a = e.step * .3 + e.center.x
    const side = e.step % 2 ? 1 : -1
    const hx = -Math.sin(a), hz = Math.cos(a) // 진행 방향 (원을 따라)
    ps.push({
      em: e, kind: 'paw', x: e.center.x + Math.cos(a) * R + hz * .06 * side, y: .025, z: e.center.z + Math.sin(a) * R * .8 - hx * .06 * side,
      vx: hx, vy: 0, vz: hz, age: 0, life: 2.6, size: .12, rot: 0, vr: 0, color: e.color, seed: 0,
    })
  }

  /* ---------- 미리 그린 배지 (드문 취미·나도) ---------- */
  const pills = new Map<string, HTMLCanvasElement>()
  const pill = (text: string, bg: string, icon: string, iconColor: string, s: number) => {
    const key = `${text}|${bg}|${icon}|${iconColor}|${s}`
    let cv = pills.get(key)
    if (cv) return cv
    cv = document.createElement('canvas')
    const c0 = cv.getContext('2d')!
    const font = `700 ${11 * s}px Pretendard, 'Pretendard Variable', system-ui, sans-serif`
    c0.font = font
    const tw = c0.measureText(text).width
    const h = 20 * s, w = tw + 30 * s
    cv.width = Math.ceil(w + 4 * s); cv.height = Math.ceil(h + 6 * s)
    const c = cv.getContext('2d')!
    c.shadowColor = 'rgba(60,35,20,.3)'; c.shadowBlur = 4 * s; c.shadowOffsetY = 1 * s
    c.fillStyle = bg; c.beginPath(); c.roundRect(2 * s, 2 * s, w, h, h / 2); c.fill()
    c.shadowColor = 'transparent'
    const g = glyph(icon, 13, iconColor, s)
    c.drawImage(g, 2 * s + 6 * s, 2 * s + h / 2 - g.height / 2)
    c.font = font; c.fillStyle = '#ffffff'; c.textBaseline = 'middle'
    c.fillText(text, 2 * s + 22 * s, 2 * s + h / 2 + .5 * s)
    pills.set(key, cv)
    return cv
  }

  /* ---------- 카드 (DOM) ---------- */
  const card = document.createElement('div')
  card.setAttribute('role', 'tooltip')
  Object.assign(card.style, {
    position: 'absolute', left: '0', top: '0', zIndex: '5', pointerEvents: 'none', width: 'max-content', maxWidth: '260px',
    padding: '11px 13px 10px', borderRadius: '14px', background: 'rgba(251,248,244,.97)', color: '#3e2a1f',
    boxShadow: '0 6px 18px rgba(60,35,20,.22), 0 2px 0 rgba(116,74,50,.12)', font: '500 12px/1.45 Pretendard, system-ui, sans-serif',
    opacity: '0', transform: 'translate(-50%, -100%) translateY(-6px) scale(.96)', transformOrigin: '50% 100%',
    transition: 'opacity .14s, transform .18s cubic-bezier(.2,.7,.2,1.3)', display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  o.container.append(card)
  let cardEm: Em | null = null
  let cardKey = ''
  const el = (tag: string, css: Partial<CSSStyleDeclaration>, text?: string) => {
    const x = document.createElement(tag); Object.assign(x.style, css); if (text != null) x.textContent = text; return x
  }
  const fillCard = (e: Em, action: string | null) => {
    card.replaceChildren()
    const head = el('div', { display: 'flex', alignItems: 'center', gap: '9px' })
    const icon = badge(e.cat, 26, e.color, Math.min(window.devicePixelRatio || 1, 2))
    const ic = document.createElement('canvas')
    ic.width = icon.width; ic.height = icon.height
    Object.assign(ic.style, { width: '30px', height: '30px', flex: 'none' })
    ic.getContext('2d')!.drawImage(icon, 0, 0)
    const titleBox = el('div', { display: 'flex', flexDirection: 'column' })
    const sub = e.item.sub
    titleBox.append(
      el('strong', { font: "400 17px/1.15 'Do Hyeon', Pretendard, sans-serif", color: '#3e2a1f' }, sub ? subName(sub) : catName(e.cat)),
      el('small', { fontSize: '11px', color: '#8a7262' }, sub ? catName(e.cat) : `${catName(e.cat)} 가구`),
    )
    head.append(ic, titleBox)
    card.append(head)
    const line = (text: string, css: Partial<CSSStyleDeclaration> = {}) => card.append(el('p', { margin: '6px 0 0', ...css }, text))
    if (sub) {
      const n = peopleCount(sub)
      if (n != null) line(`이 관심사를 고른 사람 ${n.toLocaleString()}명`)
      const r = rarityOf(n)
      if (r) {
        const rank = rarityRank(sub)
        const tag = el('span', {
          display: 'inline-flex', marginTop: '6px', padding: '3px 8px', borderRadius: '999px', fontWeight: '700', fontSize: '11px',
          background: r === 'legend' ? 'linear-gradient(90deg,#ff9a9e,#fad0c4,#a1c4fd,#c2e9fb)' : r === 'rare' ? '#F5C452' : '#f3e6be',
          color: r === 'legend' ? '#4a2c3a' : '#5e4510',
        }, `✦ ${RARITY_LABEL[r]}`)
        card.append(tag)
        // 순위는 드문 쪽 20위 안일 때만 (중간쯤이면 숫자가 오히려 평범해 보임)
        if (rank && rank <= 20) line(`관심사 ${SUB_TOTAL}개 중 ${rank}번째로 드물어요`, { color: '#8a6a2a', fontSize: '11px', marginTop: '3px' })
      }
      const nb = neighborsWith(sub, o.ownerId ? [o.ownerId] : [])
      line(nb.n ? `${nb.where} 들판 이웃 중 ${nb.n}명도 좋아해요` : `${nb.where} 들판엔 아직 같은 관심사 이웃이 없어요`, { color: '#6e5444' })
      if (o.viewer && shared.has(sub)) {
        line(`♥ 나도 좋아하는 관심사예요`, { color: '#c4473a', fontWeight: '700' })
        line(`“${subName(sub)}” 이야기로 먼저 말 걸어 볼까요?`, { color: '#6e5444' })
      }
    } else {
      const mine = subsOfCat(o.interests, e.cat)
      if (mine.length) {
        line(o.viewer ? '이 땅굴 주인이 고른 관심사' : '내가 고른 관심사', { color: '#8a7262', fontSize: '11px' })
        const chips = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' })
        for (const id of mine) {
          const on = o.viewer && shared.has(id)
          chips.append(el('span', {
            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
            background: on ? '#ffe1dc' : toRgba(e.color, .14), color: on ? '#b23a2e' : '#4a3428',
          }, `${on ? '♥ ' : ''}${subName(id)} ${(peopleCount(id) ?? 0).toLocaleString()}명`))
        }
        card.append(chips)
      }
    }
    if (action && !/준비 중/.test(action)) line(`누르면 · ${action}`, { color: '#9a4a2c', fontWeight: '600', fontSize: '11px' })
  }
  const placeCard = () => {
    if (!cardEm) return
    const p = proj(cardEm.top.x, cardEm.top.y + .12, cardEm.top.z)
    const w = card.offsetWidth || 220, h = card.offsetHeight || 90
    const x = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, p.x))
    const y = Math.max(h + 12, p.y)
    card.style.left = `${Math.round(x)}px`; card.style.top = `${Math.round(y)}px`
  }
  const showCard = (e: Em | null, action: string | null) => {
    if (!e) {
      if (cardEm) { cardEm = null; card.style.opacity = '0'; card.style.transform = 'translate(-50%, -100%) translateY(-6px) scale(.96)'; card.style.display = 'none' }
      return
    }
    const key = `${e.item.rowId}|${e.item.sub}|${action}`
    if (key !== cardKey) { cardKey = key; fillCard(e, action) }
    cardEm = e
    card.style.display = 'block'
    placeCard()
    card.style.opacity = '1'; card.style.transform = 'translate(-50%, -100%) translateY(-10px) scale(1)'
  }

  /* ---------- 그리기 ---------- */
  /** 움직임 없는 단계 (아주 느린 PC·움직임 줄이기, overlay.ts) — 겹 캔버스를 만든 뒤 정함 */
  let still = false
  let introEnd = -1
  let lastT = 0
  const draw = ({ ctx, W: w, H: h, dt, t }: OverlayFrame) => {
    W = w; H = h; lastT = t
    if (o.intro()) { introEnd = -1; return }
    if (introEnd < 0) introEnd = t
    boxAge += dt
    if (boxAge > 1 || !itemsRef) measure()
    const fade = still ? 1 : Math.min(1, (t - introEnd) / .6)
    const s = overlay.mode.dpr
    // 화면 값
    camRight.setFromMatrixColumn(camera.matrixWorld, 0)
    for (const e of ems) {
      const p = proj(e.top.x, e.top.y, e.top.z)
      e.sx = p.x; e.sy = p.y; e.on = p.ok && p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 120
      const y1 = proj(e.top.x, e.top.y + .5, e.top.z).y
      e.ppm = Math.max(10, Math.abs(e.sy - y1) * 2)
    }
    ctx.globalAlpha = fade
    if (fxOn('r_beam') && lead) drawBeam(ctx, t, dt)
    if (fxOn('r_shared') && o.viewer) for (const e of ems) if (e.shared && e.on) drawShareGlow(ctx, e, t)
    if (fxOn('r_particles')) stepParticles(ctx, dt, t, fade)
    else ps.length = 0
    ctx.globalAlpha = fade
    taken.length = 0
    if (fxOn('r_rare')) for (const e of ems) if (e.rare && e.on) drawRare(ctx, e, t, s)
    if (fxOn('r_shared') && o.viewer) for (const e of ems) if (e.shared && e.on) drawShareBadge(ctx, e, s)
    ctx.globalAlpha = 1
    if (cardEm) placeCard()
  }

  const drawBeam = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const col = fxColor(lead!.cat)
    const hx = o.hole.x, hy = o.hole.y, hz = o.hole.z
    const rt = .34, rb = 1.45
    const a = proj(hx - camRight.x * rt, hy, hz - camRight.z * rt), ax = a.x, ay = a.y
    const b = proj(hx + camRight.x * rt, hy, hz + camRight.z * rt), bx = b.x, by = b.y
    const c = proj(hx + camRight.x * rb, .02, hz + camRight.z * rb), cx = c.x, cy = c.y
    const d = proj(hx - camRight.x * rb, .02, hz - camRight.z * rb), dxp = d.x, dyp = d.y
    const top = (ay + by) / 2, bot = (cy + dyp) / 2
    ctx.save()
    // 밝은 땅굴 벽 위라 screen 으로 섞으면 거의 안 보임 → 대표 색을 얇게 그대로 (위가 진하고 아래로 사라짐)
    const g = ctx.createLinearGradient(0, top, 0, bot)
    g.addColorStop(0, toRgba(lighten(col, .2), .34)); g.addColorStop(.6, toRgba(col, .12)); g.addColorStop(1, toRgba(col, 0))
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dxp, dyp); ctx.closePath(); ctx.fill()
    // 바닥에 닿는 빛 웅덩이
    const f = proj(hx, .02, hz), fx = f.x, fy = f.y
    const rx = Math.abs(cx - dxp) / 2
    const fz = proj(hx, .02, hz + rb).y
    const ry = Math.max(6, Math.abs(fz - fy))
    ctx.translate(fx, fy); ctx.scale(1, ry / rx)
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    pg.addColorStop(0, toRgba(col, .26)); pg.addColorStop(1, toRgba(col, 0))
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // 떠다니는 먼지 (움직일 때만)
    if (still) return
    const n = overlay.mode.level === 'full' ? 16 : 7
    const dot = glow(lighten(col, .6), 16, .2)
    for (let i = 0; i < n; i++) {
      const ph = i * 2.399
      const u = ((t * .045 + i / n) % 1)
      const yy = hy - .2 - u * (hy - .4)
      const rr = (rt + (rb - rt) * ((hy - yy) / hy)) * (.25 + .6 * ((Math.sin(ph * 3.1) + 1) / 2))
      const ang = ph + t * .15
      const pp = proj(hx + Math.cos(ang) * rr, yy + Math.sin(t * .8 + ph) * .05, hz + Math.sin(ang) * rr * .6)
      const tw = .45 + .55 * Math.sin(t * 2.2 + ph * 5)
      ctx.globalAlpha = Math.max(0, tw) * .8 * Math.sin(u * Math.PI)
      const sz = 5 + (i % 3) * 2
      ctx.drawImage(dot, pp.x - sz / 2, pp.y - sz / 2, sz, sz)
    }
    ctx.globalAlpha = 1
    void dt
  }

  const drawShareGlow = (ctx: CanvasRenderingContext2D, e: Em, t: number) => {
    const c = proj(e.center.x, e.center.y, e.center.z), cx = c.x, cy = c.y
    const r = Math.max(34, e.half * e.ppm * 1.7)
    const k = still ? .8 : .5 + .5 * Math.sin(t * 3 + e.center.x)
    const base = ctx.globalAlpha
    // 밝은 벽 위라 screen 으로 섞으면 거의 안 보임 → 따뜻한 산호색을 그대로 얇게 (숨 쉬듯)
    ctx.save()
    ctx.globalAlpha = (.3 + .2 * k) * base
    ctx.drawImage(glow('#FF8A6A', 64, .2), cx - r, cy - r * .8, r * 2, r * 1.6)
    ctx.restore()
    // 둘레를 도는 작은 하트 셋 (움직임 없는 단계는 둘, 제자리)
    const n = still ? 2 : 3
    const g = glyph('heart', SPRITE, SHARE, overlay.mode.dpr)
    for (let i = 0; i < n; i++) {
      const a = (still ? .8 : t * 1.3) + i * Math.PI * 2 / n
      const z = 9 + 2 * Math.sin(t * 4 + i)
      ctx.globalAlpha = (.75 + .25 * Math.sin(a)) * base
      ctx.drawImage(g, cx + Math.cos(a) * r * .85 - z / 2, cy + Math.sin(a) * r * .38 - z / 2, z, z)
    }
    ctx.globalAlpha = base
  }
  /** 이번 프레임에 놓은 배지 자리 (선반 소품끼리 붙어 있어 배지가 겹치면 위로 올림) */
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = []
  const placeBadge = (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, s: number, cx: number, bottom: number) => {
    const w = cv.width / s, h = cv.height / s
    let x0 = cx - w / 2, y0 = bottom - h
    for (let k = 0; k < 4; k++) {
      const hit = taken.find((r) => x0 < r.x1 && x0 + w > r.x0 && y0 < r.y1 && y0 + h > r.y0)
      if (!hit) break
      y0 = hit.y0 - h - 1
    }
    taken.push({ x0, y0, x1: x0 + w, y1: y0 + h })
    ctx.drawImage(cv, x0, y0, w, h)
  }
  const drawShareBadge = (ctx: CanvasRenderingContext2D, e: Em, s: number) => {
    placeBadge(ctx, pill('나도!', SHARE, 'heart', '#ffffff', s), s, e.sx, e.sy - 8)
  }
  const drawRare = (ctx: CanvasRenderingContext2D, e: Em, t: number, s: number) => {
    const legend = e.rare === 'legend'
    const cx = e.center.x, cz = e.center.z
    const R = e.half + .16
    for (let i = 0; i < 6; i++) {
      const a = (still ? 0 : t * .7) + i * Math.PI / 3
      const yy = e.center.y + (i % 2 ? .12 : -.05) + (still ? 0 : Math.sin(t * 1.6 + i) * .05)
      const p = proj(cx + Math.cos(a) * R, yy, cz + Math.sin(a) * R * .7)
      const tw = still ? .8 : .45 + .55 * Math.max(0, Math.sin(t * 3.4 + i * 1.9))
      const col = legend ? RAINBOW[(i * 2 + Math.floor(t * 4)) % 12] : i % 3 ? GOLD : '#FFF1B8'
      const sz = (9 + (i % 3) * 3) * tw
      if (sz < 1) continue
      const gl = glyph('star4', SPRITE, col, s)
      ctx.drawImage(gl, p.x - sz / 2, p.y - sz / 2, sz, sz)
    }
    const text = legend ? '아주 드문 취미' : e.rare === 'rare' ? '드문 취미' : '이 방에서 가장 드문 취미'
    placeBadge(ctx, pill(text, legend ? '#B07CE0' : '#D9A22E', 'gem', '#ffffff', s), s, e.sx, e.sy - 8)
  }

  const stepParticles = (ctx: CanvasRenderingContext2D, dt: number, t: number, fade: number) => {
    const s = overlay.mode.dpr
    if (still) {
      // 움직임 없이: 주 가구 위에 작은 관심사 배지, 동물 곁에 발자국 하나
      for (const e of ems) {
        if (!e.on) continue
        if (e.kind === 'main') {
          const b = badge(e.cat, 20, e.color, s)
          ctx.drawImage(b, e.sx - b.width / s / 2, e.sy - 8 - b.height / s, b.width / s, b.height / s)
        } else if (e.kind === 'pet') {
          const p = proj(e.center.x + e.half + .25, .02, e.center.z + .1)
          const g = glyph('pet', SPRITE, e.color, s)
          ctx.save(); ctx.globalAlpha = .55 * fade; ctx.translate(p.x, p.y); ctx.scale(1, .55); ctx.drawImage(g, -8, -8, 16, 16); ctx.restore()
        }
      }
      return
    }
    const lite = overlay.mode.level === 'lite'
    const cap = overlay.mode.maxParticles
    for (const e of ems) {
      if (!e.on) continue
      if (e.kind === 'pet') {
        e.acc += dt
        if (e.acc > PET_STEP && ps.length < cap) { e.acc = 0; pawStep(e) }
        continue
      }
      if (e.kind === 'none' || (lite && e.kind === 'prop')) continue
      const rate = e.kind === 'main' ? RATE_MAIN : RATE_PROP
      e.acc += dt * rate
      while (e.acc >= 1) { e.acc -= 1; if (ps.length < cap) spawn(e, e.kind === 'prop') }
      // 사진: 가끔 큰 플래시
      if (e.cat === 'photo' && e.kind === 'main') {
        e.flashAt -= dt
        if (e.flashAt <= 0 && ps.length < cap) {
          e.flashAt = 3 + Math.random() * 3
          ps.push({ em: e, kind: 'bigflash', x: e.center.x, y: e.top.y - .15, z: e.center.z + .1, vx: 0, vy: 0, vz: 0, age: 0, life: .4, size: .9, rot: 0, vr: 0, color: '#ffffff', seed: 0 })
        }
      }
    }
    // 나와 같은 관심사: 하트
    if (fxOn('r_shared') && o.viewer && !lite) {
      for (const e of ems) {
        if (!e.shared || !e.on) continue
        e.heartAcc += dt * HEART_RATE
        if (e.heartAcc >= 1 && ps.length < cap) {
          e.heartAcc = 0
          ps.push({ em: e, kind: 'heart', x: e.top.x + (Math.random() - .5) * e.half, y: e.top.y, z: e.top.z, vx: (Math.random() - .5) * .08, vy: .3, vz: 0, age: 0, life: 1.8, size: .11, rot: 0, vr: 0, color: SHARE, seed: Math.random() * 6 })
        }
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) { ps.splice(i, 1); continue }
      if (p.kind === 'movie' || p.kind === 'craft') p.vy -= (p.kind === 'craft' ? 1.6 : 2.4) * dt
      if (p.kind !== 'paw') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt }
      p.rot += p.vr * dt
      drawParticle(ctx, p, t, fade, s)
    }
  }

  const drawParticle = (ctx: CanvasRenderingContext2D, p: P, t: number, fade: number, s: number) => {
    const u = p.age / p.life
    let a = Math.min(1, u / .15) * (u > .6 ? 1 - (u - .6) / .4 : 1)
    const sway = Math.sin(p.age * 2.6 + p.seed) * .05
    const y = p.kind === 'game' ? Math.round(p.y / .05) * .05 : p.y
    const sp = proj(p.x + (p.kind === 'music' || p.kind === 'nature' || p.kind === 'book' || p.kind === 'heart' ? sway : 0), y, p.z)
    if (!sp.ok) return
    const x = sp.x, yy = sp.y
    const px = p.size * p.em.ppm
    ctx.globalAlpha = a * fade
    switch (p.kind) {
      case 'music': case 'nature': case 'heart': {
        const g = glyph(p.kind === 'music' ? 'note' : p.kind, SPRITE, p.color, s)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot + (p.kind === 'heart' ? sway * 2 : 0)); ctx.drawImage(g, -px / 2, -px / 2, px, px); ctx.restore()
        break
      }
      case 'flash': case 'star': case 'science': {
        const tw = p.kind === 'flash' ? Math.sin(u * Math.PI) : .55 + .45 * Math.sin(p.age * 9 + p.seed)
        const z = px * tw
        const g = glyph('star4', SPRITE, p.color, s)
        ctx.drawImage(g, x - z / 2, yy - z / 2, z, z)
        break
      }
      case 'bigflash': {
        const k = Math.sin(u * Math.PI)
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k * .85 * fade
        const r = px * (.6 + u * .6)
        ctx.drawImage(glow('#ffffff', 64, .15), x - r, yy - r, r * 2, r * 2)
        const g = glyph('star4', SPRITE, '#ffffff', s)
        ctx.drawImage(g, x - r * .45, yy - r * .45, r * .9, r * .9)
        ctx.restore()
        break
      }
      case 'game': {
        // 끝 무렵 깜빡임
        if (u > .7 && Math.floor(p.age * 14) % 2) break
        const z = Math.max(2, Math.round(px))
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(x - z / 2), Math.round(yy - z / 2), z, z)
        break
      }
      case 'craft': {
        const z = px * (u > .85 ? 1 + (u - .85) * 4 : 1)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.ellipse(x, yy, z / 2, z / 2 * 1.12, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,.7)'
        ctx.beginPath(); ctx.arc(x - z * .15, yy - z * .18, z * .14, 0, Math.PI * 2); ctx.fill()
        break
      }
      case 'book': {
        const g = glyph('page', SPRITE, p.color, s)
        const fx = Math.cos(p.age * 5 + p.seed)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot); ctx.scale(Math.abs(fx) < .12 ? .12 : fx, 1)
        ctx.drawImage(g, -px / 2, -px * .62, px, px * 1.24)
        ctx.restore()
        break
      }
      case 'tea_coffee': {
        const z = px * (1 + u * 1.8)
        ctx.globalAlpha = a * .38 * fade
        const g = glow('#ffffff', 64, .2)
        const wob = Math.sin(p.age * 2.2 + p.seed) * px * .4
        ctx.drawImage(g, x - z / 2 + wob, yy - z / 2, z, z)
        break
      }
      case 'outdoor': {
        const fl = .6 + .4 * Math.sin(p.age * 22 + p.seed * 3)
        const z = px * 2.4 * fl
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(glow(p.color, 32, .35), x - z / 2, yy - z / 2, z, z)
        ctx.restore()
        break
      }
      case 'movie': {
        const g = glyph('popcorn', SPRITE, p.color, s)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot); ctx.drawImage(g, -px / 2, -px / 2, px, px); ctx.restore()
        break
      }
      case 'paw': {
        // 바닥에 찍힘: 진행 방향으로 돌리고 원근만큼 납작하게
        const ahead = proj(p.x + p.vx * .1, p.y, p.z + p.vz * .1)
        const ang = Math.atan2(ahead.y - yy, ahead.x - x) + Math.PI / 2
        a = u < .1 ? u / .1 : 1 - Math.max(0, (u - .45) / .55)
        ctx.globalAlpha = a * .75 * fade
        const g = glyph('pet', SPRITE, p.color, s)
        ctx.save(); ctx.translate(x, yy); ctx.scale(1, .55); ctx.rotate(ang); ctx.drawImage(g, -px / 2, -px / 2, px, px); ctx.restore()
        break
      }
    }
    void t
  }

  const overlay = createOverlay(o.container, o.after, camera, draw, () =>
    !o.intro() && (fxOn('r_particles') || fxOn('r_rare') || (fxOn('r_shared') && !!o.viewer) || fxOn('r_beam') || ps.length > 0))
  still = overlay.mode.level === 'still'
  const unsub = subscribeFx(() => { overlay.invalidate(); if (!fxOn('r_card')) showCard(null, null) })

  return {
    hover(g, action) {
      if (!g || !fxOn('r_card') || o.intro()) { showCard(null, null); return false }
      if (!itemsRef) measure()
      const e = ems.find((x) => x.item.g === g)
      if (!e) { showCard(null, null); return false }
      showCard(e, action)
      overlay.invalidate()
      return true
    },
    dispose() {
      unsub()
      overlay.dispose()
      card.remove()
      ps.length = 0
      void lastT
    },
  }
}
