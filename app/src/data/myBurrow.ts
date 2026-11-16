/**
 * 내 땅굴(F4) · 온보딩(F3)이 같이 쓰는 내 정보 (백엔드 대신 메모리 + sessionStorage, data/interests 의 관심사 저장과 같은 방식)
 * - 프로필: 닉네임 · 자기소개 · 질문 3개와 답변 · 캠퍼스 · 층 (기수는 SSAFY 인증 값이라 못 바꿈, 반은 받지 않음 — 00 공통 4·19)
 * - 가구 고르기: 세부 관심사 id → 가구 id (02 F4 꾸미기 모드 · 가구 탭, 00 공통 5 "땅굴 가구는 세부 관심사로 센다")
 * - 땅굴 무드: 대표 관심사(내 관심사 목록 맨 앞)의 대분류로 정함 (00 공통 5, F3 3a 3번, F4 꾸미기 가구 탭 3번)
 */
import { ME_ID, USERS } from './mock'
import { INTEREST_SUBS, interestCatOf, subOf, toSubIds } from './interests'
import { FURNITURE_CATALOG, type FurnitureRow, type RoomPlan } from './roomPlan'
import { wallpaperForCategory } from './wallpapers'
import { ME_HOME } from './field'
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
  // 들판·프로필 팝업이 쓰는 소속(ME_HOME)도 같이 맞춤
  ME_HOME.campus = p.campus; ME_HOME.floor = p.floor
  return p
}
export function setMyProfile(p: Partial<MyProfile>) {
  const next = { ...getMyProfile(), ...p }
  save(PROFILE_KEY, next)
  ME_HOME.campus = next.campus; ME_HOME.floor = next.floor
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
export const NICK_MAX = 12
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
export const RARE_MAX = 5
export const ssafyCount = (count: number) => Math.max(1, Math.round(count / 100))
export const isRare = (count: number) => ssafyCount(count) <= RARE_MAX

/* ---------- 땅굴 무드 ---------- */
export const MOOD_NAMES: Record<string, string> = {
  music: '레코드 가게 무드', photo: '작은 암실 무드', nature: '작은 온실 무드', game: '동네 오락실 무드', craft: '작업실 무드',
  book: '다락 서재 무드', science: '별 관측소 무드', tea_coffee: '골목 카페 무드', outdoor: '캠핑장 무드', movie: '작은 극장 무드', pet: '포근한 둥지 무드',
}
/** 대표 관심사(맨 앞)의 대분류 */
export const leadCategory = (picks: string[]) => subOf(picks[0] ?? '')?.category
export const moodWallpaper = (picks: string[]) => wallpaperForCategory(leadCategory(picks))

/* ---------- 가구 (세부 관심사마다 하나) ---------- */
const rowOf = (id: string) => FURNITURE_CATALOG.find((r) => r.id === id)
/** 그 관심사의 기본 가구 (온보딩 3a 에서 놓이는 추천 가구) */
export const defaultFurniture = (subId: string) => rowOf(subOf(subId)?.prop ?? '')
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
export type FurnChoice = Record<string, string>
const FURN_KEY = 'digul.myFurnitureBySub'
export const getMyFurnChoice = (): FurnChoice => load<FurnChoice>(FURN_KEY, {})
export const setMyFurnChoice = (c: FurnChoice) => save(FURN_KEY, c)
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
/** 관심사 가구 수 = 가구가 있는 세부 관심사 수 */
export const interestFurnitureCount = (picks: string[]) => toSubIds(picks).filter((id) => defaultFurniture(id)).length
/** 화면 이름 → 세부 관심사 이름 (관심사 이름 그대로) + 대분류 이름 */
export const subLabel = (subId: string) => subOf(subId)?.name_ko ?? subId
export const catLabelOfSub = (subId: string) => interestCatOf(subOf(subId)?.category ?? '')?.name_ko ?? ''

/* ---------- 단골 (나를 단골로 둔 사람 수, 목) ---------- */
export const MY_REGULARS_COUNT = 8
