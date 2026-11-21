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

/**
 * 방 껍데기 색 (2026-11-18 2단계, docs/room-diversity-2-2026-11-18.md). 방 넓이 대부분(벽 · 바닥 · 나무 뼈대)을 바꾸는 값.
 * 껍데기는 조명을 구운 그림이라 색을 곱해서 바꿈 (three/roomStyle.ts registerShell) → 구운 음영·나뭇결은 그대로 남음
 */
export interface ShellLook {
  /** 벽 색 = 벽 위쪽이 화면에 보이는 색 (sRGB). 단색 벽지(01)는 이 색, 무늬 벽지는 타일 평균이 이 색이 되게 물들임 (무늬의 밝고 어두운 차이는 그대로) */
  wall: string
  /** 바닥 나무 색 (바닥 앞쪽이 화면에 보이는 색) */
  floor: string
  /** 갈빗대 · 나무 벽판 · 돔 테두리 색 */
  wood: string
}

export interface ColorTheme {
  id: string; name: string; note: string; colors: Record<PaletteKey, string>
  /** 껍데기 (벽 · 바닥 · 나무). 없으면 디자이너 원래 그대로 */
  shell?: ShellLook
  /** 자동 꾸미기 러그 색 (없으면 강조색 중 하나) */
  rug?: string
  /** 자동 꾸미기에서 사람에 따라 고르는 다른 바닥 색 */
  floorAlt?: string
  /** 자동 꾸미기에서 사람에 따라 고르는 다른 벽 색 (같은 대분류 안에서 결이 같은 다른 빛깔) */
  wallAlt?: string
}

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

/**
 * 대분류 12개 땅굴 색 묶음 (2026-11-18 2단계). id = cat_<대분류 id>, 이름 = 땅굴 무드 이름(data/myBurrow MOOD_NAMES)
 * - 벽은 색상과 밝기를 둘 다 나눔: 밝은 벽 = 작업실 분홍 · 카페 버터 · 온실 연두 · 공부방 민트 · 운동장 하늘 · 오락실 라일락 · 서재 양피지,
 *   진한 벽 = 극장 버건디 · 레코드 청록 · 캠핑 숲 초록 · 암실 숯 회색 · 수집 보라 남색(별) → 대분류가 다르면 벽부터 다름
 * - 같은 가구를 빌려 쓰는 대분류끼리도 확실히 다르게: 운동장(밝은 하늘 벽 · 체육관 단풍나무 바닥 · 잔디 러그) ≠ 캠핑장(진한 숲 벽 · 어두운 나무 · 빨간 러그),
 *   공부방(민트 · 밝은 물푸레) ≠ 서재(양피지 · 호두나무)
 * - 가구 팔레트는 자리마다 색 계열을 지킴 (green 은 초록 계열: 잎·화분이 같은 자리, sky 는 파랑·청록: 어항 물, wood 는 갈색 …) → 소품이 엉뚱한 색이 안 됨
 * - 채도는 원래 점토 팔레트 수준. 색은 모두 "화면에 보이는 색"으로 적음 (three/roomStyle.ts 가 구운 빛·톤 매핑을 거꾸로 계산해 넣음)
 * 색은 헤드리스 크롬(가속 켬)으로 26개 방을 찍어 보며 맞춤 (tools/room-diversity)
 */
export const CATEGORY_THEMES: Record<string, ColorTheme> = {
  food: {
    id: 'cat_food', name: '골목 카페 무드', note: '버터 벽 · 커피색 바닥 · 테라코타',
    colors: { cream: '#F5EBDA', green: '#7E9A5A', orange: '#C8623A', sky: '#9EBFC4', yellow: '#E6B450', wood_light: '#A97450', wood_dark: '#6B4632', stone: '#8E7E70' },
    shell: { wall: '#EED6A0', floor: '#A57452', wood: '#C8946A' }, rug: '#C8623A', floorAlt: '#B08A64', wallAlt: '#E6CC90',
  },
  sports: {
    id: 'cat_sports', name: '운동장 무드', note: '하늘 벽 · 체육관 바닥 · 잔디 러그',
    colors: { cream: '#F6F5F0', green: '#4FA35A', orange: '#E5533D', sky: '#3E86D0', yellow: '#F2C230', wood_light: '#D8B07E', wood_dark: '#A27A52', stone: '#8F98A3' },
    shell: { wall: '#92B8DC', floor: '#E0C08E', wood: '#E6CFA6' }, rug: '#4FA35A', floorAlt: '#D9B888', wallAlt: '#6E9AD0',
  },
  culture: {
    id: 'cat_culture', name: '작은 극장 무드', note: '버건디 벽 · 금색 · 남색',
    colors: { cream: '#F4E6C8', green: '#3F6E62', orange: '#B53A3F', sky: '#4D5F8E', yellow: '#E2B24C', wood_light: '#9C6446', wood_dark: '#5C3528', stone: '#75696A' },
    shell: { wall: '#9A3B46', floor: '#6E4234', wood: '#8A5444' }, rug: '#4D5F8E', floorAlt: '#704634', wallAlt: '#44507E',
  },
  game: {
    id: 'cat_game', name: '동네 오락실 무드', note: '라일락 벽 · 네온 분홍 · 하늘',
    colors: { cream: '#F7F2FB', green: '#4CC7A0', orange: '#EE5A8F', sky: '#47B3E6', yellow: '#F7CF45', wood_light: '#A895C4', wood_dark: '#6A5690', stone: '#7E7A92' },
    shell: { wall: '#D4C3EC', floor: '#7A6C92', wood: '#B4A2CC' }, rug: '#EE5A8F', floorAlt: '#857B9E', wallAlt: '#9C88C8',
  },
  music_dance: {
    id: 'cat_music_dance', name: '레코드 가게 무드', note: '청록 줄무늬 · 겨자 · 주황',
    colors: { cream: '#F2E2BF', green: '#8A9A3A', orange: '#D85A28', sky: '#2E8C8A', yellow: '#E8A42A', wood_light: '#B6743E', wood_dark: '#6E4128', stone: '#8D7A68' },
    shell: { wall: '#4F8E96', floor: '#9A6844', wood: '#B2845C' }, rug: '#E8A42A', floorAlt: '#A06A40', wallAlt: '#3E6E78',
  },
  outdoor: {
    id: 'cat_outdoor', name: '캠핑장 무드', note: '숲 초록 벽 · 캠프 빨강 · 통나무',
    colors: { cream: '#ECDDBE', green: '#5E8C43', orange: '#C4502F', sky: '#8FB2B8', yellow: '#D9AC45', wood_light: '#A36E44', wood_dark: '#6A452E', stone: '#7F7564' },
    shell: { wall: '#6B7F55', floor: '#76563C', wood: '#8E6E50' }, rug: '#C4502F', floorAlt: '#8E6C4C', wallAlt: '#A39A6C',
  },
  language_selfdev: {
    id: 'cat_language_selfdev', name: '작은 공부방 무드', note: '민트 벽 · 밝은 물푸레 · 파랑 · 노랑',
    colors: { cream: '#F8F7F2', green: '#6FB39A', orange: '#F08A5A', sky: '#5C8FD6', yellow: '#F5D04C', wood_light: '#D9C3A0', wood_dark: '#8F7A62', stone: '#9AA4AE' },
    shell: { wall: '#C6E5D6', floor: '#DDC9A4', wood: '#E6D6BE' }, rug: '#5C8FD6', floorAlt: '#CDB490', wallAlt: '#A8D4C0',
  },
  book: {
    id: 'cat_book', name: '다락 서재 무드', note: '아이보리 벽 · 호두나무 · 짙은 초록',
    colors: { cream: '#F0E4CC', green: '#3F6A4E', orange: '#9A3D32', sky: '#5E7A8A', yellow: '#C9A055', wood_light: '#8C5C3C', wood_dark: '#4E3325', stone: '#7A6E62' },
    shell: { wall: '#F1E8DA', floor: '#684836', wood: '#7E5A46' }, rug: '#3F6A4E', floorAlt: '#806050', wallAlt: '#E8D8B8',
  },
  photo_video: {
    id: 'cat_photo_video', name: '작은 암실 무드', note: '회청 벽 · 회색 나무 · 암실 빨강',
    colors: { cream: '#EDEAE4', green: '#4E7E78', orange: '#C9453B', sky: '#6E8EAA', yellow: '#E6B84C', wood_light: '#8E7E72', wood_dark: '#4C4442', stone: '#6C6A6C' },
    shell: { wall: '#8E97A3', floor: '#77706C', wood: '#8C8480' }, rug: '#C9453B', floorAlt: '#7C7672', wallAlt: '#6E6A6C',
  },
  art_craft: {
    id: 'cat_art_craft', name: '작업실 무드', note: '분홍 벽 · 자작나무 · 파스텔',
    colors: { cream: '#FBF0EA', green: '#A8D49A', orange: '#F09A8E', sky: '#B2D2F2', yellow: '#F7DC90', wood_light: '#E2C0A2', wood_dark: '#BE8F78', stone: '#B8A8A6' },
    shell: { wall: '#F2CCD4', floor: '#E2CAAA', wood: '#ECD6C0' }, rug: '#B9A3E0', floorAlt: '#D8B896', wallAlt: '#F4C0B0',
  },
  fandom_collect: {
    id: 'cat_fandom_collect', name: '수집 진열장 무드', note: '보라 남색 별 · 분홍 · 금빛',
    colors: { cream: '#FFF1F4', green: '#8FC9AE', orange: '#E86A92', sky: '#98AEEF', yellow: '#F6D27A', wood_light: '#C9A2B6', wood_dark: '#6E5170', stone: '#8C8098' },
    shell: { wall: '#625596', floor: '#A6848F', wood: '#BE9CAC' }, rug: '#F2A7C3', floorAlt: '#8E7080', wallAlt: '#84588C',
  },
  pet_plant: {
    id: 'cat_pet_plant', name: '포근한 온실 무드', note: '연두 잎 벽 · 꿀색 바닥 · 테라코타',
    colors: { cream: '#F6EEDC', green: '#78A862', orange: '#D8774E', sky: '#A3CEC6', yellow: '#EFC86A', wood_light: '#C99A6A', wood_dark: '#8A6244', stone: '#9A8E7E' },
    shell: { wall: '#C2E0AE', floor: '#CBA072', wood: '#D6AE82' }, rug: '#D8774E', floorAlt: '#B88A5C', wallAlt: '#D0DE9C',
  },
}
const ALL_THEMES = [...THEMES, ...Object.values(CATEGORY_THEMES)]
export const ALL_THEME_IDS = ALL_THEMES.map((t) => t.id)
export const themeOf = (id: string | undefined) => ALL_THEMES.find((t) => t.id === id) ?? THEMES[0]
/** 이 대분류의 땅굴 색 묶음 */
export const categoryTheme = (cat: string | null | undefined) => (cat ? CATEGORY_THEMES[cat] : undefined)
/**
 * 꾸미기 값의 판(版). 테마 색처럼 코드에 있는 값을 바꾸면 올림 → 저사양 PC 의 구운 방 그림 캐시(sharpBake · IndexedDB) 키가 바뀌어 옛 그림이 안 남음
 */
export const STYLE_VERSION = 2

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
  /** 바닥 색 덮어쓰기 (없으면 테마 shell.floor). 2026-11-18 */
  floor?: string
  /** 벽 색 덮어쓰기 (없으면 테마 shell.wall) */
  wall?: string
}
export const EMPTY_STYLE: RoomStyle = { theme: 'base', parts: {}, shape: {} }

/*
 * 모양 옵션 (기본 가구 6개는 모든 땅굴에 똑같이 있어서 "다 똑같아 보임"의 주범 → 여기를 우선 바꿈)
 * 새 모델 없이: 크기·비율 바꾸기, 부품 숨기기·복제, 점토 덧붙이(코드로 만든 둥근 조각, 같은 팔레트 재질)
 */
export interface ShapeChoice { id: string; name: string }
export interface ShapeGroup { id: string; name: string; choices: ShapeChoice[] }
export const SHAPE_OPTIONS: Record<string, ShapeGroup[]> = {
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
 * 씨앗 하나로 테마 + 기본 가구 모양 + 방석·러그 무늬를 고름.
 * 색은 고른 테마 안의 색만 써서(어울림 보장) 러그·방석처럼 넓은 면만 다른 자리 색으로 바꿈.
 * themeId 를 주면 그 테마로 (2026-11-18: 대분류 묶음 CATEGORY_THEMES), 안 주면 씨앗으로 고름 (실험실 /lab/style)
 * 저사양 PC 를 생각해 도자기·금속 마감(방 환경맵을 따로 만듦)은 자동에서 안 씀. 벨벳은 방석에만 가끔
 */
export function autoStyle(seed: number, themeId?: string): RoomStyle {
  const r = rng(seed)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  // 기본(디자이너 색)은 꾸미기 없는 집과 같아 보여서 자동에서는 뺌
  const picked = pick(THEMES.slice(1))
  const theme = themeId ? themeOf(themeId) : picked
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
  // 방석: 각자 강조색 하나, 가끔 무늬·벨벳
  for (const [id, slot] of [['cushion_sky', 'sky'], ['cushion_yellow', 'yellow']] as const) {
    const ps: PartStyle = { color: c[pick(accents)] }
    if (r() < .35) ps.pattern = pat(pick(['stripe', 'dot', 'gingham'] as const), c.cream)
    if (r() < .25) ps.finish = 'velvet'
    s.parts[id] = { [slot]: ps }
  }
  // 러그: 테마 러그 색(있으면 반쯤) 또는 강조색, 반쯤 무늬
  const rugColor = theme.rug && r() < .55 ? theme.rug : c[pick(accents)]
  s.rug = { color: rugColor, ...(r() < .5 ? { pattern: pat(pick(['stripe', 'check', 'dot', 'zigzag'] as const), c.cream) } : {}) }
  // 바닥: 테마 바닥 또는 다른 바닥 (사람마다)
  if (theme.floorAlt && r() < .4) s.floor = theme.floorAlt
  // 벽: 테마 벽 또는 같은 결의 다른 빛깔 (같은 대분류 이웃끼리도 들어가자마자 조금 다르게)
  if (theme.wallAlt && r() < .4) s.wall = theme.wallAlt
  return s
}

/**
 * 집주인 자동 꾸미기 (2026-11-18 2단계, data/roomLook.ts 가 부름): 대표 관심사 대분류의 색 묶음 + 집주인 id 씨앗.
 * 같은 사람은 늘 같은 방, 대분류가 같아도 사람마다 러그·방석·모양·바닥이 조금씩 다름. 대표 관심사가 없으면 null (디자이너 원래 모습)
 */
export function autoStyleFor(ownerId: string, lead: string | null | undefined): RoomStyle | null {
  const t = categoryTheme(lead)
  return t ? autoStyle(hashSeed(`room:${ownerId}`), t.id) : null
}
