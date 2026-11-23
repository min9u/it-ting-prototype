/**
 * 땅굴 방 모습을 정하는 곳 하나 (2026-11-18, docs/room-diversity-2-2026-11-18.md)
 *
 * 내 땅굴(MyBurrow) · 남의 땅굴(VisitBurrow) · 온보딩 미리 보기 · 시작 화면 둘러보기 · 비교 실험실(/lab/rooms)이 모두 roomLookOf 로 방 모습을 정한다.
 * 예전에는 내 땅굴은 "맨 앞 관심사의 대분류", 남이 볼 때는 "가장 무거운 대분류(드문 취미 가중치)"로 벽지를 따로 계산해서
 * 같은 사람의 땅굴이 내가 볼 때와 남이 볼 때 달랐음 (docs/room-diversity-2026-11-18.md "따로 알게 된 것").
 *
 * 순서
 * 1. 집주인이 저장한 방(서버 BurrowDto.room, 내 것은 mySavedRoom)에 값이 있으면 그 값
 * 2. 없으면 계산: 벽지 = 대표 관심사(맨 앞)의 대분류 (온보딩 3a "맨 앞 관심사가 땅굴 분위기를 정해요", 00 공통 5, spec-design-gaps G-31)
 *    가구 선택은 지금 관심사에 맞는 것만 남김 (뺀 관심사의 가구, 후보가 아닌 가구 id 는 버림 → 기본 가구)
 * 3. (2단계) 꾸미기 값 = 대표 관심사 대분류의 색 묶음(data/roomStyle CATEGORY_THEMES) + 집주인 id 씨앗 자동 꾸미기.
 *    집주인이 색 테마를 골랐으면 그 테마로. 같은 사람은 늘 같은 방 (씨앗 = 회원 id. 서버를 붙이면 내 땅굴도 'me' 가 아니라 실제 회원 id 로)
 */
import { wordChoices, getMyRoomPick, leadCategory, pruneChoice, type FurnChoice } from './myBurrow'
import { WALLPAPERS, wallpaperForCategory } from './wallpapers'
import { ALL_THEME_IDS, autoStyle, autoStyleFor, categoryTheme, hashSeed, type RoomStyle } from './roomStyle'

/** 집주인이 저장한 방 (api/types RoomLayoutDto 를 앱 값으로). 비어 있는 칸은 계산 값을 씀 */
export interface SavedRoom {
  /** 꾸미기에서 고른 벽지 (안 골랐으면 null) */
  wallpaperId: string | null
  /** 세부 관심사 id → 가구 단어. 앱 화면은 늘 빈 값(= 맨 앞 단어, 명세: 가구는 고르지 않음). 실험실 · 시험만 채움 */
  furniture: FurnChoice
  /** 꾸미기에서 고른 색 테마 id (data/roomStyle, 안 골랐으면 null = 대표 관심사 대분류의 묶음). 'base' = 디자이너 원래 색 */
  themeId?: string | null
}
export const NO_SAVED_ROOM: SavedRoom = { wallpaperId: null, furniture: {}, themeId: null }

/** 방 장면(RoomView → three/roomScene)에 넘기는 값 */
export interface RoomLook {
  /** 벽지 id (data/wallpapers.ts) */
  wallpaper: string
  /** 고른 가구 (세부 관심사 id → 가구 id) */
  furniture: FurnChoice
  /** 꾸미기 값 (색 테마 · 껍데기 색 · 이불·러그 무늬 · 기본 가구 모양). null = 디자이너 원래 모습 */
  style: RoomStyle | null
  /** 대표 관심사의 대분류 id (관심사가 없으면 null) */
  lead: string | null
  /** 어디서 온 값인지 (시험 · 비교 도구용) */
  from: { wallpaper: 'saved' | 'auto'; style: 'saved' | 'auto' | 'none' }
}

/** 대표 관심사(고른 것 중 맨 앞)의 대분류. 이름·id 섞여도 됨, 모르는 값은 건너뜀 */
export const leadCategoryOf = (interests: string[]): string | null => leadCategory(interests) ?? null

/** 내가 저장한 방 (목: sessionStorage). 가구는 고르지 않으므로 늘 빈 값 */
export const mySavedRoom = (): SavedRoom => { const p = getMyRoomPick(); return { wallpaperId: p.wallpaperId, furniture: {}, themeId: p.themeId ?? null } }

/** 저장된 가구 선택 중 지금 관심사에 맞는 것만 (꾸미기 소품 탭에서 고를 수 있는 단어만, v3.8) */
export function validFurniture(furniture: FurnChoice | null | undefined, interests: string[]): FurnChoice {
  const kept = pruneChoice(furniture ?? {}, interests)
  return Object.fromEntries(Object.entries(kept).filter(([sub, fid]) => wordChoices(sub).includes(fid)))
}

/** 꾸미기 값: 고른 테마가 있으면 그 테마로 자동 꾸미기, 없으면 대표 관심사 대분류의 묶음 */
function styleOf(ownerId: string, lead: string | null, themeId: string | null | undefined): { style: RoomStyle | null; from: 'saved' | 'auto' | 'none' } {
  if (themeId && ALL_THEME_IDS.includes(themeId)) {
    return { style: themeId === 'base' ? null : autoStyle(hashSeed(`room:${ownerId}`), themeId), from: 'saved' }
  }
  const auto = autoStyleFor(ownerId, lead)
  return { style: auto, from: auto ? 'auto' : 'none' }
}

/**
 * 방 모습 (같은 사람이면 어느 화면에서 봐도 같은 값)
 * @param ownerId 집주인 회원 id (자동 꾸미기 씨앗)
 * @param interests 집주인 관심사 (고른 순서, 화면 이름 또는 id)
 * @param saved 집주인이 저장한 방 (없으면 null)
 */
export function roomLookOf(ownerId: string, interests: string[], saved?: SavedRoom | null): RoomLook {
  const lead = leadCategoryOf(interests)
  const savedWall = saved?.wallpaperId && WALLPAPERS.some((w) => w.id === saved.wallpaperId) ? saved.wallpaperId : null
  const st = styleOf(ownerId, lead, saved?.themeId)
  return {
    wallpaper: savedWall ?? wallpaperForCategory(lead ?? undefined),
    furniture: validFurniture(saved?.furniture, interests),
    style: st.style,
    lead,
    from: { wallpaper: savedWall ? 'saved' : 'auto', style: st.from },
  }
}

/** 대표 관심사 대분류의 땅굴 색 묶음 이름 (온보딩 3a · 꾸미기 · 비교 페이지 표시용) */
export const themeNameOf = (lead: string | null) => categoryTheme(lead)?.name ?? null
