import type {
  Category, GuestbookEntry, Meetup, Tone, User,
} from './types'
import { toIso } from '../lib/time'
import { INTEREST_CATS, subOf, subsIn } from './interests'

/* ===== 관심 분야 11종 · 세부 관심사 65개 (3D 핸드오프 v3 interest_catalog.json, data/interests.ts) ===== */
// 이름·순서는 카탈로그에서 읽고, 여기에는 화면 꾸밈(이모지·색)과 목 인원수만 둠
const CAT_LOOK: Record<string, { emoji: string; tone: Tone }> = {
  music: { emoji: '🎵', tone: 'lilac' }, photo: { emoji: '📷', tone: 'mint' }, nature: { emoji: '🌿', tone: 'sage' },
  game: { emoji: '🎮', tone: 'sky' }, craft: { emoji: '🧶', tone: 'clay' }, book: { emoji: '📚', tone: 'butter' },
  science: { emoji: '🔭', tone: 'sky' }, tea_coffee: { emoji: '☕', tone: 'butter' }, outdoor: { emoji: '🥾', tone: 'sand' },
  movie: { emoji: '🎬', tone: 'rose' }, pet: { emoji: '🐾', tone: 'clay' },
}
/** 같은 관심사를 고른 사람 수 (목 데이터. 적을수록 니치 → 방 무드 가중치·온보딩 숫자) */
const TAG_COUNTS: Record<string, number> = {
  city_pop: 1240, lp_collecting: 860, jazz: 2100, indie_band: 3400, guitar_play: 2700, synth_compose: 640, piano: 1320, drums: 980, oldies: 1450,
  film_camera: 720, photo_walk: 2600,
  terrarium: 210, houseplants: 2300, tropical_fish: 380, bonsai: 170, succulents: 1500, mushroom_grow: 60,
  retro_game: 640, mech_keyboard: 910, figures: 1300, board_game: 1900, pc_build: 1100, arcade: 450, gunpla: 820, chess: 260, speed_cube: 190, magic: 95,
  knitting: 420, watercolor: 1600, pottery: 350, embroidery: 280, sewing: 330, model_railway: 75,
  sf_novel: 690, poetry: 540, transcription: 310, typewriter: 120,
  stargazing: 450, constellations: 380, fossils: 90, minerals: 140, map_globe: 230, ham_radio: 45, meteorites: 30, insect_specimens: 70, dinosaurs: 520,
  black_tea: 680, hand_drip: 760, baking: 1700, espresso: 900, tea_ceremony: 190,
  camping: 2600, cycling: 2400, climbing: 880, yoga: 1900, skateboard: 410,
  classic_film: 610, animation: 2400, comics: 1800, vhs: 85,
  cat: 3300, dog: 3100, parrot: 160, lizard: 120, ant_farm: 40,
}

export const CATEGORIES: Category[] = INTEREST_CATS.map((c) => ({
  id: c.id, name: c.name_ko, emoji: CAT_LOOK[c.id]?.emoji ?? '🌱', tone: CAT_LOOK[c.id]?.tone ?? 'sand',
  tags: subsIn(c.id).map((t) => ({ id: t.id, name: t.name_ko, count: TAG_COUNTS[t.id] ?? 500 })),
}))

/**
 * 게시판·모임에 붙은 예전 주제 이름 → 카테고리 (관심사 v2 목록에 없는 말이라 따로 연결).
 * 세부 관심사 이름이면 카탈로그로 바로 찾음
 */
const TOPIC_CATEGORY: Record<string, string> = {
  독서: 'book', 에세이: 'book', 'SF 소설': 'book', 그림: 'craft', 요리: 'tea_coffee', 홈카페: 'tea_coffee',
  러닝: 'outdoor', 운동: 'outdoor', 여행: 'outdoor', 등산: 'outdoor', 지브리: 'movie', 영화: 'movie',
  사진: 'photo', 게임: 'game', 음악: 'music', 공연: 'music',
}

/** 관심사(세부 관심사 이름·예전 주제 이름·카테고리 이름) → 카테고리 */
export function categoryOf(interest: string): Category | undefined {
  const id = subOf(interest)?.category ?? TOPIC_CATEGORY[interest]
  return CATEGORIES.find((c) => c.id === id || c.name === interest)
}

/** 스크린샷에서 확인한 칩 색. 나머지는 분류 색을 따른다 */
const TONE_OVERRIDE: Record<string, Tone> = {
  캠핑: 'sage', 게임: 'sky', 독서: 'butter', 음악: 'lilac', 피아노: 'rose',
  그림: 'clay', 사진: 'mint', 운동: 'sand', 여행: 'sky', 요리: 'butter',
}

export function toneOf(interest: string): Tone {
  if (TONE_OVERRIDE[interest]) return TONE_OVERRIDE[interest]
  return categoryOf(interest)?.tone ?? 'sand'
}

/* ===== 사람 ===== */
export const ME_ID = 'me'

export const USERS: Record<string, User> = {
  me: {
    id: 'me', nickname: '닉네임', affiliation: 'SSAFY 16기 · 지역 · 0반', intro: '',
    interests: ['캠핑', '레트로게임', 'SF소설', '시티팝', '피아노', '수채화', '필름카메라', '고전영화', '핸드드립', '자전거'],
    visitorsNow: 2,
  },
  seobeok: { id: 'seobeok', nickname: '서벅이', affiliation: 'SSAFY 16기 · 서울 · 3반', intro: '', interests: ['수채화', '보드게임'], worn: ['hat_beret', 'glasses_round', 'scarf_stripe', 'prop_palette'] },
  yerin: {
    id: 'yerin', nickname: '예린', affiliation: 'SSAFY 서울 2반', online: true,
    intro: '안녕하세요. 저는 먹는 것을 좋아하는 개발자입니다. 제 방에 놀러오세요~~',
    interests: ['캠핑', '베이킹', '수채화', '레트로게임', '고양이'],
    worn: ['hat_chef', 'glasses_round', 'scarf_knit', 'prop_cup'],
    qna: [
      { q: 'Q1. 쉬는 날에는 주로 무엇을 하나요?', a: '낮잠 자고 오후 늦게 일어납니다... 그리고 뒹굴 뒹굴' },
      { q: 'Q2. 어떤 사람과 친해지고 싶나요?', a: '개인적으로 mbti가 INTP이신 분들이 좋습니다.' },
      { q: 'Q3. 내 방에 놀러 온 사람들에게 한마디!', a: '방 구경하시고 편하게 연락주세요!!!' },
    ],
  },
  seoyeon: { id: 'seoyeon', nickname: '서연', affiliation: 'SSAFY 16기 · 서울 · 5반', intro: '', interests: ['시집', '필사', '필름카메라'], online: true, worn: ['hat_straw', 'glasses_sun', 'camera_neck', 'prop_book'] },
  mingu: { id: 'mingu', nickname: '민구', affiliation: 'SSAFY 16기 · 서울 · 1반', intro: '', interests: ['SF소설', '레트로게임'], worn: ['headphones', 'glasses_sun', 'bowtie', 'prop_gamepad'] },
  yejin: { id: 'yejin', nickname: '예진', affiliation: 'SSAFY 16기 · 서울 · 4반', intro: '', interests: ['시집', '핸드드립'] },
  kim: { id: 'kim', nickname: '김OO', affiliation: 'SSAFY 13기 · 서울', intro: '', interests: ['SF소설', '시집', '캠핑'] },
  lee: { id: 'lee', nickname: '이OO', affiliation: 'SSAFY 16기 · 서울', intro: '', interests: ['SF소설'] },
  park: { id: 'park', nickname: '박OO', affiliation: 'SSAFY 16기 · 대전', intro: '', interests: ['SF소설', '수채화'] },
  choi: { id: 'choi', nickname: '최OO', affiliation: 'SSAFY 16기 · 구미', intro: '', interests: ['필사'] },
  ha: { id: 'ha', nickname: '하늘', affiliation: 'SSAFY 서울 6반', intro: '', interests: ['캠핑', '사진산책'] },
}

export const userOf = (id: string): User => USERS[id] ?? USERS.seobeok

/* ===== 방명록 ===== */
/** N분 전 → ISO 8601 + 오프셋 (서버 규약과 같은 모양, lib/time.ts) */
const minutesAgo = (m: number) => toIso(Date.now() - m * 60_000)

const GB_TEXTS = [
  '이젤 너무 귀엽다. 그림 스터디 열리면 꼭 불러줘!',
  '이젤 너무 귀엽다. 그림 스터디 열리면 꼭꼭꼭 불러줘! 진짜로!',
  '이젤 너무 귀엽다. 그림 스터디 열리면 꼭 불러줘!',
  '캠핑 배낭 보고 반가워서 들렀어요. 가평 모임 같이 가요!',
  '피아노 소리 들리는 것 같은 땅굴이네요 🎹',
  '오락기 실제로 돌아가나요? 한 판 하고 갑니다',
  '책장 구경 잘했어요. 추천 책 하나만 알려주세요',
  '전구 줄 장식 어디서 구하셨어요? 너무 예뻐요',
  '카메라 삼각대 탐나요… 출사 모임도 열어주세요',
  '요리 좋아하시는구나! 레시피 교환해요',
  '빈백에 누워 있다 갑니다 ㅎㅎ',
  '두더지 너무 동글동글해요',
]
const GB_AGO = [0, 3, 8, 45, 120, 300, 720, 1500, 2900, 4300, 6100, 8600]

export const GUESTBOOK: GuestbookEntry[] = [
  ...GB_TEXTS.map((text, i) => ({
    id: `gb${i + 1}`,
    authorId: i < 3 ? 'seobeok' : ['yerin', 'seoyeon', 'mingu', 'yejin', 'ha'][i % 5],
    text,
    createdAt: minutesAgo(GB_AGO[i]),
  })),
  // 8일 지난 글 — 7일 자동 삭제 규칙으로 화면에 안 보여야 한다
  { id: 'gb-old', authorId: 'kim', text: '(8일 지난 방명록 — 보이면 안 됨)', createdAt: minutesAgo(8 * 24 * 60) },
]

/* ===== 게시판: data/boardStore.ts ===== */

/* ===== 모임 ===== */
export const MEETUPS: Meetup[] = [
  {
    id: 'm1', title: '주말의 작은 독서 모임', interest: '독서', date: '2026-11-08', start: '오후 2:00', end: '오후 4:00',
    area: '성수동', place: '성수동 어반플레이스 3층', mode: '오프라인', capacity: 6,
    memberIds: ['kim', 'lee', 'park', 'choi'], hostId: 'kim', myStatus: '참여 확정', sign: '독서 모임',
    intro: '한 주에 한 권씩, 각자 읽은 책을 들고 모입니다. 발제나 독후감 같은 건 없어요. 읽다가 접어둔 페이지를 펴놓고 두 시간쯤 이야기합니다. 처음 오시는 분은 다 못 읽고 오셔도 괜찮아요.',
  },
  {
    id: 'm2', title: '퇴근 후 보드게임 한 판', interest: '보드게임', date: '2026-11-06', start: '오후 7:00', end: '오후 10:00',
    area: '역삼', place: '역삼역 보드게임 카페', mode: '오프라인', capacity: 6,
    memberIds: ['mingu', 'ha', 'lee'], hostId: 'mingu', myStatus: '신청 대기', sign: '보드게임', myNote: '보드게임은 처음인데 괜찮을까요? 규칙 미리 공부해 갈게요!',
    intro: '룰 설명부터 천천히 해드려요. 가벼운 파티 게임 위주로 합니다.',
  },
  {
    id: 'm3', title: '일요일 아침 드로잉', interest: '그림', date: '2026-11-22', start: '오전 10:00', end: '오후 12:00',
    area: '망원', place: '망원 한강공원', mode: '오프라인', capacity: 6,
    memberIds: ['me', 'park', 'seobeok'], hostId: 'me', myStatus: '내가 주최', sign: '드로잉',
    intro: '연필 한 자루랑 스케치북만 챙겨오세요. 잘 그리는 것보다 같이 그리는 게 목적이에요.',
  },
  {
    id: 'm4', title: '초보 환영, 가평 1박 캠핑', interest: '캠핑', date: '2026-11-15', start: '오전 10:00', end: '다음 날 오전 11:00',
    area: '가평', place: '가평 자라섬 캠핑장', mode: '오프라인', capacity: 8,
    memberIds: ['yerin', 'ha', 'kim', 'seoyeon', 'mingu'], hostId: 'yerin', myStatus: '참여 확정', sign: '가평 캠핑',
    intro: '장비 없어도 괜찮아요. 공용 텐트 두 동 준비했어요.',
  },
  { id: 'm5', title: '시티팝 LP 듣는 밤', interest: '시티팝', date: '2026-11-19', start: '오후 8:00', end: '오후 10:00', area: '온라인', place: '디스코드', mode: '온라인', capacity: 10, memberIds: ['seoyeon', 'yejin'], hostId: 'seoyeon', myStatus: '찜', sign: 'LP 듣는 밤', intro: '각자 좋아하는 한 곡씩 틀어요.' },
  { id: 'm6', title: '테라리움 같이 만들어요', interest: '테라리움', date: '2026-11-23', start: '오후 3:00', end: '오후 5:00', area: '연남동', place: '연남동 공방', mode: '오프라인', capacity: 5, memberIds: ['choi'], hostId: 'choi', sign: '테라리움', intro: '재료비 1만 원. 작은 유리병 하나씩 가져가요.' },
  { id: 'm7', title: '역삼 점심 러닝 크루', interest: '러닝', date: '2026-11-12', start: '오후 12:10', end: '오후 12:50', area: '역삼', place: '선릉공원 입구', mode: '오프라인', capacity: 12, memberIds: ['ha', 'mingu', 'lee', 'park'], hostId: 'ha', myStatus: '찜', sign: '점심 러닝', intro: '3km 천천히 뛰어요.' },
  { id: 'm8', title: '홈카페 원두 나눔회', interest: '홈카페', date: '2026-11-29', start: '오후 2:00', end: '오후 4:00', area: '성수동', place: '성수 카페거리', mode: '오프라인', capacity: 6, memberIds: ['yejin', 'seoyeon'], hostId: 'yejin', myStatus: '찜', sign: '원두 나눔', intro: '집에 남는 원두 가져와서 바꿔 마셔요.' },
  { id: 'm9', title: '지브리 영화 같이 보기', interest: '지브리', date: '2026-11-07', start: '오후 9:00', end: '오후 11:00', area: '온라인', place: '왓챠 파티', mode: '온라인', capacity: 8, memberIds: ['yerin', 'seobeok', 'park'], hostId: 'seobeok', sign: '지브리', intro: '이번 주는 하울의 움직이는 성!' },
  { id: 'm10', title: '한강 5km 같이 뛰어요', interest: '러닝', date: '2026-11-07', start: '오후 8:00', end: '오후 9:00', area: '반포', place: '반포 한강공원 달빛광장', mode: '오프라인', capacity: 10, memberIds: ['ha', 'mingu', 'lee', 'park', 'kim', 'choi', 'yejin', 'seoyeon', 'yerin'], hostId: 'ha', myStatus: '신청 대기', sign: '러닝', intro: '페이스 느려도 괜찮아요. 끝까지 같이 뛰어요.', myNote: '페이스는 느린 편인데 끝까지 같이 뛰어보고 싶어요!' },
]

/** 목 데이터의 "오늘" (Figma 내 모임 D-day 기준: 11/6 모임이 D-3) */
export const TODAY = '2026-11-03'
export function dday(ymd: string) {
  const d = Math.round((Date.parse(ymd) - Date.parse(TODAY)) / 86400000)
  return d === 0 ? 'D-DAY' : d > 0 ? `D-${d}` : `D+${-d}`
}

export const meetupOf = (id: string) => MEETUPS.find((m) => m.id === id)

/* ===== 채팅: data/chat.ts ===== */

/* ===== 알림: data/notifications.ts ===== */

/* ===== 공용 계산 ===== */
export function overlapCount(a: string[], b: string[]) {
  return a.filter((x) => b.includes(x)).length
}
