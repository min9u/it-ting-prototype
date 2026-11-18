/**
 * 땅굴 방 모습을 정하는 곳 하나 (2026-11-18, docs/room-diversity-2-2026-11-18.md)
 *
 * 내 땅굴(MyBurrow) · 남의 땅굴(VisitBurrow) · 온보딩 미리 보기 · 비교 실험실(/lab/rooms)이 모두 roomLookOf 로 방 모습을 정한다.
 * 예전에는 내 땅굴은 "맨 앞 관심사의 대분류", 남이 볼 때는 "가장 무거운 대분류(드문 취미 가중치)"로 벽지를 따로 계산해서
 * 같은 사람의 땅굴이 내가 볼 때와 남이 볼 때 달랐음 (docs/room-diversity-2026-11-18.md "따로 알게 된 것").
 *
 * 순서
 * 1. 집주인이 저장한 방(서버 BurrowDto.room, 내 것은 data/myBurrow getMySavedRoom)에 값이 있으면 그 값
 * 2. 없으면 계산: 벽지 = 대표 관심사(맨 앞)의 대분류 (온보딩 3a "맨 앞 관심사가 땅굴 분위기를 정해요", 00 공통 5, spec-design-gaps G-31)
 * 가구 선택은 지금 관심사에 맞는 것만 남김 (뺀 관심사의 가구, 후보가 아닌 가구 id 는 버림 → 기본 가구)
 */
import { furnitureCandidates, getMyFurnChoice, getMyRoomPick, leadCategory, pruneChoice, type FurnChoice } from './myBurrow'
import { WALLPAPERS, wallpaperForCategory } from './wallpapers'

/** 집주인이 저장한 방 (api/types RoomLayoutDto 를 앱 값으로). 비어 있는 칸은 계산 값을 씀 */
export interface SavedRoom {
  /** 꾸미기에서 고른 벽지 (안 골랐으면 null) */
  wallpaperId: string | null
  /** 세부 관심사 id → 가구 id (꾸미기 가구 탭) */
  furniture: FurnChoice
}
export const NO_SAVED_ROOM: SavedRoom = { wallpaperId: null, furniture: {} }

/** 방 장면(RoomView → three/roomScene)에 넘기는 값 */
export interface RoomLook {
  /** 벽지 id (data/wallpapers.ts) */
  wallpaper: string
  /** 고른 가구 (세부 관심사 id → 가구 id) */
  furniture: FurnChoice
  /** 대표 관심사의 대분류 id (관심사가 없으면 null) */
  lead: string | null
  /** 어디서 온 값인지 (시험 · 비교 도구용) */
  from: { wallpaper: 'saved' | 'auto' }
}

/** 대표 관심사(고른 것 중 맨 앞)의 대분류. 이름·id 섞여도 됨, 모르는 값은 건너뜀 */
export const leadCategoryOf = (interests: string[]): string | null => leadCategory(interests) ?? null

/** 내가 저장한 방 (목: sessionStorage. 서버를 붙이면 GET /burrows/{내 id} 의 room 과 같은 값) */
export const mySavedRoom = (): SavedRoom => ({ wallpaperId: getMyRoomPick().wallpaperId, furniture: getMyFurnChoice() })

/** 저장된 가구 선택 중 지금 관심사에 맞는 것만 (꾸미기 가구 탭에서 고를 수 있는 후보만) */
export function validFurniture(furniture: FurnChoice | null | undefined, interests: string[]): FurnChoice {
  const kept = pruneChoice(furniture ?? {}, interests)
  return Object.fromEntries(Object.entries(kept).filter(([sub, fid]) => furnitureCandidates(sub, interests).some((r) => r.id === fid)))
}

/**
 * 방 모습 (같은 사람이면 어느 화면에서 봐도 같은 값)
 * @param ownerId 집주인 회원 id
 * @param interests 집주인 관심사 (고른 순서, 화면 이름 또는 id)
 * @param saved 집주인이 저장한 방 (없으면 null)
 */
export function roomLookOf(ownerId: string, interests: string[], saved?: SavedRoom | null): RoomLook {
  void ownerId // 2단계(꾸미기 자동 값)에서 씨앗으로 씀
  const lead = leadCategoryOf(interests)
  const savedWall = saved?.wallpaperId && WALLPAPERS.some((w) => w.id === saved.wallpaperId) ? saved.wallpaperId : null
  return {
    wallpaper: savedWall ?? wallpaperForCategory(lead ?? undefined),
    furniture: validFurniture(saved?.furniture, interests),
    lead,
    from: { wallpaper: savedWall ? 'saved' : 'auto' },
  }
}
