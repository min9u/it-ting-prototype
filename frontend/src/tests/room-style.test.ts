/**
 * 땅굴 다양성 2단계: 대분류 색 묶음 · 자동 꾸미기 (data/roomStyle.ts, data/roomLook.ts, three/roomStyle.ts 의 AgX 거꾸로)
 * 근거: docs/room-diversity-2-2026-11-18.md 2단계 (요청 "관심사가 다른 사람끼리 들어가자마자 다른 방")
 */
import { describe, expect, it } from 'vitest'
import { CATEGORY_THEMES, PALETTE_KEYS, STYLE_VERSION, autoStyle, autoStyleFor, hashSeed, themeOf } from '../data/roomStyle'
import { INTEREST_CATS, INTEREST_SUBS } from '../data/interests'
import { roomLookOf } from '../data/roomLook'
import { agx, agxInverse, linOf } from '../three/roomStyle'

const hexes = (o: object) => JSON.stringify(o).match(/#[0-9A-Fa-f]{6}/g) ?? []
/** sRGB 색 → [색상(도), 채도, 명도] */
function hsv(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]
}

describe('대분류 12개 색 묶음', () => {
  it('대분류마다 하나씩, 껍데기(벽·바닥·나무) 색이 모두 있음', () => {
    expect(Object.keys(CATEGORY_THEMES).sort()).toEqual(INTEREST_CATS.map((c) => c.id).sort())
    for (const t of Object.values(CATEGORY_THEMES)) {
      expect(t.shell, t.id).toBeDefined()
      for (const h of hexes(t)) expect(h, t.id).toMatch(/^#[0-9A-F]{6}$/)
      for (const k of PALETTE_KEYS) expect(t.colors[k], `${t.id} ${k}`).toBeTruthy()
    }
  })
  it('벽 · 바닥이 대분류끼리 서로 다름 (어떤 두 묶음도 벽 · 바닥 색 차이 ΔE76 를 합쳐 25 이상, 비교 도구의 "다름" 기준은 10)', () => {
    const lab = (h: string) => {
      const [r, g, b] = linOf(h)
      const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
      return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
    }
    const sh = Object.values(CATEGORY_THEMES).map((t) => [t.id, [...lab(t.shell!.wall), ...lab(t.shell!.floor)]] as const)
    for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) {
      const d = Math.hypot(...sh[i][1].map((v, k) => v - sh[j][1][k]))
      expect(d, `${sh[i][0]} ~ ${sh[j][0]}`).toBeGreaterThan(25)
    }
  })
  it('같은 가구 세트를 빌려 쓰는 대분류끼리도 벽 · 바닥 · 러그가 다름 (운동장 ≠ 캠핑장, 공부방 ≠ 서재)', () => {
    for (const [a, b] of [['sports', 'outdoor'], ['language_selfdev', 'book']]) {
      const A = CATEGORY_THEMES[a], B = CATEGORY_THEMES[b]
      expect(A.shell!.wall).not.toBe(B.shell!.wall)
      expect(A.shell!.floor).not.toBe(B.shell!.floor)
      expect(A.rug).not.toBe(B.rug)
    }
  })
  it('가구 팔레트는 자리마다 색 계열을 지킴: green 은 초록 계열(잎·화분), sky 는 파랑·청록(어항 물)', () => {
    for (const t of Object.values(CATEGORY_THEMES)) {
      const [gh] = hsv(t.colors.green), [sh] = hsv(t.colors.sky)
      expect(gh, `${t.id} green ${t.colors.green}`).toBeGreaterThanOrEqual(60); expect(gh).toBeLessThan(180)
      expect(sh, `${t.id} sky ${t.colors.sky}`).toBeGreaterThan(160); expect(sh).toBeLessThan(260)
    }
  })
})

describe('자동 꾸미기 (씨앗 = 집주인 id)', () => {
  it('같은 사람은 늘 같은 방 (결정적)', () => {
    expect(autoStyleFor('yerin', 'outdoor')).toEqual(autoStyleFor('yerin', 'outdoor'))
    expect(autoStyle(hashSeed('a'), 'cat_book')).toEqual(autoStyle(hashSeed('a'), 'cat_book'))
  })
  it('대표 관심사가 없으면 꾸미기 없음 (디자이너 원래 모습)', () => {
    expect(autoStyleFor('x', null)).toBeNull()
    expect(roomLookOf('x', []).style).toBeNull()
  })
  it('대표 관심사 대분류의 묶음을 씀, 같은 대분류도 사람마다 이불·러그·모양이 다름', () => {
    const cafe = INTEREST_SUBS.find((s) => s.id === 'cafe_coffee')!.name_ko
    const looks = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id) => roomLookOf(id, [cafe]).style!)
    for (const s of looks) expect(s.theme).toBe('cat_food')
    expect(new Set(looks.map((s) => JSON.stringify(s))).size).toBe(6)
  })
  it('저사양: 자동 꾸미기는 도자기 · 금속 마감(방 환경맵을 따로 만듦)을 쓰지 않음', () => {
    for (let i = 0; i < 300; i++) {
      const s = autoStyle(hashSeed(`p${i}`), Object.values(CATEGORY_THEMES)[i % 12].id)
      const fins = Object.values(s.parts).flatMap((p) => Object.values(p).map((x) => x.finish)).filter(Boolean)
      for (const f of fins) expect(['clay', 'velvet', 'felt']).toContain(f)
    }
  })
  it('집주인이 고른 색 테마가 먼저 (base = 디자이너 원래 색)', () => {
    const cafe = INTEREST_SUBS.find((s) => s.id === 'cafe_coffee')!.name_ko
    expect(roomLookOf('u1', [cafe], { wallpaperId: null, furniture: {}, themeId: 'cat_game' }).style!.theme).toBe('cat_game')
    expect(roomLookOf('u1', [cafe], { wallpaperId: null, furniture: {}, themeId: 'base' }).style).toBeNull()
    expect(roomLookOf('u1', [cafe], { wallpaperId: null, furniture: {}, themeId: 'no-such' }).style!.theme).toBe('cat_food')
  })
  it('꾸미기 값 판(STYLE_VERSION)이 있음 (구운 방 그림 캐시 키에 들어감)', () => {
    expect(STYLE_VERSION).toBeGreaterThanOrEqual(2)
    expect(themeOf('cat_book').name).toBe('다락 서재 무드')
  })
})

describe('AgX 거꾸로 (three/roomStyle.ts): 원하는 화면 색이 나오는 빛 값', () => {
  it('모든 묶음의 벽·바닥·나무 색을 거꾸로 풀어 다시 AgX 에 넣으면 화면 색이 2/255 안으로 같음', () => {
    const all = new Set(Object.values(CATEGORY_THEMES).flatMap((t) => [t.shell!.wall, t.shell!.floor, t.shell!.wood, t.floorAlt!, t.wallAlt!]))
    for (const h of [...all, '#E4B995', '#D49E78', '#DDB08A']) {
      const back = agx(agxInverse(h)).map((v) => (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055) * 255)
      const want = linOf(h).map((v) => (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055) * 255)
      for (let k = 0; k < 3; k++) expect(Math.abs(back[k] - want[k]), `${h}[${k}]`).toBeLessThan(2)
    }
  })
})
