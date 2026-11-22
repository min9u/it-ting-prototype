/**
 * 탐색 들판 (Figma 02 F5 "땅굴 메인 – 탐색", 00 공통 19 "캠퍼스-층 · 학기", 3D 핸드오프 v3.9)
 *
 * - 들판 하나 = 학기 하나의 캠퍼스-층 하나 (예: 2026 하반기 서울-2층). 반 개념은 없음
 * - 자리 번호 1~150 = 그 들판에서 온보딩을 마친 순서. 한 번 배정되면 바뀌지 않음
 * - 켜는 구역 수 = ceil(가장 큰 배정 번호 / 25), 최소 1 (v3.9 는 "배정 인원"이라고 했지만, 탈퇴로 번호가 비면
 *   인원보다 큰 번호가 생길 수 있어서 가장 큰 번호 기준으로 켬. 같은 말이 되는 경우가 대부분)
 * - 탈퇴로 빈 번호: 빈 자리(empty_pad)로 보이고, 다음 온보딩 완료자에게 가장 작은 빈 번호부터 다시 줌 (디자이너 제안 그대로).
 *   단 30일 동안은 비워 둠 (아는 자리에 바로 낯선 사람이 들어오지 않게) → docs/explore-field-v3-9.md "판단한 것"
 * - 서버가 없어서 사람·자리는 여기서 시드로 만듦 (같은 들판은 언제나 같은 결과)
 */
import { CATEGORIES, ME_ID, USERS } from './mock'
import { getMyInterests } from './interests'
import { CAMPUS_FLOORS } from './campusFloors'
import { GENERATIONS } from './auth'
import type { QnA, User } from './types'

export interface FieldUser extends User {
  campus: string
  gen: number
  floor: number
}

export interface Floor {
  id: string
  campus: string
  floor: number
  /** 학기 (예: 2026 하반기) */
  term: string
  /** 이번 학기 들판인지 (API 의 term.isCurrent). 없으면 term === CURRENT_TERM 으로 봄 (목 데이터) */
  current?: boolean
}

export const CURRENT_TERM = '2026 하반기'
/** 들판이 열린 학기 (최근에 열린 것부터, 목 서버의 GET /terms). 이름이 곧 목 학기 id */
export const TERMS = [CURRENT_TERM, '2026 상반기'] as const
/** 캠퍼스 · 층 목록은 data/campusFloors.ts 한 곳 (회원가입 3 · 내 정보 수정과 같이 씀) */
export { CAMPUS_FLOORS } from './campusFloors'

export const floorId = (term: string, campus: string, floor: number) => `${term}|${campus}|${floor}`
export const floorName = (f: Pick<Floor, 'campus' | 'floor'>) => `${f.campus}-${f.floor}층`
/** 지금 학기 들판이면 "서울-2층", 지난 학기면 "2026 상반기 서울-2층" */
export const floorLabel = (f: Floor) => ((f.current ?? f.term === CURRENT_TERM) ? floorName(f) : `${f.term} ${floorName(f)}`)
export function parseFloor(id: string): Floor | null {
  const [term, campus, fl] = id.split('|')
  if (!term || !campus || !fl) return null
  return { id, term, campus, floor: +fl }
}

/**
 * 층 → 작물 (3D 핸드오프 v3.11 themes 9종. 디자이너가 "층→작물 매핑은 개발 쪽에서 정해 달라"고 함 → docs/explore-field-v3-10.md "정한 것")
 * 규칙 (2026-11-20 사용자 결정):
 * - **빵은 대전 캠퍼스 층에만.** 대전 층이 몇 개든 전부 빵 (목록에 없는 대전 층도 빵)
 * - 대전이 아닌 층은 나머지 8종(호박 → 사과 → 딸기 → 고구마 → 당근 → 옥수수 → 토마토 → 해바라기)을 캠퍼스-층 목록 순서대로 돌려 씀.
 *   목록 순서 = 고르기 창 순서(캠퍼스 순서, 그 안에서 층 순서), 대전 층은 세지 않고 건너뜀 → 지금 층이면 서울 2·3·12 = 호박·사과·딸기, 광주 1 = 고구마, 구미 2·3 = 당근·옥수수, 부울경 1 = 토마토
 *   (대전 아닌 층이 7개라 해바라기는 아직 안 나옴. 8번째 층이 생기면 해바라기)
 * - 같은 캠퍼스 층은 목록에서 붙어 있어서 8개 층까지는 작물이 다름(대전만 전부 빵) → 사다리로 층을 옮기면 바로 다른 들판인 걸 앎
 * - 학기가 바뀌어도 같은 캠퍼스-층은 같은 작물 (목록에 없는 층은 캠퍼스-층 이름으로 고름)
 * - 층 번호를 개수로 나눈 나머지로 고르면 서울 2층·12층이 같은 작물이 될 수 있어서 쓰지 않음
 * - 실서비스는 서버의 캠퍼스-층 설정에 작물 값을 두는 것을 제안 (목록 중간에 층이 생기면 뒤 층 작물이 밀리므로)
 */
export const CROPS = [
  { id: 'pumpkin', name: '호박' }, { id: 'apple', name: '사과' }, { id: 'strawberry', name: '딸기' },
  { id: 'sweetpotato', name: '고구마' }, { id: 'carrot', name: '당근' },
  { id: 'corn', name: '옥수수' }, { id: 'tomato', name: '토마토' }, { id: 'sunflower', name: '해바라기' }, { id: 'bread', name: '빵' },
] as const
export type Crop = (typeof CROPS)[number]
/** 빵이 나오는 캠퍼스 */
export const BREAD_CAMPUS = '대전'
const BREAD = CROPS.find((c) => c.id === 'bread')!
/** 대전이 아닌 층이 돌려 쓰는 8종 (CROPS 순서 그대로, 빵만 뺌) */
const ROTATION = CROPS.filter((c) => c.id !== 'bread')
export function cropOf(f: Pick<Floor, 'campus' | 'floor'>): Crop {
  if (f.campus === BREAD_CAMPUS) return BREAD
  const others = CAMPUS_FLOORS.filter((c) => c.campus !== BREAD_CAMPUS).flatMap((c) => c.floors.map((fl) => `${c.campus}|${fl}`))
  const i = others.indexOf(`${f.campus}|${f.floor}`)
  return ROTATION[(i >= 0 ? i : hash(`${f.campus}|${f.floor}`)) % ROTATION.length]
}

/** 내 소속 (내 정보 수정에서 바꾸는 값. 기수는 SSAFY 인증 값). 목 서버의 user_profile — 이사(moveMyBurrow)하면 이 객체의 값이 바뀜 */
export const ME_HOME = { campus: '서울', gen: 16, floor: 2 }
/**
 * 이번 학기 내 땅굴이 있는 들판, 그리고 내가 지난 학기에 땅굴이 있던 들판.
 * MY_FLOOR 는 목 서버의 burrow_entrance 라서 이사(moveMyBurrow)하면 이 객체의 값이 바뀜 (화면은 API 로 받은 값을 쓸 것)
 */
export const MY_FLOOR: Floor = { id: floorId(CURRENT_TERM, '서울', 2), term: CURRENT_TERM, campus: '서울', floor: 2 }
export const MY_PAST_FLOORS: Floor[] = [{ id: floorId('2026 상반기', '서울', 12), term: '2026 상반기', campus: '서울', floor: 12 }]
/** 처음 내 자리 번호 (이번 학기 서울-2층 들판) */
export const MY_SEAT = 13
/** 지금 내 자리 번호 (이사하면 그 들판의 다음 번호) */
let mySeatNow = MY_SEAT

/**
 * 새 학기 안내 시연 (05 새 학기 안내, 목 서버 전용). true 면 "새 학기 들판이 열렸는데 아직 고르지 않은 계정":
 * 내 땅굴 입구가 지난 학기 들판(2026 상반기 · 지금 소속 캠퍼스-층)에 있고, 탐색 API 는 403 NEW_TERM_INCOMPLETE (api/explore/mock.ts).
 * 이사(moveMyBurrow)하면 false. 메모리에만 둠 (새로고침하면 처음 상태)
 */
let newTermPending = false
export const isNewTermPending = () => newTermPending
/** 새 학기 안내 시연 시작 (?newterm=demo). 내 입구를 지난 학기 들판으로 */
export function startNewTermDemo() {
  if (newTermPending) return
  newTermPending = true
  mySeatNow = MY_SEAT
  residentCache.clear()
}
/** 지금 내 땅굴 입구가 놓인 들판 · 자리 (목 서버의 burrow_entrance) */
export function myEntrance(): { floor: Floor; seat: number } {
  if (newTermPending) {
    const term = TERMS[1]
    return { floor: { id: floorId(term, ME_HOME.campus, ME_HOME.floor), term, campus: ME_HOME.campus, floor: ME_HOME.floor }, seat: mySeatNow }
  }
  return { floor: MY_FLOOR, seat: mySeatNow }
}
/**
 * 내 땅굴을 이번 학기의 고른 캠퍼스-층으로 옮김 (05 POST /me/burrow/move · 04 내 정보 수정의 캠퍼스-층 저장).
 * 프로필의 캠퍼스 · 층(ME_HOME)도 같이 바뀜. 자리는 그 들판의 다음 번호 (처음 자리인 서울-2층으로 돌아오면 13번)
 */
export function moveMyBurrow(campus: string, floor: number) {
  newTermPending = false
  ME_HOME.campus = campus; ME_HOME.floor = floor
  Object.assign(MY_FLOOR, { id: floorId(CURRENT_TERM, campus, floor), campus, floor })
  residentCache.clear()
  const fill = FLOOR_FILL[MY_FLOOR.id]
  mySeatNow = campus === '서울' && floor === 2 ? MY_SEAT : (fill?.max ?? 5 + (hash(MY_FLOOR.id) % 30)) + 1
}

/* ---------- 시드 난수 ---------- */
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed: string) {
  let a = hash(seed) || 1
  return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296 }
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)]
/**
 * 관심사는 고른 사람 수(목 인원수)에 비례해 뽑음 (2026-11-17, docs/interest-effects.md). 예전엔 65개를 똑같은 확률로 뽑아서
 * 운석수집(30명)·아마추어무선(45명) 같은 드문 취미가 고양이(3,300명)만큼 흔했고, 들판의 "드문 관심사 반짝"이 절반의 구멍에 떴음
 */
const POP = CATEGORIES.flatMap((c) => c.tags.map((t) => ({ name: t.name, w: t.count })))
const POP_SUM = POP.reduce((n, p) => n + p.w, 0)
const pickPopular = (r: () => number) => { let x = r() * POP_SUM; for (const p of POP) { x -= p.w; if (x < 0) return p.name } return POP[POP.length - 1].name }

const NAMES = ['도토리', '보리', '콩떡', '말랑', '누룽지', '호떡', '감자', '모찌', '나무늘보', '솜사탕', '고구마', '두부', '찹쌀', '밤톨', '깨비', '단호박',
  '수수', '오디', '라임', '버터', '쿠키', '젤리', '산들', '구름', '별똥', '새싹', '이슬', '바람', '파도', '노을', '해솔', '다래', '자두', '살구', '앵두',
  '하루', '오늘', '여름', '가을', '겨울', '봄비', '달빛', '소금', '후추', '김밥', '라떼', '모카', '치즈', '꿀벌', '토끼풀', '민들레', '해바라기', '도롱뇽',
  '고슴도치', '부엉이', '다람쥐', '너구리', '수달', '판다', '펭귄', '알파카', '코알라', '햄찌', '참새', '까치', '오리', '거북', '달팽이', '반딧불']
const INTROS = [
  '조용히 구경하는 거 좋아해요. 말 걸어 주시면 반가워요!', '퇴근하고 뭐 하는지 이야기 나눠요 :)', '취미 친구 구해요. 같이 하면 더 재밌잖아요',
  '느리게 친해지는 편이에요. 방명록부터 남겨 주세요', '주말마다 새로운 걸 해 보려고 해요', '', '맛있는 거 추천해 주세요!', '',
]
const QUESTIONS = [
  '가장 좋아하는 음식은 뭐예요?', '요즘 가장 자주 듣는 노래 한 곡은?', '주말 아침, 눈 뜨면 가장 먼저 하는 일은?', '가방 속에 늘 들어 있는 물건은?',
  '하루 동안 투명 인간이 된다면 뭐 해볼래요?', '비 오는 날 꼭 하고 싶은 일은?',
]
const ANSWERS: Record<string, string[]> = {
  '가장 좋아하는 음식은 뭐예요?': ['마라탕 3단계요. 매운데 못 끊어요', '엄마표 된장찌개', '편의점 삼각김밥 참치마요'],
  '요즘 가장 자주 듣는 노래 한 곡은?': ['출근길 시티팝 플레이리스트', '게임 OST만 돌려 들어요', '잔잔한 피아노 곡'],
  '주말 아침, 눈 뜨면 가장 먼저 하는 일은?': ['고양이 밥부터 줘요', '이불 속에서 한참 뒹굴기', '커피 내리기'],
  '가방 속에 늘 들어 있는 물건은?': ['필름카메라', '보조배터리 두 개', '작은 스케치북'],
  '하루 동안 투명 인간이 된다면 뭐 해볼래요?': ['맛집 주방 몰래 구경하기', '도서관에서 밤새 책 읽기', '공연장 맨 앞줄 가기'],
  '비 오는 날 꼭 하고 싶은 일은?': ['창가에서 라면 먹으면서 영화', '빗소리 들으면서 낮잠', '우산 쓰고 동네 산책'],
}
const WORN = [['hat_beret', 'prop_palette'], ['hat_straw', 'glasses_sun'], ['headphones', 'bowtie'], ['scarf_knit', 'prop_cup'], [], ['glasses_round', 'prop_book'], ['camera_neck']]

/** 실명 목 사용자들의 소속 (반은 받지도 보여주지도 않음 — 00 공통 4) */
const KNOWN: Record<string, { campus: string; gen: number; floor: number; seat: number }> = {
  yerin: { campus: '서울', gen: 16, floor: 2, seat: 1 },
  seobeok: { campus: '서울', gen: 16, floor: 2, seat: 2 },
  seoyeon: { campus: '서울', gen: 16, floor: 2, seat: 6 },
  mingu: { campus: '서울', gen: 16, floor: 2, seat: 9 },
  yejin: { campus: '서울', gen: 16, floor: 2, seat: 14 },
  ha: { campus: '서울', gen: 16, floor: 2, seat: 12 },
  kim: { campus: '서울', gen: 13, floor: 3, seat: 4 },
  lee: { campus: '서울', gen: 16, floor: 3, seat: 8 },
  park: { campus: '대전', gen: 16, floor: 1, seat: 2 },
  choi: { campus: '구미', gen: 16, floor: 2, seat: 3 },
}

/**
 * 오늘의 추천 친구(기수를 고름)가 "0명"으로 나오지 않게: 이번 학기 들판은 어느 기수를 골라도 후보가 3명 이상 있어야 함 (2026-11-22).
 * 기수 목록(GENERATIONS 5개)마다 이 수만큼은 목 사용자를 반드시 두어 채움 (실명 목 · 나 · 단골이 후보에서 빠져도 3명이 남게 3명 + 여유 1)
 */
export const MIN_PER_GEN = 4
const GEN_NUMS = GENERATIONS.map((g) => parseInt(g, 10))
/** 들판마다 배정된 번호 (가장 큰 번호)와 탈퇴로 빈 번호. 이번 학기 서울-2층은 38자리 → 구역 2개 */
const FLOOR_FILL: Record<string, { max: number; vacant?: number[] }> = {
  [floorId(CURRENT_TERM, '서울', 2)]: { max: 38, vacant: [7, 31] },
  [floorId(CURRENT_TERM, '서울', 3)]: { max: 61, vacant: [20] },
  [floorId(CURRENT_TERM, '서울', 12)]: { max: 25 },
  [floorId(CURRENT_TERM, '대전', 1)]: { max: 24 },
  [floorId(CURRENT_TERM, '대전', 2)]: { max: 25 },
  [floorId(CURRENT_TERM, '광주', 1)]: { max: 31 },
  [floorId(CURRENT_TERM, '구미', 2)]: { max: 25 },
  [floorId(CURRENT_TERM, '구미', 3)]: { max: 25 },
  [floorId(CURRENT_TERM, '부울경', 1)]: { max: 25 },
  [floorId('2026 상반기', '부울경', 1)]: { max: 0 }, // 빈 들판 (빈 상태 확인용. 이번 학기 들판은 추천 후보가 있어야 해서 지난 학기로 둠)
  [floorId('2026 상반기', '서울', 12)]: { max: 44 },
}

export interface Resident {
  seat: number
  user: FieldUser
  mine?: boolean
  /** 나와 겹치는 관심사 이름 (API 의 isShared). 없으면 화면이 내 관심사와 비교 (목 데이터를 바로 쓰는 시안 B·C·D) */
  shared?: string[]
  /** 땅굴 id (API 의 burrowId, 앱 id) */
  burrowId?: string
}
export interface FieldData { floor: Floor; residents: Resident[]; /** 배정된 가장 큰 번호 */ maxSeat: number; zones: number; mySeat: number | null }

const residentCache = new Map<string, FieldData>()
const byId = new Map<string, FieldUser>()

function makeUser(f: Floor, seat: number, genOf?: number): FieldUser {
  const r = rng(`${f.id}#${seat}`)
  const n = 3 + Math.floor(r() * 6)
  const interests: string[] = []
  while (interests.length < n) { const s = pickPopular(r); if (!interests.includes(s)) interests.push(s) }
  const qs = [...QUESTIONS].sort(() => r() - .5).slice(0, 3)
  const qna: QnA[] = qs.map((q, i) => ({ q: `Q${i + 1}. ${q}`, a: pick(r, ANSWERS[q]) }))
  const nick = pick(r, NAMES)
  const gen = (() => { const x = r(); return genOf ?? (x < .8 ? 16 : 15) })()
  return {
    id: `f${hash(f.id).toString(36)}-${seat}`, nickname: nick, affiliation: '', intro: pick(r, INTROS), interests, qna,
    online: r() < .25, worn: pick(r, WORN), campus: f.campus, gen, floor: f.floor,
  }
}

/** 들판의 땅굴 주인들 (서버가 돌려줄 값을 흉내) */
export function fieldOf(f: Floor): FieldData {
  const hit = residentCache.get(f.id)
  if (hit) return hit
  const fill = FLOOR_FILL[f.id] ?? { max: 5 + (hash(f.id) % 30) }
  const home = myEntrance()
  const isMine = f.id === home.floor.id
  const mySeat = home.seat
  const residents: Resident[] = []
  const known = Object.entries(KNOWN).filter(([, k]) => f.term === CURRENT_TERM && k.campus === f.campus && k.floor === f.floor)
  // 목 사용자의 기수: 처음 MIN_PER_GEN × 기수 수 명은 기수를 돌아가며 (어느 기수를 골라도 추천 후보가 3명 이상), 그 뒤는 16기가 가장 많게
  const genStart = hash(f.id) % GEN_NUMS.length
  let made = 0
  const genFor = (seat: number) => {
    const n = made++
    if (n < MIN_PER_GEN * GEN_NUMS.length) return GEN_NUMS[(n + genStart) % GEN_NUMS.length]
    const x = rng(`${f.id}#${seat}#gen`)()
    return x < .55 ? 16 : x < .8 ? 15 : x < .9 ? 14 : x < .96 ? 13 : 12
  }
  for (let seat = 1; seat <= fill.max; seat++) {
    if (fill.vacant?.includes(seat)) continue
    if (isMine && seat === mySeat) { residents.push({ seat, user: me(), mine: true }); continue }
    const k = known.find(([, v]) => v.seat === seat)
    const user: FieldUser = k ? { ...USERS[k[0]], campus: k[1].campus, gen: k[1].gen, floor: k[1].floor } : makeUser(f, seat, genFor(seat))
    if (!k) { byId.set(user.id, user); USERS[user.id] ??= user }
    residents.push({ seat, user })
  }
  // 내 자리가 배정된 번호보다 뒤면 (이사해 와서 다음 번호를 받음) 맨 뒤에 둠
  if (isMine && mySeat > fill.max) residents.push({ seat: mySeat, user: me(), mine: true })
  const maxSeat = Math.max(fill.max, isMine ? mySeat : 0)
  const data: FieldData = { floor: f, residents, maxSeat, zones: Math.max(1, Math.ceil(maxSeat / 25)), mySeat: isMine ? mySeat : null }
  residentCache.set(f.id, data)
  return data
}

export function me(): FieldUser {
  const u = USERS[ME_ID]
  return { ...u, interests: getMyInterests(u.interests), ...ME_HOME }
}

/** 소속 한 줄: "SSAFY 16기 · 서울 · 2층" (반은 쓰지 않음) */
export function affOf(u: User): string {
  const f = u as Partial<FieldUser>
  if (f.campus) return `SSAFY ${f.gen}기 · ${f.campus} · ${f.floor}층`
  const k = KNOWN[u.id]
  if (k) return `SSAFY ${k.gen}기 · ${k.campus} · ${k.floor}층`
  return u.affiliation
}
/** 단골 목록용 짧은 소속: "서울 · 16기 · 2층" */
export function shortAffOf(u: User): string {
  const f = u as Partial<FieldUser>
  const k = f.campus ? { campus: f.campus, gen: f.gen, floor: f.floor } : KNOWN[u.id]
  return k ? `${k.campus} · ${k.gen}기 · ${k.floor}층` : u.affiliation
}

/** id 로 사람 찾기 (들판에서 만든 사람 포함). 방문자 뷰가 직접 열렸을 때를 위해 이번 학기 들판을 모두 만들어 봄 */
export function fieldUserOf(id: string): User | undefined {
  if (USERS[id]) return USERS[id]
  if (!byId.has(id)) allCurrentFloors().forEach(fieldOf)
  return byId.get(id)
}

/** 이번 학기에 그 사람 땅굴이 있는 들판과 자리 (방문자 뷰에서 "탐색"을 누르면 그 들판의 그 구멍으로 — 00 공통 13) */
export function locateUser(id: string): { floor: Floor; seat: number } | null {
  if (id === ME_ID) return myEntrance()
  for (const f of allCurrentFloors()) {
    const r = fieldOf(f).residents.find((x) => x.user.id === id)
    if (r) return { floor: f, seat: r.seat }
  }
  return null
}
/** 탐색 화면 주소 (그 들판의 그 자리) */
export const exploreHref = (floor: Floor, seat?: number) =>
  `/burrow/explore?floor=${encodeURIComponent(floor.id)}${seat ? `&seat=${seat}` : ''}`

export function allCurrentFloors(): Floor[] {
  return CAMPUS_FLOORS.flatMap((c) => c.floors.map((fl) => ({ id: floorId(CURRENT_TERM, c.campus, fl), term: CURRENT_TERM, campus: c.campus, floor: fl })))
}

/* ---------- 저장 (서버 대신 localStorage. 막힌 곳에서는 이 페이지 안에서만 기억) ---------- */
function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v) as T } catch { /* 저장소 없음 */ }
  return fallback
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* 무시 */ } }

/* 단골 땅굴: 상대 수락 없이 추가, 해제해도 상대에게 알리지 않음 (F5 방문자 뷰 · 단골 땅굴 목록) */
const REG_KEY = 'digul.regulars'
const REG_AT_KEY = 'digul.regulars.at'
let regulars: string[] = load(REG_KEY, ['yerin', 'seobeok'])
/** 단골로 담은 시각 (ms, regular_burrow.created_at). 처음 목 데이터는 하루씩 앞으로 */
let regularAt: Record<string, number> = load(REG_AT_KEY, {})
const regSubs = new Set<() => void>()
/** 단골 주인 id (최근에 담은 것부터) */
export const getRegulars = () => regulars
export const isRegular = (id: string) => regulars.includes(id)
export const regularSince = (id: string) => regularAt[id] ?? Date.now() - (regulars.indexOf(id) + 1) * 86_400_000
export function setRegular(id: string, on: boolean) {
  if (on === regulars.includes(id)) return // 이미 그 상태면 바꾸지 않음 (PUT · DELETE 멱등)
  regulars = on ? [id, ...regulars] : regulars.filter((x) => x !== id)
  if (on) regularAt = { ...regularAt, [id]: Date.now() }
  else { const next = { ...regularAt }; delete next[id]; regularAt = next }
  save(REG_KEY, regulars); save(REG_AT_KEY, regularAt); regSubs.forEach((f) => f())
}
export const subscribeRegulars = (f: () => void) => { regSubs.add(f); return () => { regSubs.delete(f) } }

/**
 * 오늘의 추천 친구 (02 F5 "추천 친구 설정" 2 · 4, 2026-11-21 명세):
 * 조건은 캠퍼스 · 층과 기수뿐이고 **고른 값은 저장하지 않음**(받을 때마다 다시 고름). 관심사 · 질문 같은 다른 조건은 없음.
 * 뽑는 규칙: 고른 캠퍼스 · 층의 이번 학기 들판에 땅굴이 있고 기수가 같은 사람, 내가 단골로 담은 땅굴 주인은 뺌,
 * 나에게 추천된 횟수가 적은 사람 먼저 (같으면 무작위), 최대 3명. 지금 보고 있는 들판과 관계없음. 추천은 하루 한 번
 */
export interface RecommendPick { campus: string; floor: number; gen: number }
const REC_KEY = 'digul.recommend'
interface RecState {
  /** 오늘 받았으면 그 날짜 */
  date: string | null
  picks: string[]
  /** 사람마다 나에게 추천된 횟수 (서버의 daily_recommendation_member 줄 수). 지난 날 결과도 지우지 않고 셈 */
  counts: Record<string, number>
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
function recState(): RecState {
  // 2026-11-21 전에 저장된 값에는 settings(관심사·질문·같은 캠퍼스…)가 들어 있었음 → 쓰지 않고, 다음에 저장할 때 사라짐
  const st = load<Partial<RecState>>(REC_KEY, {})
  return { date: st.date ?? null, picks: st.picks ?? [], counts: st.counts ?? {} }
}
let rec = recState()
/** 오늘 이미 받았으면 그 3명 (id), 아니면 null */
export const todaysPicks = (): string[] | null => (rec.date === today() ? rec.picks : null)
/** 개발용: 오늘 받은 추천을 지움 (?recommend=reset). 추천 횟수는 그대로 */
export function resetToday() { rec = { ...rec, date: null, picks: [] }; save(REC_KEY, rec) }

/** 이 조건에 맞는 후보 (추천 순서는 정하기 전) */
export function recommendPool(sel: RecommendPick): FieldUser[] {
  const f: Floor = { id: floorId(CURRENT_TERM, sel.campus, sel.floor), term: CURRENT_TERM, campus: sel.campus, floor: sel.floor }
  if (!CAMPUS_FLOORS.some((c) => c.campus === sel.campus && c.floors.includes(sel.floor))) return []
  const regular = new Set(getRegulars())
  return fieldOf(f).residents.filter((r) => !r.mine && r.user.gen === sel.gen && !regular.has(r.user.id)).map((r) => r.user)
}

/** 추천 받기. 오늘 이미 받았으면 그 결과를 그대로 (새로 뽑지 않음, 조건을 바꿔 다시 보내도 처음 결과) */
export function drawRecommendations(sel: RecommendPick): string[] {
  const done = todaysPicks()
  if (done) return done
  const r = rng(`rec#${today()}#${sel.campus}${sel.floor}#${sel.gen}`)
  const picks = recommendPool(sel)
    .map((u) => ({ id: u.id, n: rec.counts[u.id] ?? 0, tie: r() }))
    .sort((a, b) => a.n - b.n || a.tie - b.tie)
    .slice(0, 3).map((x) => x.id)
  const counts = { ...rec.counts }
  for (const id of picks) counts[id] = (counts[id] ?? 0) + 1
  rec = { date: today(), picks, counts }
  save(REC_KEY, rec)
  return picks
}
