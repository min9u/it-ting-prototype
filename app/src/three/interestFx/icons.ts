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

/** 카테고리 글리프 + 입자용 작은 글리프 */
const GLYPHS: Record<string, Draw> = {
  // 음악: 들보로 이은 두 음표
  music(c) {
    ellipse(c, -0.23, 0.27, 0.15, 0.11, -0.45); ellipse(c, 0.23, 0.18, 0.15, 0.11, -0.45)
    rect(c, -0.12, -0.27, 0.07, 0.54); rect(c, 0.34, -0.36, 0.07, 0.54)
    poly(c, [[-0.12, -0.27], [0.41, -0.39], [0.41, -0.26], [-0.12, -0.14]])
  },
  // 사진: 카메라 (렌즈·플래시 구멍)
  photo(c) {
    rrect(c, -0.45, -0.2, 0.9, 0.58, 0.1); rrect(c, -0.18, -0.34, 0.32, 0.2, 0.05)
    cut(c, () => circle(c, 0, 0.08, 0.2)); circle(c, 0, 0.08, 0.11)
    cut(c, () => circle(c, 0.31, -0.08, 0.05))
  },
  // 자연·식물: 잎 (잎맥 구멍)
  nature(c) {
    c.beginPath(); c.moveTo(-0.3, 0.36); c.bezierCurveTo(-0.44, -0.06, -0.1, -0.4, 0.42, -0.42); c.bezierCurveTo(0.4, 0.06, 0.1, 0.38, -0.3, 0.36); c.fill()
    cut(c, () => { c.lineWidth = 0.055; c.beginPath(); c.moveTo(-0.24, 0.3); c.quadraticCurveTo(0.04, 0.02, 0.32, -0.32); c.stroke() })
    strokeWith(c, 0.07, () => { c.beginPath(); c.moveTo(-0.3, 0.36); c.lineTo(-0.42, 0.46); c.stroke() })
  },
  // 게임·놀이: 게임패드
  game(c) {
    rrect(c, -0.42, -0.2, 0.84, 0.36, 0.16); circle(c, -0.27, 0.14, 0.17); circle(c, 0.27, 0.14, 0.17)
    cut(c, () => { rect(c, -0.34, -0.05, 0.17, 0.06); rect(c, -0.285, -0.105, 0.06, 0.17); circle(c, 0.2, -0.06, 0.048); circle(c, 0.31, 0.03, 0.048) })
  },
  // 공예·만들기: 팔레트 (엄지 구멍 + 물감 자리)
  craft(c) {
    ellipse(c, 0, 0.02, 0.46, 0.37, -0.2)
    cut(c, () => { circle(c, 0.21, 0.15, 0.085); circle(c, -0.2, -0.12, 0.07); circle(c, 0.03, -0.2, 0.07); circle(c, -0.25, 0.13, 0.065) })
  },
  // 책·글: 펼친 책
  book(c) {
    c.beginPath(); c.moveTo(-0.03, -0.24); c.quadraticCurveTo(-0.22, -0.36, -0.47, -0.3); c.lineTo(-0.47, 0.3); c.quadraticCurveTo(-0.22, 0.24, -0.03, 0.36); c.closePath(); c.fill()
    c.beginPath(); c.moveTo(0.03, -0.24); c.quadraticCurveTo(0.22, -0.36, 0.47, -0.3); c.lineTo(0.47, 0.3); c.quadraticCurveTo(0.22, 0.24, 0.03, 0.36); c.closePath(); c.fill()
  },
  // 우주·과학: 고리 행성
  science(c) {
    strokeWith(c, 0.075, () => { c.beginPath(); c.ellipse(0, 0.02, 0.47, 0.14, -0.35, Math.PI, Math.PI * 2); c.stroke() })
    circle(c, 0, 0.02, 0.25)
    cut(c, () => { c.lineWidth = 0.16; c.beginPath(); c.ellipse(0, 0.02, 0.47, 0.14, -0.35, 0.15, Math.PI - 0.15); c.stroke() })
    strokeWith(c, 0.075, () => { c.beginPath(); c.ellipse(0, 0.02, 0.47, 0.14, -0.35, 0, Math.PI); c.stroke() })
  },
  // 차·커피·베이킹: 김 나는 잔
  tea_coffee(c) {
    c.beginPath(); c.moveTo(-0.34, -0.04); c.lineTo(0.24, -0.04); c.lineTo(0.19, 0.28); c.quadraticCurveTo(0.17, 0.37, 0.08, 0.37); c.lineTo(-0.22, 0.37); c.quadraticCurveTo(-0.3, 0.37, -0.31, 0.28); c.closePath(); c.fill()
    strokeWith(c, 0.065, () => { c.beginPath(); c.arc(0.26, 0.12, 0.1, -Math.PI / 2, Math.PI / 2); c.stroke() })
    strokeWith(c, 0.06, () => {
      for (const x of [-0.17, 0.04]) { c.beginPath(); c.moveTo(x, -0.13); c.bezierCurveTo(x - 0.09, -0.21, x + 0.09, -0.3, x, -0.42); c.stroke() }
    })
  },
  // 운동·아웃도어: 산과 해
  outdoor(c) {
    poly(c, [[-0.48, 0.34], [-0.14, -0.28], [0.04, 0.02], [0.19, -0.15], [0.48, 0.34]])
    cut(c, () => poly(c, [[-0.14, -0.28], [-0.25, -0.08], [-0.18, -0.04], [-0.13, -0.11], [-0.07, -0.05], [-0.03, -0.08]]))
    circle(c, 0.31, -0.33, 0.09)
  },
  // 영화·애니: 슬레이트
  movie(c) {
    rrect(c, -0.42, -0.04, 0.84, 0.42, 0.05)
    c.save(); c.translate(-0.42, -0.08); c.rotate(-0.26)
    rrect(c, 0, -0.15, 0.84, 0.15, 0.03)
    cut(c, () => { for (let i = 0; i < 4; i++) { const x = 0.08 + i * 0.2; poly(c, [[x, -0.15], [x + 0.09, -0.15], [x + 0.03, 0], [x - 0.06, 0]]) } })
    c.restore()
    cut(c, () => rect(c, -0.42, 0.05, 0.84, 0.04))
  },
  // 반려동물: 발바닥
  pet(c) {
    ellipse(c, 0, 0.16, 0.22, 0.18)
    ellipse(c, -0.3, -0.06, 0.095, 0.12, -0.35); ellipse(c, -0.11, -0.27, 0.095, 0.125, -0.1)
    ellipse(c, 0.11, -0.27, 0.095, 0.125, 0.1); ellipse(c, 0.3, -0.06, 0.095, 0.12, 0.35)
  },
  // 입자용
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
}

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
