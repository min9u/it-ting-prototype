/**
 * 땅굴 꾸미기 다양성 (2026-11-16 실험, docs/burrow-diversity.md)
 * three.js 없이 데이터만: 저장할 모양(RoomStyle), 색 테마, 견본 색, 무늬, 마감, 모양 옵션, 자동(시드) 꾸미기.
 * 3D 적용은 three/roomStyle.ts
 *
 * 바탕: 디자이너 가구 glb 는 전부 같은 팔레트 재질 8개(M_cream·M_green·M_orange·M_sky·M_yellow·M_wood_light·M_wood_dark·M_stone)를
 * 단색으로 쓰고 AO 만 텍스처로 구워 둠 → 재질 색만 바꿔도 음영은 그대로 남음. 가구마다 이 "색 자리"가 2~7개
 */

/** 팔레트 색 자리 (glb 재질 이름 M_<key>) */
export type PaletteKey = 'cream' | 'green' | 'orange' | 'sky' | 'yellow' | 'wood_light' | 'wood_dark' | 'stone'
export const PALETTE_KEYS: PaletteKey[] = ['cream', 'green', 'orange', 'sky', 'yellow', 'wood_light', 'wood_dark', 'stone']
export const SLOT_NAME: Record<PaletteKey, string> = {
  cream: '크림', green: '초록', orange: '주황', sky: '하늘', yellow: '노랑', wood_light: '밝은 나무', wood_dark: '어두운 나무', stone: '돌',
}

export interface ColorTheme { id: string; name: string; note: string; colors: Record<PaletteKey, string> }

/** 디자이너 원래 색 (glb baseColorFactor 를 sRGB 로. 둥근 블록 색 BLOCK_COLORS 와 같음) */
const BASE: Record<PaletteKey, string> = {
  cream: '#F7E6C8', green: '#8CC56A', orange: '#E8743B', sky: '#A8D4EE', yellow: '#F5C452', wood_light: '#C98A5A', wood_dark: '#A86B45', stone: '#9C8681',
}

/**
 * 방 색 테마: 8자리를 한꺼번에 바꿈 → 방 안 가구가 다 같이 어울리게 바뀜.
 * 점토 느낌이 깨지지 않게 채도는 원래 팔레트 수준, 나무 두 자리는 밝기 차이를 유지
 */
export const THEMES: ColorTheme[] = [
  { id: 'base', name: '기본', note: '디자이너 원래 색', colors: BASE },
  { id: 'pastel', name: '봄 파스텔', note: '분홍·연두·하늘', colors: { cream: '#FBEFEA', green: '#B5DDA4', orange: '#F2A49B', sky: '#BBD8F4', yellow: '#F8DE96', wood_light: '#E2BFA0', wood_dark: '#C0907A', stone: '#B9A9A6' } },
  { id: 'forest', name: '숲속', note: '이끼·버섯·나무', colors: { cream: '#EADCBF', green: '#5F8F45', orange: '#C2513A', sky: '#93B8A4', yellow: '#D7AE45', wood_light: '#A06D45', wood_dark: '#6B4630', stone: '#7E7466' } },
  { id: 'night', name: '밤하늘', note: '남색·보라·별빛', colors: { cream: '#E2DCF0', green: '#6FA394', orange: '#8C74CF', sky: '#4762A8', yellow: '#F4C751', wood_light: '#8E7290', wood_dark: '#56425F', stone: '#6E6A80' } },
  { id: 'retro', name: '레트로', note: '겨자·올리브·청록', colors: { cream: '#F2E1BE', green: '#87963A', orange: '#D45A2A', sky: '#2F8F8E', yellow: '#E5A42C', wood_light: '#B5733E', wood_dark: '#6E4128', stone: '#8D7A68' } },
  { id: 'sea', name: '바닷가', note: '파랑·산호·유목', colors: { cream: '#F5F2EB', green: '#62B5A6', orange: '#F0876A', sky: '#4A8ED4', yellow: '#F5D37B', wood_light: '#D6C1A0', wood_dark: '#9D8A72', stone: '#A9A7A0' } },
  { id: 'berry', name: '딸기우유', note: '딸기·분홍·크림', colors: { cream: '#FFF1EE', green: '#9BCB8D', orange: '#E5566D', sky: '#F5B5C4', yellow: '#FAD7A4', wood_light: '#E5B6A0', wood_dark: '#B37868', stone: '#C3A3A0' } },
  { id: 'cafe', name: '카페', note: '진한 원목·크림·초록', colors: { cream: '#F1E6D3', green: '#4F6E4A', orange: '#A24C30', sky: '#7F9DA8', yellow: '#CB9B48', wood_light: '#7E5236', wood_dark: '#4A2F22', stone: '#6E6058' } },
  { id: 'mono', name: '차분한 크림', note: '색을 줄인 무채색', colors: { cream: '#F4EEE5', green: '#B9B59D', orange: '#C99273', sky: '#BAC0C3', yellow: '#E3D0A8', wood_light: '#CBB094', wood_dark: '#8F7664', stone: '#A29A92' } },
]
export const themeOf = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0]

/** 칠하기 견본 색 (점토 느낌에 맞춘 24색) */
export const SWATCHES = [
  '#FFF6EA', '#F7E6C8', '#EAD3AE', '#C9B79C', '#8F7F70', '#4E4440',
  '#F7B8B8', '#F2A49B', '#E8743B', '#E5566D', '#C2513A', '#8C3B3B',
  '#F8DE96', '#F5C452', '#D7AE45', '#B5DDA4', '#8CC56A', '#4F7E45',
  '#A8D4EE', '#4A8ED4', '#2F5D9C', '#C7B6EC', '#8C74CF', '#56425F',
]
/** 나무 결 색 (밝은 나무·어두운 나무 자리에 먼저 보여 줌) */
export const WOOD_SWATCHES = ['#EAD0AE', '#D6B48A', '#C98A5A', '#A86B45', '#7E5236', '#5B3A28', '#3E2A22', '#B9A089']

export type PatternKind = 'none' | 'stripe' | 'dot' | 'check' | 'gingham' | 'zigzag' | 'flower'
export const PATTERNS: { id: PatternKind; name: string }[] = [
  { id: 'none', name: '없음' }, { id: 'stripe', name: '줄무늬' }, { id: 'dot', name: '물방울' }, { id: 'check', name: '체크' },
  { id: 'gingham', name: '깅엄' }, { id: 'zigzag', name: '지그재그' }, { id: 'flower', name: '꽃' },
]
/** 무늬 크기: 1m 에 몇 칸 */
export const PATTERN_SIZES = [{ id: 'S', name: '작게', cells: 18 }, { id: 'M', name: '보통', cells: 11 }, { id: 'L', name: '크게', cells: 6 }] as const
export type PatternSize = (typeof PATTERN_SIZES)[number]['id']

export type FinishKind = 'clay' | 'gloss' | 'velvet' | 'metal' | 'felt'
export const FINISHES: { id: FinishKind; name: string; note: string }[] = [
  { id: 'clay', name: '점토', note: '기본 무광' },
  { id: 'gloss', name: '도자기', note: '반질반질 코팅' },
  { id: 'velvet', name: '벨벳', note: '가장자리가 보송' },
  { id: 'felt', name: '펠트', note: '아주 무광, 보풀' },
  { id: 'metal', name: '금속', note: '반짝이는 쇠' },
]

export interface PatternStyle { kind: PatternKind; color: string; size: PatternSize }
/** 가구 하나의 색 자리 하나 */
export interface PartStyle { color?: string; pattern?: PatternStyle; finish?: FinishKind }

/** 저장할 모양 (사용자 프로필 room_style 로 서버에 그대로 저장한다고 가정. 수백 바이트) */
export interface RoomStyle {
  /** 색 테마 id */
  theme: string
  /** 가구 id → 색 자리(팔레트 자리, 덧붙이는 head·cloth·tassel) → 덮어쓰기 */
  parts: Record<string, Record<string, PartStyle>>
  /** 기본 가구 id → 모양 옵션 묶음 id → 고른 값 id */
  shape: Record<string, Record<string, string>>
  /** 러그 (껍데기에 구워진 그림이라 색은 밝기를 살려 다시 칠함) */
  rug?: { color?: string; pattern?: PatternStyle }
}
export const EMPTY_STYLE: RoomStyle = { theme: 'base', parts: {}, shape: {} }

/*
 * 모양 옵션 (기본 가구 6개는 모든 땅굴에 똑같이 있어서 "다 똑같아 보임"의 주범 → 여기를 우선 바꿈)
 * 새 모델 없이: 크기·비율 바꾸기, 부품 숨기기·복제, 점토 덧붙이(코드로 만든 둥근 조각, 같은 팔레트 재질)
 */
export interface ShapeChoice { id: string; name: string }
export interface ShapeGroup { id: string; name: string; choices: ShapeChoice[] }
export const SHAPE_OPTIONS: Record<string, ShapeGroup[]> = {
  bed: [
    { id: 'size', name: '크기', choices: [{ id: 'base', name: '기본' }, { id: 'low', name: '낮게' }, { id: 'big', name: '크게' }] },
    { id: 'head', name: '머리판', choices: [{ id: 'none', name: '없음' }, { id: 'round', name: '둥근' }, { id: 'arch', name: '아치' }, { id: 'cloud', name: '구름' }, { id: 'bumps', name: '봉긋' }] },
    { id: 'pillow', name: '베개', choices: [{ id: 'one', name: '하나' }, { id: 'two', name: '둘' }, { id: 'none', name: '없음' }] },
  ],
  nightstand: [
    { id: 'cap', name: '버섯 갓', choices: [{ id: 'base', name: '기본' }, { id: 'flat', name: '납작 표고' }, { id: 'cone', name: '고깔' }, { id: 'tiny', name: '아기 버섯' }] },
    { id: 'body', name: '협탁', choices: [{ id: 'base', name: '기본' }, { id: 'tall', name: '높게' }, { id: 'wide', name: '넓게' }] },
  ],
  round_table: [
    { id: 'cloth', name: '테이블보', choices: [{ id: 'none', name: '없음' }, { id: 'plain', name: '민무늬' }, { id: 'gingham', name: '깅엄' }, { id: 'lace', name: '레이스' }] },
    { id: 'set', name: '찻잔', choices: [{ id: 'all', name: '주전자+컵' }, { id: 'cups', name: '컵만' }, { id: 'none', name: '비우기' }] },
    { id: 'size', name: '크기', choices: [{ id: 'base', name: '기본' }, { id: 'low', name: '좌식' }, { id: 'big', name: '넓게' }] },
  ],
  cushion_sky: [
    { id: 'puff', name: '두께', choices: [{ id: 'base', name: '기본' }, { id: 'thick', name: '두툼' }, { id: 'flat', name: '납작' }] },
    { id: 'tassel', name: '술', choices: [{ id: 'none', name: '없음' }, { id: 'on', name: '네 귀퉁이' }] },
  ],
  cushion_yellow: [
    { id: 'puff', name: '두께', choices: [{ id: 'base', name: '기본' }, { id: 'thick', name: '두툼' }, { id: 'flat', name: '납작' }] },
    { id: 'tassel', name: '술', choices: [{ id: 'none', name: '없음' }, { id: 'on', name: '네 귀퉁이' }] },
  ],
  ceiling_lamp: [
    { id: 'cap', name: '갓', choices: [{ id: 'base', name: '기본' }, { id: 'wide', name: '넓적' }, { id: 'bell', name: '종 모양' }] },
  ],
}
export const shapeOf = (s: RoomStyle, id: string, group: string) => s.shape[id]?.[group] ?? SHAPE_OPTIONS[id]?.find((g) => g.id === group)?.choices[0].id ?? 'base'

/* ===== 자동 꾸미기 (시드): 아무것도 안 꾸민 땅굴도 집집마다 다르게 ===== */

/** 문자열 → 32비트 씨앗 (FNV-1a) */
export function hashSeed(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
/** 씨앗 → 0~1 난수 (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 씨앗 하나로 테마 + 기본 가구 모양 + 이불·방석·러그 무늬를 고름.
 * 색은 고른 테마 안의 색만 써서(어울림 보장) 이불처럼 넓은 면만 한두 군데 다른 자리 색으로 바꿈
 */
export function autoStyle(seed: number): RoomStyle {
  const r = rng(seed)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  // 기본(디자이너 색)은 꾸미기 없는 집과 같아 보여서 자동에서는 뺌
  const theme = pick(THEMES.slice(1))
  const c = theme.colors
  const accents: PaletteKey[] = ['green', 'orange', 'sky', 'yellow']
  const s: RoomStyle = { theme: theme.id, parts: {}, shape: {} }
  // 모양: 묶음마다 하나씩 (첫 번째 = 기본이 조금 더 자주 나오게)
  for (const [id, groups] of Object.entries(SHAPE_OPTIONS)) {
    for (const g of groups) {
      const i = r() < .3 ? 0 : Math.floor(r() * g.choices.length)
      if (i) (s.shape[id] ??= {})[g.id] = g.choices[i].id
    }
  }
  const pat = (kind: PatternKind, color: string): PatternStyle => ({ kind, color, size: pick(['S', 'M', 'L'] as const) })
  const fabric: PatternKind[] = ['stripe', 'dot', 'check', 'gingham', 'zigzag', 'flower']
  // 이불(초록 자리): 다른 강조색으로 바꾸고, 반쯤은 무늬
  const quilt = pick(accents)
  s.parts.bed = { green: { color: c[quilt], ...(r() < .6 ? { pattern: pat(pick(fabric), c.cream) } : {}) } }
  // 방석: 각자 강조색 하나, 가끔 무늬·벨벳
  for (const [id, slot] of [['cushion_sky', 'sky'], ['cushion_yellow', 'yellow']] as const) {
    const ps: PartStyle = { color: c[pick(accents)] }
    if (r() < .35) ps.pattern = pat(pick(['stripe', 'dot', 'gingham'] as const), c.cream)
    if (r() < .3) ps.finish = 'velvet'
    s.parts[id] = { [slot]: ps }
  }
  // 버섯 갓(협탁 주황 자리): 강조색, 가끔 도자기 마감
  s.parts.nightstand = { orange: { color: c[pick(['orange', 'yellow', 'sky', 'green'] as const)], ...(r() < .3 ? { finish: 'gloss' as const } : {}) } }
  // 러그: 테마 강조색, 반쯤 무늬
  s.rug = { color: c[pick(accents)], ...(r() < .5 ? { pattern: pat(pick(['stripe', 'check', 'dot', 'zigzag'] as const), c.cream) } : {}) }
  return s
}
