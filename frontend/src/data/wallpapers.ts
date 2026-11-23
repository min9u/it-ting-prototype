/**
 * 땅굴 벽지 (3D 핸드오프 v3.5.1, design/digul_3d_handoff_v3_5_1/wallpapers/wallpapers.json 그대로 복사)
 * - 온보딩 4단계 "땅굴 무드"(대표 관심사의 대분류 → 그 대분류의 3D 세트) → mood_map → 벽지 id. 사용자 프로필에 wallpaper_id 로 저장
 * - 01 기본은 타일 없이 단색 solid_color (#F0B47A = v2 벽 색)
 * - 3D 적용은 three/roomScene.ts (돔 안쪽 면 wall_inner 에만)
 * 타일 그림은 assets/wallpapers/ 에 512·1024 WebP (01 은 단색이라 안 넣음)
 */
import raw from './wallpapers.json'
import { interestCatOf } from './interests'

export interface Wallpaper {
  id: string
  no: number
  name_ko: string
  avg_color_srgb: string
  /** 01 기본만: 타일 대신 이 단색 */
  solid_color?: string
}

const json = raw as unknown as { recommended_repeat_around_dome: [number, number]; wallpapers: Wallpaper[]; mood_map: { by_category_id: Record<string, string>; default: string } }
export const WALLPAPERS = json.wallpapers
export const DEFAULT_WALLPAPER = json.mood_map.default
/** 돔 둘레 반복 횟수 (권장 4~6) */
export const WALLPAPER_REPEAT = 5

const TILES = import.meta.glob<string>('../assets/wallpapers/*.webp', { eager: true, query: '?url', import: 'default' })
/** 타일 그림 URL (단색이면 undefined) */
export const tileUrl = (id: string, size: 512 | 1024 = 1024): string | undefined => TILES[`../assets/wallpapers/${id}_${size}.webp`]
export const wallpaperOf = (id: string | undefined) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS.find((w) => w.id === DEFAULT_WALLPAPER)!

/**
 * 대분류 id → 벽지 id. 벽지 표(mood_map)는 3D 세트 id 로 적혀 있어서 대분류가 쓰는 3D 세트로 찾음 (data/interest3d.ts kit,
 * 예: 음식·음료 → tea_coffee 세트 → 05 체크, 반려동물·식물 → nature 세트 → 07 숲). 세트 id 를 바로 줘도 됨.
 * json 은 차·커피를 'tea' 로 적어서 'tea_coffee' 도 같이 받음
 */
export function wallpaperForCategory(cat: string | undefined): string {
  const m = json.mood_map.by_category_id
  const kit = (cat && interestCatOf(cat)?.kit) || cat
  return (kit && (m[kit] ?? (kit === 'tea_coffee' ? m.tea : undefined))) ?? DEFAULT_WALLPAPER
}

/*
 * 예전에 여기 있던 것 (2026-11-18 지움, docs/room-diversity-2-2026-11-18.md 1단계)
 * - topCategoryOf · wallpaperForPicks: "가장 무거운 대분류(Σ 1 + 1000/인원)"로 벽지를 정하던 예전 규칙. 남의 땅굴만 이 규칙을 써서
 *   내 땅굴(맨 앞 관심사 규칙)과 벽지가 달랐음 → 방 모습은 data/roomLook.ts roomLookOf 한 곳에서 정함
 * - getMyWallpaper · setMyWallpaper: 계산한 벽지를 저장해 두던 곳 → 직접 고른 것만 data/myBurrow.ts getMyRoomPick 에
 */
