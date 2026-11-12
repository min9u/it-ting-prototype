/**
 * 땅굴 벽지 (3D 핸드오프 v3.5.1, design/digul_3d_handoff_v3_5_1/wallpapers/wallpapers.json 그대로 복사)
 * - 온보딩 4단계 "땅굴 무드"(가장 큰 취향 카테고리) → mood_map → 벽지 id. 사용자 프로필에 wallpaper_id 로 저장
 * - 01 기본은 타일 없이 단색 solid_color (#F0B47A = v2 벽 색)
 * - 3D 적용은 three/roomScene.ts (돔 안쪽 면 wall_inner 에만)
 * 타일 그림은 assets/wallpapers/ 에 512·1024 WebP (01 은 단색이라 안 넣음)
 */
import raw from './wallpapers.json'
import { CATEGORIES } from './mock'

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

/** 카테고리 id → 벽지 id. json 은 차·커피를 'tea' 로 적어서 앱의 'tea_coffee' 도 같이 받음 */
export function wallpaperForCategory(cat: string | undefined): string {
  const m = json.mood_map.by_category_id
  return (cat && (m[cat] ?? (cat === 'tea_coffee' ? m.tea : undefined))) ?? DEFAULT_WALLPAPER
}

/**
 * 가장 큰 취향 카테고리 (온보딩 "땅굴 무드"와 같은 계산: 카테고리마다 Σ(1 + 1000/그 관심사 인원), 드문 취미가 무거움)
 * picks 는 관심사 화면 이름
 */
export function topCategoryOf(picks: string[]): string | undefined {
  const weight = new Map<string, number>()
  for (const t of picks) {
    const c = CATEGORIES.find((x) => x.tags.some((g) => g.name === t))
    const n = c?.tags.find((g) => g.name === t)?.count ?? 9999
    if (c) weight.set(c.id, (weight.get(c.id) ?? 0) + 1 + 1000 / n)
  }
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

export const wallpaperForPicks = (picks: string[]) => wallpaperForCategory(topCategoryOf(picks))

/* 내 벽지 (프로필 wallpaper_id). 관심사와 같은 방식: 메모리 + sessionStorage (아티팩트에서 저장소가 막혀도 페이지 안에서는 이어짐) */
const KEY = 'digul.myWallpaper'
let mine: string | null = null
export function getMyWallpaper(fallback: string): string {
  if (mine) return mine
  try { const v = sessionStorage.getItem(KEY); if (v && WALLPAPERS.some((w) => w.id === v)) return (mine = v) } catch { /* 저장소를 못 쓰면 관심사로 정함 */ }
  return fallback
}
export function setMyWallpaper(id: string) {
  mine = id
  try { sessionStorage.setItem(KEY, id) } catch { /* 무시 */ }
}
