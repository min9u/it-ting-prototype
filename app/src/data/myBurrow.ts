/**
 * 내 땅굴(F4) · 온보딩(F3)이 같이 쓰는 내 정보 (백엔드 대신 메모리 + sessionStorage, data/interests 의 관심사 저장과 같은 방식)
 * - 프로필: 닉네임 · 자기소개 · 질문 3개와 답변 · 캠퍼스 · 층 (기수는 SSAFY 인증 값이라 못 바꿈, 반은 받지 않음 — 00 공통 4·19)
 * - 가구: 세부 관심사마다 하나로 정해져 있고 고르지 않음 (00 공통 5, 맨 앞 단어). 단어 후보(wordChoices)는 실험실 · 시험만 씀
 * - 땅굴 무드: 대표 관심사(내 관심사 목록 맨 앞)의 대분류로 정함 (00 공통 5, F3 3a 3번, 04 가구와 땅굴 무드)
 * - 방 모습(벽지 · 가구)은 내 땅굴과 남이 보는 내 땅굴이 같은 함수로 정함 → data/roomLook.ts roomLookOf
 */
import { wordsOfSub } from './interestWords'
import { placeWords } from './roomPlanV38'
import { ME_ID, USERS } from './mock'
import { INTEREST_SUBS, interestCatOf, subOf, toSubIds } from './interests'
import { FURNITURE_CATALOG, type FurnitureRow, type RoomPlan } from './roomPlan'
import { wallpaperForCategory } from './wallpapers'
import { ME_HOME, MY_FLOOR, moveMyBurrow } from './field'
import { questionOf, type Question } from './questions'

/* ---------- 저장 도우미 ---------- */
const mem = new Map<string, unknown>()
function load<T>(key: string, fallback: T): T {
  if (mem.has(key)) return mem.get(key) as T
  try { const v = sessionStorage.getItem(key); if (v) { const p = JSON.parse(v) as T; mem.set(key, p); return p } } catch { /* 저장소 없음 */ }
  return fallback
}
function save(key: string, v: unknown) {
  mem.set(key, v)
  try { sessionStorage.setItem(key, JSON.stringify(v)) } catch { /* 무시: 메모리로 이 페이지 안에서는 이어짐 */ }
}

/* ---------- 프로필 ---------- */
export interface MyQnA { qid: string; a: string }
export interface MyProfile {
  nickname: string
  intro: string
  qna: MyQnA[]
  campus: string
  floor: number
}
/** Figma 03 내 땅굴 예시와 같은 기본 값 (온보딩을 거치지 않고 /burrow 로 바로 들어왔을 때) */
const DEFAULT_PROFILE: MyProfile = {
  nickname: USERS[ME_ID].nickname,
  intro: USERS[ME_ID].intro,
  qna: [
    { qid: 'music-1', a: '마리아 타케우치 「Plastic Love」요. 출근길마다 들어요.' },
    { qid: 'photo-1', a: '동네 고양이요. 반은 흔들렸어요.' },
    { qid: 'tmi-1', a: '유명한 맛집 주방을 몰래 구경해 볼래요.' },
  ],
  campus: ME_HOME.campus,
  floor: ME_HOME.floor,
}
const PROFILE_KEY = 'digul.myProfile'
export function getMyProfile(): MyProfile {
  const p = { ...DEFAULT_PROFILE, ...load<Partial<MyProfile>>(PROFILE_KEY, {}) }
  // 들판·프로필 팝업이 쓰는 소속(ME_HOME)도 같이 맞춤. 저장해 둔 캠퍼스-층이 내 땅굴 입구와 다르면(새로고침) 입구도 그 들판으로
  syncHome(p.campus, p.floor)
  return p
}
/**
 * 프로필의 캠퍼스-층을 내 땅굴 입구에 맞춤 (명세 04 내 정보 수정 "캠퍼스-층을 저장할 때": 프로필과 다르면 입구를 새 층으로, 자리를 새 들판의 다음 번호로).
 * 입구(MY_FLOOR)와 같으면 아무것도 안 바꿈 → 닉네임만 바꿔 저장해도 자리가 그대로이고, 새 학기 안내 시연(입구가 지난 학기 들판)도 안 풀림
 */
function syncHome(campus: string, floor: number) {
  if (campus !== MY_FLOOR.campus || floor !== MY_FLOOR.floor) moveMyBurrow(campus, floor)
  else { ME_HOME.campus = campus; ME_HOME.floor = floor }
}
export function setMyProfile(p: Partial<MyProfile>) {
  const next = { ...getMyProfile(), ...p }
  save(PROFILE_KEY, next)
  syncHome(next.campus, next.floor)
  // 다른 화면(헤더·프로필 팝업)이 USERS.me 를 읽으므로 닉네임·자기소개도 맞춰 둠
  USERS[ME_ID].nickname = next.nickname
  USERS[ME_ID].intro = next.intro
}
/** 질문 + 답변 (질문을 못 찾으면 뺌) */
export const qnaOf = (list: MyQnA[]): { q: Question; a: string }[] =>
  list.map((x) => ({ q: questionOf(x.qid)!, a: x.a })).filter((x) => !!x.q)
/** 소속 한 줄 "SSAFY 16기 · 서울 · 12층" (반은 쓰지 않음) */
export const myAffiliation = (p: Pick<MyProfile, 'campus' | 'floor'>) => `SSAFY ${ME_HOME.gen}기 · ${p.campus} · ${p.floor}층`

/* ---------- 닉네임 ---------- */
// 닉네임 최대 12자 (lib/validation.ts, ERD member_profile.nickname VARCHAR(12))
export { NICKNAME_MAX as NICK_MAX } from '../lib/validation'
/** 이미 쓰는 닉네임 (목: 목 사용자들 + 몇 개). 대소문자·앞뒤 공백 무시 */
const TAKEN_EXTRA = ['도토리', '보리', '콩떡', '두더지', '디굴디굴', '운영자']
export function nickTaken(name: string, mine?: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n || (mine && n === mine.trim().toLowerCase())) return false
  return [...Object.values(USERS).filter((u) => u.id !== ME_ID).map((u) => u.nickname), ...TAKEN_EXTRA].some((x) => x.toLowerCase() === n)
}

/* ---------- 관심사 ---------- */
export const MIN_PICK = 3
/**
 * 분야 팝업 "통하는 취향": 고른 사람이 5명 이하인 관심사 (02 F3 분야 팝업 3번, 제안).
 * 목 인원수(data/mock TAG_COUNTS)는 전국 규모 숫자라 1/100 로 줄여 SSAFY 규모로 봄 → 판단한 것 (docs/spec-f3-f4.md)
 */
export { ONBOARDING_MAX_PEOPLE as RARE_MAX, ssafyCount, isOnboardingRare as isRare } from './rarity' // 기준은 data/rarity.ts 한 곳

/* ---------- 땅굴 무드 ---------- */
/** 대분류 → 땅굴 무드 이름 (2026-11-18 확정본 12개. 벽지는 그 대분류의 3D 세트로 정함, data/wallpapers.ts) */
export const MOOD_NAMES: Record<string, string> = {
  food: '골목 카페 무드', sports: '운동장 무드', culture: '작은 극장 무드', game: '동네 오락실 무드', music_dance: '레코드 가게 무드',
  outdoor: '캠핑장 무드', language_selfdev: '작은 공부방 무드', book: '다락 서재 무드', photo_video: '작은 암실 무드', art_craft: '작업실 무드',
  fandom_collect: '수집 진열장 무드', pet_plant: '포근한 온실 무드',
}
/** 대표 관심사(고른 것 중 맨 앞)의 대분류. 모르는 값(예전 이름 등)은 건너뜀 */
export const leadCategory = (picks: string[]) => subOf(toSubIds(picks)[0] ?? '')?.category
/** 관심사로 계산한 벽지 (저장한 벽지가 없을 때. 방 모습 전체는 data/roomLook.ts roomLookOf) */
export const moodWallpaper = (picks: string[]) => wallpaperForCategory(leadCategory(picks))

/* ---------- 내가 저장한 방 (서버 BurrowDto.room 의 내 것, data/roomLook.ts SavedRoom) ---------- */
/**
 * 꾸미기에서 직접 고른 것만 저장 (가구 선택은 아래 FURN_KEY 에 따로). 관심사로 계산되는 값(벽지 기본값 등)은 저장하지 않음 →
 * 관심사를 바꾸면 계산 값이 따라 바뀌고, 남이 볼 때도 같은 계산(roomLookOf)을 거침.
 * 예전에는 온보딩·관심사 수정 때 계산한 벽지를 'digul.myWallpaper' 에 저장해서, 그 값이 남이 보는 벽지(다른 규칙)와 어긋났음 (2026-11-18)
 */
export interface MyRoomPick {
  wallpaperId: string | null
  /** 꾸미기에서 고른 색 테마 (null = 대표 관심사 대분류의 묶음, data/roomStyle CATEGORY_THEMES) */
  themeId: string | null
}
const ROOM_KEY = 'digul.myRoom.v1'
export const getMyRoomPick = (): MyRoomPick => ({ wallpaperId: null, themeId: null, ...load<Partial<MyRoomPick>>(ROOM_KEY, {}) })
export const setMyRoomPick = (p: Partial<MyRoomPick>) => save(ROOM_KEY, { ...getMyRoomPick(), ...p })
/** 온보딩을 새로 마치면 꾸민 것을 처음으로 */
export function resetMyRoom() { save(ROOM_KEY, {}) }

/* ---------- 가구 (세부 관심사마다 하나) ---------- */
const rowOf = (id: string | null | undefined) => (id ? FURNITURE_CATALOG.find((r) => r.id === id) : undefined)
/** 그 관심사의 기본 가구 (온보딩 3a 에서 놓이는 추천 가구). 소품이 아직 없는 소분류는 undefined */
export const defaultFurniture = (subId: string) => rowOf(subOf(subId)?.prop)
/**
 * 그 관심사의 가구 후보 (기본 가구 + 같은 대분류 선반 소품 2개, 최대 3개).
 * 가구 자리는 정해져 있어서 같은 종류 자리(선반)에 들어가는 것만 후보. 바닥·반려동물 자리는 기본 가구 하나뿐.
 * 내가 고른 다른 관심사의 기본 가구는 겹치지 않게 뺌
 */
export function furnitureCandidates(subId: string, picks: string[]): FurnitureRow[] {
  const sub = subOf(subId)
  const base = defaultFurniture(subId)
  if (!sub || !base) return []
  if (sub.slot_kind !== 'shelf') return [base]
  const mine = new Set(toSubIds(picks))
  const siblings = INTEREST_SUBS.filter((s) => s.category === sub.category && s.slot_kind === 'shelf')
  const i = siblings.findIndex((s) => s.id === sub.id)
  const others = [...siblings.slice(i + 1), ...siblings.slice(0, i)].filter((s) => !mine.has(s.id)).map((s) => rowOf(s.prop)).filter((r): r is FurnitureRow => !!r)
  return [base, ...others.slice(0, 2)]
}
/**
 * v3.8: 소분류에서 고를 수 있는 단어 ("/"로 묶인 소분류만. 한 단어는 고정이라 빈 목록). 고른 값 FurnChoice[subId] = 단어.
 * 앱 화면은 고르지 않는다(명세 00 공통 5: 가구는 세부 관심사마다 하나 = 맨 앞 단어). 꾸미기 가구 탭과 목 전용 저장(digul.myFurnitureBySub)은
 * 2026-11-23 뺐고, 이 함수와 FurnChoice 는 실험실(/lab/rooms) · 방 배치 계산(placeWords · planRoom) · 시험이 쓴다
 */
export const wordChoices = (subId: string): string[] => { const w = wordsOfSub(subId); return w?.pickable ? w.words.map((x) => x.word) : [] }
export type FurnChoice = Record<string, string>
/** 관심사를 바꾸면: 뺀 관심사의 고른 가구는 사라지고, 그대로 둔 관심사는 유지, 새 관심사는 기본 가구 */
export function pruneChoice(c: FurnChoice, picks: string[]): FurnChoice {
  const keep = new Set(toSubIds(picks))
  return Object.fromEntries(Object.entries(c).filter(([k]) => keep.has(k)))
}
/** 가구 배치 계획에 고른 가구를 반영 (같은 자리, 다른 가구) */
export function applyChoice(plan: RoomPlan, c: FurnChoice | undefined): RoomPlan {
  if (!c || !Object.keys(c).length) return plan
  return {
    ...plan,
    items: plan.items.map((it) => {
      const want = it.sub ? c[it.sub] : undefined
      if (!want || it.row.type === 'pet' || want === it.row.id) return it
      const row = rowOf(want)
      return row ? { ...it, row, built: row.status === 'built' && !!(row.glb_compressed ?? row.glb) } : it
    }),
  }
}
/** 관심사 가구 수 = 방에 놓인 관심사 소품 수 (v3.8: 세부 관심사마다 모델 하나, 온보딩 3a·4 와 방이 같은 계산) */
export const interestFurnitureCount = (picks: string[]) => placeWords(toSubIds(picks)).placed.length
/** 화면 이름 → 세부 관심사 이름 (관심사 이름 그대로) + 대분류 이름 */
export const subLabel = (subId: string) => subOf(subId)?.name_ko ?? subId
export const catLabelOfSub = (subId: string) => interestCatOf(subOf(subId)?.category ?? '')?.name_ko ?? ''

/* ---------- 단골 (나를 단골로 둔 사람 수, 목) ---------- */
export const MY_REGULARS_COUNT = 8
