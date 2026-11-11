import type {
  Category, ChatRequest, ChatRoom, GuestbookEntry, Meetup, Post, Tone, User,
} from './types'
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
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

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

/* ===== 게시판 ===== */
const CAMP_BODY = [
  '지난 주말 가평으로 첫 캠핑 모임을 다녀왔어요. 다섯 명 중 세 명이 캠핑이 처음이라 텐트 치는 데만 한 시간이 걸렸지만, 다 같이 헤매는 게 오히려 재밌었어요.',
  '밤에는 불 앞에 둘러앉아서 각자 땅굴에 둔 가구 이야기를 했는데, 처음 만난 사이인데도 이야기가 끊이지 않더라고요. 다음 달에도 열어볼 생각이라 관심 있는 분들은 모임 탭에서 신청해주세요!',
]

export const POSTS: Post[] = [
  {
    id: 'p1', category: '모임 후기', interest: '캠핑', title: '첫 캠핑 모임 다녀왔어요!', body: CAMP_BODY,
    authorId: 'yerin', createdAt: '11월 3일 오후 4:12', views: 284, likes: 52, hasPhoto: true,
    comments: [
      { id: 'c1', authorId: 'ha', text: '텐트 치다가 다 같이 웃었던 거 아직도 생각나요 ㅋㅋ 다음 달에도 꼭 갈게요!', createdAt: '2시간 전', likes: 12,
        replies: [{ id: 'c1r', authorId: 'yerin', isAuthor: true, text: '네! 다음엔 타프도 챙겨갈게요', createdAt: '1시간 전', likes: 4 }] },
      { id: 'c2', authorId: 'mingu', text: '초보도 괜찮나요? 장비가 하나도 없는데 빌릴 수 있는 곳이 있으면 알려주세요.', createdAt: '40분 전', likes: 3 },
      { id: 'c3', authorId: 'seoyeon', text: '후기 읽고 저도 캠핑 가구 하나 땅굴에 들여놨어요. 모임 열리면 신청할게요!', createdAt: '12분 전', likes: 1 },
    ],
  },
  { id: 'p2', category: '정보', interest: '보드게임', title: '역삼역 근처 보드게임 카페 정리 (11월 기준)', body: ['퇴근 후 들르기 좋은 곳 위주로 모아봤어요. 자리 예약 되는 곳은 따로 표시했어요.'], authorId: 'mingu', createdAt: '11월 2일 오후 9:30', views: 412, likes: 38, comments: [], hasPhoto: true },
  { id: 'p3', category: '질문', interest: '사진', title: '필름카메라 입문용 추천 부탁드려요', body: ['땅굴에 카메라 소품만 두고 실제로는 없어요… 첫 필름카메라 뭐가 좋을까요?'], authorId: 'ha', createdAt: '11월 2일 오후 1:05', views: 156, likes: 9, comments: [] },
  { id: 'p4', category: '자유', interest: '독서', title: '이번 달에 읽은 책 한 줄씩 남겨요', body: ['저부터! SF 단편집 읽었는데 마지막 편이 제일 좋았어요.'], authorId: 'seoyeon', createdAt: '11월 1일 오후 11:40', views: 198, likes: 21, comments: [] },
  { id: 'p5', category: '모임 후기', interest: '그림', title: '일요일 아침 드로잉 3회차 후기', body: ['망원 한강공원에서 그렸어요. 날씨가 좋아서 다들 두 장씩 그렸답니다.'], authorId: 'park', createdAt: '10월 31일 오전 10:20', views: 133, likes: 17, comments: [], hasPhoto: true },
  { id: 'p6', category: '자유', interest: '요리', title: '자취방 오븐 없이 만드는 스콘', body: ['에어프라이어로도 충분해요. 레시피 공유합니다.'], authorId: 'yejin', createdAt: '10월 30일 오후 7:15', views: 301, likes: 44, comments: [] },
  { id: 'p7', category: '정보', interest: '캠핑', title: '초보 캠핑 장비 빌릴 수 있는 곳', body: ['장비 대여 업체 세 곳 비교해봤어요.'], authorId: 'kim', createdAt: '10월 29일 오후 3:00', views: 520, likes: 61, comments: [] },
]

/* ===== 모임 ===== */
export const MEETUPS: Meetup[] = [
  {
    id: 'm1', title: '주말의 작은 독서 모임', interest: '독서', date: '2026-11-08', start: '오후 2:00', end: '오후 4:00',
    area: '성수동', place: '성수동 어반플레이스 3층', mode: '오프라인', capacity: 6,
    memberIds: ['kim', 'lee', 'park', 'choi'], hostId: 'kim', myStatus: '참여 확정', closesAt: '11월 7일 (토)', sign: '독서 모임',
    intro: '한 주에 한 권씩, 각자 읽은 책을 들고 모입니다. 발제나 독후감 같은 건 없어요. 읽다가 접어둔 페이지를 펴놓고 두 시간쯤 이야기합니다. 처음 오시는 분은 다 못 읽고 오셔도 괜찮아요.',
  },
  {
    id: 'm2', title: '퇴근 후 보드게임 한 판', interest: '보드게임', date: '2026-11-06', start: '오후 7:00', end: '오후 10:00',
    area: '역삼', place: '역삼역 보드게임 카페', mode: '오프라인', capacity: 6,
    memberIds: ['mingu', 'ha', 'lee'], hostId: 'mingu', myStatus: '신청 대기', closesAt: '11월 6일 오후 3시', sign: '보드게임', myNote: '보드게임은 처음인데 괜찮을까요? 규칙 미리 공부해 갈게요!', myNoteAgo: '2시간 전 신청',
    intro: '룰 설명부터 천천히 해드려요. 가벼운 파티 게임 위주로 합니다.',
  },
  {
    id: 'm3', title: '일요일 아침 드로잉', interest: '그림', date: '2026-11-22', start: '오전 10:00', end: '오후 12:00',
    area: '망원', place: '망원 한강공원', mode: '오프라인', capacity: 6,
    memberIds: ['me', 'park', 'seobeok'], hostId: 'me', myStatus: '내가 주최', closesAt: '11월 21일 오후 6시', sign: '드로잉',
    intro: '연필 한 자루랑 스케치북만 챙겨오세요. 잘 그리는 것보다 같이 그리는 게 목적이에요.',
  },
  {
    id: 'm4', title: '초보 환영, 가평 1박 캠핑', interest: '캠핑', date: '2026-11-15', start: '오전 10:00', end: '다음 날 오전 11:00',
    area: '가평', place: '가평 자라섬 캠핑장', mode: '오프라인', capacity: 8,
    memberIds: ['yerin', 'ha', 'kim', 'seoyeon', 'mingu'], hostId: 'yerin', myStatus: '참여 확정', closesAt: '11월 13일 자정', sign: '가평 캠핑',
    intro: '장비 없어도 괜찮아요. 공용 텐트 두 동 준비했어요.',
  },
  { id: 'm5', title: '시티팝 LP 듣는 밤', interest: '시티팝', date: '2026-11-19', start: '오후 8:00', end: '오후 10:00', area: '온라인', place: '디스코드', mode: '온라인', capacity: 10, memberIds: ['seoyeon', 'yejin'], hostId: 'seoyeon', myStatus: '찜', sign: 'LP 듣는 밤', closesAt: '11월 19일 오후 6시', intro: '각자 좋아하는 한 곡씩 틀어요.' },
  { id: 'm6', title: '테라리움 같이 만들어요', interest: '테라리움', date: '2026-11-23', start: '오후 3:00', end: '오후 5:00', area: '연남동', place: '연남동 공방', mode: '오프라인', capacity: 5, memberIds: ['choi'], hostId: 'choi', sign: '테라리움', closesAt: '11월 21일', intro: '재료비 1만 원. 작은 유리병 하나씩 가져가요.' },
  { id: 'm7', title: '역삼 점심 러닝 크루', interest: '러닝', date: '2026-11-12', start: '오후 12:10', end: '오후 12:50', area: '역삼', place: '선릉공원 입구', mode: '오프라인', capacity: 12, memberIds: ['ha', 'mingu', 'lee', 'park'], hostId: 'ha', myStatus: '찜', sign: '점심 러닝', closesAt: '11월 12일 오전 9시', intro: '3km 천천히 뛰어요.' },
  { id: 'm8', title: '홈카페 원두 나눔회', interest: '홈카페', date: '2026-11-29', start: '오후 2:00', end: '오후 4:00', area: '성수동', place: '성수 카페거리', mode: '오프라인', capacity: 6, memberIds: ['yejin', 'seoyeon'], hostId: 'yejin', myStatus: '찜', sign: '원두 나눔', closesAt: '11월 27일', intro: '집에 남는 원두 가져와서 바꿔 마셔요.' },
  { id: 'm9', title: '지브리 영화 같이 보기', interest: '지브리', date: '2026-11-07', start: '오후 9:00', end: '오후 11:00', area: '온라인', place: '왓챠 파티', mode: '온라인', capacity: 8, memberIds: ['yerin', 'seobeok', 'park'], hostId: 'seobeok', sign: '지브리', closesAt: '11월 7일', intro: '이번 주는 하울의 움직이는 성!' },
  { id: 'm10', title: '한강 5km 같이 뛰어요', interest: '러닝', date: '2026-11-07', start: '오후 8:00', end: '오후 9:00', area: '반포', place: '반포 한강공원 달빛광장', mode: '오프라인', capacity: 10, memberIds: ['ha', 'mingu', 'lee', 'park', 'kim', 'choi', 'yejin', 'seoyeon', 'yerin'], hostId: 'ha', myStatus: '신청 대기', sign: '러닝', closesAt: '11월 6일', intro: '페이스 느려도 괜찮아요. 끝까지 같이 뛰어요.', myNote: '페이스는 느린 편인데 끝까지 같이 뛰어보고 싶어요!', myNoteAgo: '어제 신청' },
]

/** 목 데이터의 "오늘" (Figma 내 모임 D-day 기준: 11/6 모임이 D-3) */
export const TODAY = '2026-11-03'
export function dday(ymd: string) {
  const d = Math.round((Date.parse(ymd) - Date.parse(TODAY)) / 86400000)
  return d === 0 ? 'D-DAY' : d > 0 ? `D-${d}` : `D+${-d}`
}

export const meetupOf = (id: string) => MEETUPS.find((m) => m.id === id)

/* ===== 채팅 ===== */
export const CHAT_ROOMS: ChatRoom[] = [
  {
    id: 'r-yerin', kind: 'dm', partnerId: 'yerin', state: 'open', unread: 0, lastAt: '오후 5:23',
    messages: [
      { id: 's1', authorId: 'system', system: true, text: '예린님이 대화 요청을 수락했어요', time: '오후 5:09' },
      { id: 'x1', authorId: 'yerin', text: '안녕하세요! 저도 캠핑 좋아해요. 다음에 같이 캠핑 모임 가실래요?', time: '오후 5:09' },
      { id: 'x2', authorId: 'me', text: '안녕하세요! 땅굴에 캠핑 가구 있는 거 보고 반가웠어요 ㅎㅎ', time: '오후 5:21' },
      { id: 'x3', authorId: 'me', text: '좋아요! 저 텐트는 있는데 침낭이 없어서… 초보도 괜찮은 모임이면 좋겠어요', time: '오후 5:23' },
      { id: 'x4', authorId: 'yerin', text: '마침 가평 1박 캠핑 모임이 초보 환영이래요. 같이 신청해볼까요?', time: '오후 5:23', meetupId: 'm4' },
    ],
  },
  {
    id: 'r-book', kind: 'group', meetupId: 'm1', state: 'open', unread: 3, lastAt: '오후 5:02',
    messages: [
      { id: 'g0', authorId: 'system', system: true, text: '닉네임님이 모임에 참여했어요', time: '' },
      { id: 'g1', authorId: 'kim', text: '다들 이번 주에 뭐 읽고 계세요?', time: '오후 4:40' },
      { id: 'g2', authorId: 'lee', text: '저는 이번 주에 SF 단편집 가져갈게요', time: '오후 4:52' },
      { id: 'g3', authorId: 'me', text: '저는 에세이요! 다 못 읽어도 괜찮다고 해서 마음이 편해요 ㅎㅎ', time: '오후 4:55' },
      { id: 'g4', authorId: 'park', text: '저도 반쯤 읽은 소설 들고 갈게요. 일요일에 봬요!', time: '오후 5:02' },
    ],
  },
  { id: 'r-seoyeon', kind: 'dm', partnerId: 'seoyeon', state: 'pending', unread: 0, lastAt: '어제', messages: [] },
]

export const CHAT_REQUESTS: ChatRequest[] = [
  { id: 'q1', kind: 'dm', direction: 'received', userId: 'seobeok', context: '땅굴에 다녀갔어요', ago: '12분 전', message: '땅굴에 이젤 있는 거 보고 반가워서요! 주말에 같이 드로잉해요' },
  { id: 'q2', kind: 'dm', direction: 'received', userId: 'ha', context: '같은 모임 참여 예정', ago: '1시간 전', message: '가평 캠핑 모임 같이 가시는 거 맞죠? 장비 얘기 나눠요' },
  { id: 'q3', kind: 'meetup', direction: 'received', userId: 'seoyeon', meetupId: 'm3', context: '참여를 신청했어요 · 3 / 6명', ago: '어제', message: '그림 배운 적은 없는데 괜찮을까요? 연필이랑 스케치북 챙겨갈게요!' },
  { id: 'q4', kind: 'dm', direction: 'sent', userId: 'yerin', context: '대화 요청 · 방금', ago: '방금', message: '' },
  { id: 'q5', kind: 'meetup', direction: 'sent', userId: 'mingu', meetupId: 'm2', context: '모임 신청 · 11월 6일 (금)', ago: '', message: '' },
]

/* ===== 알림 (알림 – 팝업 · 수정안 596:8808: 탭 없이 요청 2줄을 위에 고정) ===== */
export interface Notice {
  id: string
  kind: '채팅' | '모임' | '커뮤니티' | '공지'
  title: string
  sub: string
  ago: string
  unread?: boolean
  to: string
}
export const NOTICE_PINNED = [
  { id: 'pin-meetup', title: '모임 참여 요청', sub: '민서님 외 2명', count: 3, to: '/chat/requests?tab=meetup' },
  { id: 'pin-chat', title: '채팅 요청', sub: '지우님 외 1명', count: 2, to: '/chat/requests' },
]
export const NOTICES: Notice[] = [
  { id: 'n1', kind: '채팅', title: '새 메시지가 도착했어요', sub: '서준: 이번 주 토요일 2시 괜찮으세요?', ago: '10분 전', unread: true, to: '/chat/r-yerin' },
  { id: 'n2', kind: '모임', title: '찜한 ‘성수 보드게임 모임’이 곧 마감돼요', sub: '남은 자리 1석', ago: '1시간 전', unread: true, to: '/meetups/m2' },
  { id: 'n3', kind: '커뮤니티', title: '내 글에 댓글이 달렸어요', sub: '‘읽고 있는 책 한 줄’ · 하은님', ago: '어제', to: '/board/p4' },
  { id: 'n4', kind: '커뮤니티', title: '내 댓글에 답글이 달렸어요', sub: '‘이번 달 독서 챌린지’ · 지우님', ago: '어제', to: '/board/p4' },
  { id: 'n5', kind: '모임', title: '참여 신청이 수락됐어요', sub: '‘주말의 작은 독서 모임’ 채팅방이 열렸어요', ago: '2일 전', to: '/chat/r-book' },
]

/** 알림 페이지 (569:7860): 탭 전체·모임·채팅·게시판·공지 */
export const NOTICE_PAGE: Notice[] = [
  { id: 'a1', kind: '모임', title: '‘주말의 작은 독서 모임’에 새 참여 신청이 왔어요', sub: '민서님이 참여를 신청했어요', ago: '방금 전', unread: true, to: '/meetups/me' },
  { id: 'a2', kind: '채팅', title: '새 메시지가 도착했어요', sub: '서준: 이번 주 토요일 2시 괜찮으세요?', ago: '10분 전', unread: true, to: '/chat/r-yerin' },
  { id: 'a3', kind: '모임', title: '찜한 ‘성수 보드게임 모임’이 곧 마감돼요', sub: '남은 자리 1석', ago: '1시간 전', unread: true, to: '/meetups/m2' },
  { id: 'a4', kind: '커뮤니티', title: '내 글에 댓글이 달렸어요', sub: '‘읽고 있는 책 한 줄’ · 하은님', ago: '어제', to: '/board/p4' },
  { id: 'a5', kind: '커뮤니티', title: '내 댓글에 답글이 달렸어요', sub: '‘이번 달 독서 챌린지’ · 지우님', ago: '어제', to: '/board/p4' },
  { id: 'a6', kind: '모임', title: '참여 신청이 수락됐어요', sub: '‘주말의 작은 독서 모임’ 채팅방이 열렸어요', ago: '2일 전', to: '/chat/r-book' },
  { id: 'a7', kind: '채팅', title: '대화 요청이 왔어요', sub: '지우님이 대화를 요청했어요', ago: '3일 전', to: '/chat/requests' },
  { id: 'a8', kind: '공지', title: '디굴디굴 이용 안내가 업데이트됐어요', sub: '새 기능과 변경 사항을 확인해 보세요', ago: '5일 전', to: '/notifications' },
]

/* ===== 공용 계산 ===== */
export function overlapCount(a: string[], b: string[]) {
  return a.filter((x) => b.includes(x)).length
}
