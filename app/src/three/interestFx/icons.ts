/*
 * 관심사 아이콘·입자 그림 (docs/interest-effects.md). 모두 캔버스로 그림:
 * 이모지는 OS 마다 모양이 달라 땅굴 그림체와 안 맞고, 공유 빌드는 svg data URL 을 못 써서 (CLAUDE.md "공개 공유 검토").
 * 그림은 (이름·크기·색·배율)마다 한 번만 그려 두고 drawImage 로 찍음 → CPU 로 그리는 PC(WARP)에서도 가벼움.
 * 좌표: 글리프는 -0.5..0.5 단위 상자 안. 구멍(렌즈·d패드 등)은 destination-out 으로 뚫음 (글리프 전용 캔버스 안에서만)
 */

type Ctx = CanvasRenderingContext2D
type Draw = (c: Ctx) => void

const circle = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill() }
const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill() }
const rect = (c: Ctx, x: number, y: number, w: number, h: number) => { c.fillRect(x, y, w, h) }
const rrect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill() }
const poly = (c: Ctx, pts: [number, number][]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill() }
/** 구멍 뚫기 (이 글리프 캔버스 안에서만) */
const cut = (c: Ctx, f: Draw) => {
  c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.strokeStyle = '#000'; f(c); c.restore()
}
const strokeWith = (c: Ctx, w: number, f: Draw) => { c.save(); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle; f(c); c.restore() }

/** 발바닥 (반려동물 발자국 입자 · 반려동물·식물 배지 안 구멍) */
const paw: Draw = (c) => {
  ellipse(c, 0, 0.16, 0.22, 0.18)
  ellipse(c, -0.3, -0.06, 0.095, 0.12, -0.35); ellipse(c, -0.11, -0.27, 0.095, 0.125, -0.1)
  ellipse(c, 0.11, -0.27, 0.095, 0.125, 0.1); ellipse(c, 0.3, -0.06, 0.095, 0.12, 0.35)
}
/** 잎 (잎맥 구멍) */
const leaf: Draw = (c) => {
  c.beginPath(); c.moveTo(-0.3, 0.36); c.bezierCurveTo(-0.44, -0.06, -0.1, -0.4, 0.42, -0.42); c.bezierCurveTo(0.4, 0.06, 0.1, 0.38, -0.3, 0.36); c.fill()
  cut(c, () => { c.lineWidth = 0.055; c.beginPath(); c.moveTo(-0.24, 0.3); c.quadraticCurveTo(0.04, 0.02, 0.32, -0.32); c.stroke() })
  strokeWith(c, 0.07, () => { c.beginPath(); c.moveTo(-0.3, 0.36); c.lineTo(-0.42, 0.46); c.stroke() })
}

/**
 * 대분류 글리프 (2026-11-18 확정본 12개, 배지·말풍선·이름표) + 입자용 작은 글리프.
 * 예전 글리프를 이어 쓴 것: 음표(음악·댄스) · 카메라(사진·영상) · 게임패드 · 팔레트(미술·수공예) · 펼친 책 · 산과 해(아웃도어).
 * 새로: 김 나는 그릇(음식·음료) · 공(스포츠) · 표(문화생활) · 말풍선 A(외국어·자기계발) · 별(덕질·수집) · 발바닥이 뚫린 잎(반려동물·식물)
 */
const GLYPHS: Record<string, Draw> = {
  // 음식·음료: 김 나는 그릇
  food(c) {
    c.beginPath(); c.moveTo(-0.45, -0.02); c.lineTo(0.45, -0.02); c.bezierCurveTo(0.43, 0.26, 0.24, 0.36, 0, 0.36); c.bezierCurveTo(-0.24, 0.36, -0.43, 0.26, -0.45, -0.02); c.closePath(); c.fill()
    rrect(c, -0.17, 0.33, 0.34, 0.1, 0.03)
    strokeWith(c, 0.065, () => {
      for (const x of [-0.16, 0.08]) { c.beginPath(); c.moveTo(x, -0.11); c.bezierCurveTo(x - 0.09, -0.2, x + 0.09, -0.29, x, -0.42); c.stroke() }
    })
  },
  // 스포츠: 공 (농구공처럼 줄 구멍)
  sports(c) {
    circle(c, 0, 0, 0.43)
    cut(c, () => {
      c.lineWidth = 0.06
      c.beginPath(); c.moveTo(-0.45, 0); c.lineTo(0.45, 0); c.stroke()
      c.beginPath(); c.moveTo(0, -0.45); c.lineTo(0, 0.45); c.stroke()
      c.beginPath(); c.arc(-0.64, 0, 0.42, -0.9, 0.9); c.stroke()
      c.beginPath(); c.arc(0.64, 0, 0.42, Math.PI - 0.9, Math.PI + 0.9); c.stroke()
    })
  },
  // 문화생활: 표 (양옆 홈 + 절취선)
  culture(c) {
    c.save(); c.rotate(-0.22)
    rrect(c, -0.47, -0.27, 0.94, 0.54, 0.07)
    cut(c, () => {
      circle(c, -0.47, 0, 0.1); circle(c, 0.47, 0, 0.1)
      for (let i = 0; i < 5; i++) circle(c, 0.2, -0.2 + i * 0.1, 0.024)
      rrect(c, -0.32, -0.11, 0.38, 0.07, 0.02); rrect(c, -0.32, 0.04, 0.27, 0.07, 0.02)
    })
    c.restore()
  },
  // 게임: 게임패드
  game(c) {
    rrect(c, -0.42, -0.2, 0.84, 0.36, 0.16); circle(c, -0.27, 0.14, 0.17); circle(c, 0.27, 0.14, 0.17)
    cut(c, () => { rect(c, -0.34, -0.05, 0.17, 0.06); rect(c, -0.285, -0.105, 0.06, 0.17); circle(c, 0.2, -0.06, 0.048); circle(c, 0.31, 0.03, 0.048) })
  },
  // 음악·댄스: 들보로 이은 두 음표
  music_dance(c) {
    ellipse(c, -0.23, 0.27, 0.15, 0.11, -0.45); ellipse(c, 0.23, 0.18, 0.15, 0.11, -0.45)
    rect(c, -0.12, -0.27, 0.07, 0.54); rect(c, 0.34, -0.36, 0.07, 0.54)
    poly(c, [[-0.12, -0.27], [0.41, -0.39], [0.41, -0.26], [-0.12, -0.14]])
  },
  // 아웃도어: 산과 해
  outdoor(c) {
    poly(c, [[-0.48, 0.34], [-0.14, -0.28], [0.04, 0.02], [0.19, -0.15], [0.48, 0.34]])
    cut(c, () => poly(c, [[-0.14, -0.28], [-0.25, -0.08], [-0.18, -0.04], [-0.13, -0.11], [-0.07, -0.05], [-0.03, -0.08]]))
    circle(c, 0.31, -0.33, 0.09)
  },
  // 외국어·자기계발: 말풍선 + A
  language_selfdev(c) {
    rrect(c, -0.45, -0.4, 0.9, 0.64, 0.17)
    poly(c, [[-0.22, 0.18], [-0.3, 0.45], [0.04, 0.18]])
    cut(c, () => {
      c.lineWidth = 0.08; c.lineCap = 'round'; c.lineJoin = 'round'
      c.beginPath(); c.moveTo(-0.15, 0.1); c.lineTo(0, -0.26); c.lineTo(0.15, 0.1); c.stroke()
      c.beginPath(); c.moveTo(-0.085, -0.03); c.lineTo(0.085, -0.03); c.stroke()
    })
  },
  // 책·글: 펼친 책
  book(c) {
    c.beginPath(); c.moveTo(-0.03, -0.24); c.quadraticCurveTo(-0.22, -0.36, -0.47, -0.3); c.lineTo(-0.47, 0.3); c.quadraticCurveTo(-0.22, 0.24, -0.03, 0.36); c.closePath(); c.fill()
    c.beginPath(); c.moveTo(0.03, -0.24); c.quadraticCurveTo(0.22, -0.36, 0.47, -0.3); c.lineTo(0.47, 0.3); c.quadraticCurveTo(0.22, 0.24, 0.03, 0.36); c.closePath(); c.fill()
  },
  // 사진·영상: 카메라 (렌즈·플래시 구멍)
  photo_video(c) {
    rrect(c, -0.45, -0.2, 0.9, 0.58, 0.1); rrect(c, -0.18, -0.34, 0.32, 0.2, 0.05)
    cut(c, () => circle(c, 0, 0.08, 0.2)); circle(c, 0, 0.08, 0.11)
    cut(c, () => circle(c, 0.31, -0.08, 0.05))
  },
  // 미술·수공예: 팔레트 (엄지 구멍 + 물감 자리)
  art_craft(c) {
    ellipse(c, 0, 0.02, 0.46, 0.37, -0.2)
    cut(c, () => { circle(c, 0.21, 0.15, 0.085); circle(c, -0.2, -0.12, 0.07); circle(c, 0.03, -0.2, 0.07); circle(c, -0.25, 0.13, 0.065) })
  },
  // 덕질·수집: 둥근 별
  fandom_collect(c) {
    const pts: [number, number][] = []
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.2 : 0.44; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.04]) }
    strokeWith(c, 0.09, () => { poly(c, pts); c.stroke() })
  },
  // 반려동물·식물: 잎 안에 발바닥 구멍
  pet_plant(c) {
    c.beginPath(); c.moveTo(-0.36, 0.42); c.bezierCurveTo(-0.52, -0.06, -0.12, -0.46, 0.46, -0.47); c.bezierCurveTo(0.45, 0.08, 0.1, 0.44, -0.36, 0.42); c.fill()
    cut(c, () => { c.translate(0.03, -0.03); c.scale(0.44, 0.44); paw(c) })
  },
  // 입자용: 반려동물 발자국 · 잎 (예전 대분류 이름 그대로)
  pet: paw,
  nature: leaf,
  note(c) {
    ellipse(c, -0.12, 0.27, 0.17, 0.13, -0.45); rect(c, 0.01, -0.4, 0.075, 0.66)
    c.beginPath(); c.moveTo(0.08, -0.4); c.bezierCurveTo(0.32, -0.3, 0.36, -0.1, 0.22, 0.05); c.bezierCurveTo(0.26, -0.12, 0.18, -0.2, 0.08, -0.22); c.closePath(); c.fill()
  },
  heart(c) {
    c.beginPath(); c.moveTo(0, 0.38); c.bezierCurveTo(-0.52, 0.04, -0.4, -0.44, 0, -0.16); c.bezierCurveTo(0.4, -0.44, 0.52, 0.04, 0, 0.38); c.fill()
  },
  star4(c) {
    c.beginPath(); c.moveTo(0, -0.5); c.quadraticCurveTo(0.07, -0.07, 0.5, 0); c.quadraticCurveTo(0.07, 0.07, 0, 0.5); c.quadraticCurveTo(-0.07, 0.07, -0.5, 0); c.quadraticCurveTo(-0.07, -0.07, 0, -0.5); c.fill()
  },
  page(c) {
    rrect(c, -0.36, -0.46, 0.72, 0.92, 0.06)
    cut(c, () => { for (let i = 0; i < 4; i++) rect(c, -0.24, -0.28 + i * 0.17, i === 3 ? 0.3 : 0.48, 0.06) })
  },
  popcorn(c) { circle(c, -0.17, 0.08, 0.22); circle(c, 0.17, 0.08, 0.22); circle(c, 0, -0.15, 0.25); circle(c, 0, 0.22, 0.18) },
  gem(c) {
    poly(c, [[-0.4, -0.1], [-0.2, -0.34], [0.2, -0.34], [0.4, -0.1], [0, 0.4]])
    cut(c, () => { c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.4, -0.1); c.lineTo(0.4, -0.1); c.moveTo(-0.1, -0.34); c.lineTo(0, 0.4); c.lineTo(0.1, -0.34); c.stroke() })
  },
  // 2차 (2026-11-17 저녁): 반딧불 옆 달(방명록부터 천천히) · 알아챔 느낌표 · 관심사 등불
  moon(c) {
    circle(c, 0, 0, 0.42)
    cut(c, () => circle(c, 0.2, -0.12, 0.36))
  },
  bang(c) {
    rrect(c, -0.11, -0.46, 0.22, 0.6, 0.1); circle(c, 0, 0.36, 0.12)
  },
  lantern(c) {
    rrect(c, -0.1, -0.5, 0.2, 0.1, 0.03); rrect(c, -0.26, -0.42, 0.52, 0.08, 0.03)
    ellipse(c, 0, 0.02, 0.36, 0.38)
    rrect(c, -0.26, 0.36, 0.52, 0.08, 0.03)
    cut(c, () => { c.lineWidth = 0.045; for (const x of [-0.13, 0.13]) { c.beginPath(); c.ellipse(x * 0.6, 0.02, Math.abs(x) + 0.04, 0.34, 0, 0, Math.PI * 2); c.stroke() } })
  },
}

/** 그릴 수 있는 글리프 이름 (시험용: 모든 대분류에 글리프가 있는지) */
export const GLYPH_NAMES: readonly string[] = Object.keys(GLYPHS)

const cache = new Map<string, HTMLCanvasElement>()
const canvas = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv }

/** 글리프 하나 (px = CSS 크기, s = 배율). 그림 크기는 px*s */
export function glyph(name: string, px: number, color: string, s = 1): HTMLCanvasElement {
  const key = `g|${name}|${px}|${color}|${s}`
  let cv = cache.get(key)
  if (cv) return cv
  const n = px * s
  cv = canvas(n + 2, n + 2)
  const c = cv.getContext('2d')!
  c.translate(cv.width / 2, cv.height / 2); c.scale(n, n)
  c.fillStyle = color
  ;(GLYPHS[name] ?? GLYPHS.star4)(c)
  cache.set(key, cv)
  return cv
}

/** 동그란 배지: 카테고리 색 원 + 흰 글리프 (+ 흰 테두리) */
export function badge(cat: string, px: number, color: string, s = 1): HTMLCanvasElement {
  const key = `b|${cat}|${px}|${color}|${s}`
  let cv = cache.get(key)
  if (cv) return cv
  const n = px * s
  cv = canvas(n + 4 * s, n + 4 * s)
  const c = cv.getContext('2d')!
  const m = cv.width / 2
  c.fillStyle = '#fbf8f4'; circle(c, m, m, n / 2 + 1.5 * s)
  c.fillStyle = color; circle(c, m, m, n / 2 - 0.5 * s)
  const g = glyph(cat, Math.round(px * 0.62), '#ffffff', s)
  c.drawImage(g, m - g.width / 2, m - g.height / 2)
  cache.set(key, cv)
  return cv
}

/**
 * 말풍선 (탐색 들판 구멍 위): 크림색 원 + 카테고리 색 테두리 + 아래 꼬리 + 카테고리 색 글리프.
 * 꼬리 끝이 그림 아래 가운데 (tipY = 그림 높이 - 여백)
 */
export function bubble(cat: string, px: number, color: string, s = 1): { cv: HTMLCanvasElement; tip: number } {
  const key = `u|${cat}|${px}|${color}|${s}`
  const pad = 3 * s, tail = 7 * s, r = (px * s) / 2
  let cv = cache.get(key)
  if (!cv) {
    cv = canvas(px * s + pad * 2, px * s + tail + pad * 2)
    const c = cv.getContext('2d')!
    const cx = cv.width / 2, cy = pad + r
    c.shadowColor = 'rgba(60,35,20,.28)'; c.shadowBlur = 4 * s; c.shadowOffsetY = 1.5 * s
    c.fillStyle = '#fbf8f4'
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.moveTo(cx - 5 * s, cy + r - 2 * s); c.lineTo(cx, cy + r + tail); c.lineTo(cx + 5 * s, cy + r - 2 * s); c.closePath(); c.fill()
    c.shadowColor = 'transparent'
    c.lineWidth = 2.4 * s; c.strokeStyle = color
    c.beginPath(); c.arc(cx, cy, r - 1.2 * s, 0, Math.PI * 2); c.stroke()
    const g = glyph(cat, Math.round(px * 0.6), color, s)
    c.drawImage(g, cx - g.width / 2, cy - g.height / 2)
    cache.set(key, cv)
  }
  return { cv, tip: cv.height - pad }
}

/**
 * 스티커 글리프 (2차): 흰 테두리 + 아래 옅은 그림자. 밝은 흙벽·어두운 가구 어느 쪽 위에서도 입자 모양이 읽히게.
 * 그림 크기 = (px + 2·STICKER_PAD) · s, 글리프는 가운데 px·s. 그릴 때 sizeOf 로 맞춤
 */
export const STICKER_PAD = 3
export function sticker(name: string, px: number, color: string, s = 1): HTMLCanvasElement {
  const key = `k|${name}|${px}|${color}|${s}`
  let cv = cache.get(key)
  if (cv) return cv
  const pad = STICKER_PAD * s
  const g = glyph(name, px, color, s), w = glyph(name, px, '#fffaf2', s)
  cv = canvas(g.width + pad * 2, g.height + pad * 2)
  const c = cv.getContext('2d')!
  const o = 1.35 * s
  c.shadowColor = 'rgba(60,35,20,.42)'; c.shadowBlur = 2.2 * s; c.shadowOffsetY = 0.9 * s
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.drawImage(w, pad + Math.cos(a) * o, pad + Math.sin(a) * o) }
  c.shadowColor = 'transparent'
  c.drawImage(g, pad, pad)
  cache.set(key, cv)
  return cv
}
/** 스티커를 글리프 크기 z 로 그릴 때 실제 그림 크기 */
export const stickerSize = (z: number, px: number) => z * (px + 2 + STICKER_PAD * 2) / (px + 2)

/**
 * 이름표 알약 (2차): [카테고리 배지] 글자. 땅굴 입장 이름표·요약 줄 불 켜기·인사 퐁·들판 등불에 같이 씀.
 * 그림은 (글자·색·배율)마다 한 번만 그림. h = CSS 높이
 */
export interface TagOpts { text: string; bg?: string; fg?: string; cat?: string; catColor?: string; icon?: string; iconColor?: string; s?: number; h?: number; bold?: boolean; border?: string }
export function tag(o: TagOpts): HTMLCanvasElement {
  const s = o.s ?? 1, h = (o.h ?? 22) * s
  const key = `t|${o.text}|${o.bg}|${o.fg}|${o.cat}|${o.catColor}|${o.icon}|${o.iconColor}|${s}|${o.h}|${o.border}`
  let cv = cache.get(key)
  if (cv) return cv
  const font = `${o.bold === false ? 600 : 700} ${Math.round(h * 0.52)}px Pretendard, 'Pretendard Variable', system-ui, sans-serif`
  const m = document.createElement('canvas').getContext('2d')!
  m.font = font
  const tw = Math.ceil(m.measureText(o.text).width)
  const hasIcon = !!(o.cat || o.icon)
  const iw = hasIcon ? h - 4 * s : 0
  const padL = hasIcon ? 3 * s : h * 0.42, gap = hasIcon ? 5 * s : 0, padR = h * 0.42
  const w = padL + iw + gap + tw + padR
  const sh = 3 * s
  cv = canvas(w + sh * 2, h + sh * 2 + s)
  const c = cv.getContext('2d')!
  c.shadowColor = 'rgba(60,35,20,.3)'; c.shadowBlur = 3.5 * s; c.shadowOffsetY = 1 * s
  c.fillStyle = o.bg ?? '#fbf8f4'
  c.beginPath(); c.roundRect(sh, sh, w, h, h / 2); c.fill()
  c.shadowColor = 'transparent'
  if (o.border) { c.lineWidth = 1.6 * s; c.strokeStyle = o.border; c.beginPath(); c.roundRect(sh + 0.8 * s, sh + 0.8 * s, w - 1.6 * s, h - 1.6 * s, h / 2 - 0.8 * s); c.stroke() }
  let x = sh + padL
  if (o.cat) {
    const b = badge(o.cat, Math.round((iw - 2 * s) / s), o.catColor ?? '#C8643A', s)
    c.drawImage(b, x + iw / 2 - b.width / 2, sh + h / 2 - b.height / 2)
  } else if (o.icon) {
    const g = glyph(o.icon, Math.round(iw / s * 0.78), o.iconColor ?? '#ffffff', s)
    c.drawImage(g, x + iw / 2 - g.width / 2, sh + h / 2 - g.height / 2)
  }
  x += iw + gap
  c.font = font; c.fillStyle = o.fg ?? '#3e2a1f'; c.textBaseline = 'middle'
  c.fillText(o.text, x, sh + h / 2 + 0.5 * s)
  cache.set(key, cv)
  return cv
}

/** 부드러운 빛 덩어리 (가운데 color, 바깥 투명). 연기·후광·불티에 씀 */
export function glow(color: string, px = 64, core = 0.35): HTMLCanvasElement {
  const key = `w|${color}|${px}|${core}`
  let cv = cache.get(key)
  if (cv) return cv
  cv = canvas(px, px)
  const c = cv.getContext('2d')!
  const g = c.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
  // 바깥 색은 같은 색의 투명 (흰색 투명으로 섞으면 테두리가 뿌옇게 밝아짐)
  g.addColorStop(0, color); g.addColorStop(core, toRgba(color, 0.55)); g.addColorStop(1, toRgba(color, 0))
  c.fillStyle = g; c.fillRect(0, 0, px, px)
  cache.set(key, cv)
  return cv
}

/** '#rrggbb' → rgba 문자열 */
export function toRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
/** 흰색 쪽으로 섞기 (0 = 그대로, 1 = 흰색) */
export function lighten(hex: string, k: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  const mix = (v: number) => Math.round(v + (255 - v) * k)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** 시험용: 캐시를 비움 (장면을 오래 오가도 수백 개를 넘지 않지만 정리할 때) */
export function iconCacheSize() { return cache.size }
