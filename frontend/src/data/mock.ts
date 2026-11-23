import type {
  Category, GuestbookEntry, Meetup, Tone, User,
} from './types'
import { toIso } from '../lib/time'
import { INTEREST_CATS, subOf, subsIn } from './interests'

/* ===== 관심사 대분류 12 · 소분류 90 (2026-11-18 확정본, data/interestTags.ts · data/interests.ts) ===== */
// 이름·순서·이모지·칩 색은 data/interestTags.ts 에서 읽고, 여기에는 목 인원수만 둠
/**
 * 같은 관심사를 고른 사람 수 (목 데이터. 적을수록 니치 → 드문 관심사 이펙트·온보딩 "통하는 취향"·벽지 가중치·들판 주민 관심사 뽑기).
 * 전국 규모 숫자 (30~3,400명). 서버가 생기면 실제 인원으로 바꿈. 규칙 (docs/interest-tags-2026-11-18.md "목 인원수"):
 * - 예전 관심사 v2 의 같은 취미가 이어지는 소분류는 그 값 그대로 (주석에 예전 이름)
 * - 나머지(새로 생긴 것·뜻이 넓어진 것)는 **목(임시)**: 흔한 취미는 2,000~3,400명, 니치한 취미는 70~250명 정도로 어림잡은 값
 */
const TAG_COUNTS: Record<string, number> = {
  // 음식·음료
  restaurant_tour: 3300 /* 목(임시) */, cafe_coffee: 3000 /* 목(임시) */, liquor: 1500 /* 목(임시) */, healthy_food: 1200 /* 목(임시) */,
  cooking: 2000 /* 목(임시) */, baking_dessert: 1700 /* 베이킹 */, tea: 190 /* 다도 (홍차 680 도 여기로 합쳐졌지만 다도 값을 이음: 드문 관심사 데모) */,
  // 스포츠
  fitness_yoga: 3100 /* 목(임시) */, running: 2500 /* 목(임시) */, climbing: 880 /* 클라이밍 */, soccer: 2200 /* 목(임시) */, baseball: 2800 /* 목(임시) */,
  ball_sports: 1300 /* 목(임시) */, racket_sports: 1600 /* 목(임시) */, billiards_bowling: 1000 /* 목(임시) */, ski_board: 1100 /* 목(임시) */,
  martial_arts: 340 /* 목(임시) */, water_sports: 160 /* 목(임시) */,
  // 문화생활
  movie: 3400 /* 목(임시) */, drama_variety: 3100 /* 목(임시) */, animation: 2400 /* 애니메이션 */, concert_festival: 2400 /* 목(임시) */,
  exhibition: 1900 /* 목(임시) */, theater_musical: 1300 /* 목(임시) */, fortune_tarot: 240 /* 목(임시) */,
  // 게임
  pc_game: 3200 /* 목(임시) */, mobile_game: 2900 /* 목(임시) */, board_game: 1900 /* 보드게임 */, escape_room: 1500 /* 목(임시) */,
  console_game: 640 /* 레트로게임 */, vr_arcade: 450 /* 아케이드 */, puzzle_cube: 190 /* 스피드큐브 */, go_chess: 260 /* 체스 */,
  // 음악·댄스
  kpop: 3000 /* 목(임시) */, pop_song: 2300 /* 목(임시) */, jpop_ost: 1600 /* 목(임시) */, hiphop_rock: 2800 /* 목(임시) */, jazz_classical: 2100 /* 재즈 */,
  dance: 700 /* 목(임시) */, vocal: 1200 /* 목(임시) */, guitar_bass: 2700 /* 기타연주 */, piano_keys: 1320 /* 피아노 */, drums_orchestra: 980 /* 드럼 */,
  compose_dj: 640 /* 신스·작곡 */,
  // 아웃도어
  domestic_travel: 3350 /* 목(임시) */, overseas_travel: 3000 /* 목(임시) */, hiking: 1700 /* 목(임시) */, camping: 2600 /* 캠핑 */,
  cycling_drive: 2400 /* 자전거 */, fishing: 450 /* 목(임시) */,
  // 외국어·자기계발
  english: 3300 /* 목(임시) */, japanese: 1900 /* 목(임시) */, chinese: 520 /* 목(임시) */, spanish: 230 /* 목(임시) */, other_language: 70 /* 목(임시) */,
  finance: 2900 /* 목(임시) */, volunteer: 600 /* 목(임시) */,
  // 책·글
  novel: 2600 /* 목(임시) */, poem_essay: 540 /* 시집 */, webtoon_comics: 1800 /* 만화책 */, web_novel: 1400 /* 목(임시) */,
  current_affairs: 1100 /* 목(임시) */, humanities: 700 /* 목(임시) */, writing: 1500 /* 목(임시) */,
  // 사진·영상
  smartphone_photo: 2700 /* 목(임시) */, video_editing: 1500 /* 목(임시) */, photo_retouch: 800 /* 목(임시) */, mirrorless_dslr: 1700 /* 목(임시) */,
  film_compact: 720 /* 필름카메라 */, actioncam_drone: 95 /* 목(임시) */,
  // 미술·수공예
  drawing_painting: 1600 /* 수채화 */, needlework: 420 /* 뜨개질 */, candle_diffuser: 210 /* 목(임시) */, leather_pottery_wood: 350 /* 도자기 */,
  calligraphy: 150 /* 목(임시) */, flower_art: 130 /* 목(임시) */, accessory_etc: 85 /* 목(임시) */,
  // 덕질·수집
  goods_photocard: 1600 /* 목(임시) */, keyring_doll: 900 /* 목(임시) */, deco_stationery: 1300 /* 목(임시) */, figure: 1300 /* 피규어 */,
  plamodel_lego: 820 /* 건프라 */, lp_album: 860 /* LP수집 */,
  // 반려동물·식물
  dog: 3100 /* 강아지 */, cat: 3300 /* 고양이 */, small_animal: 90 /* 목(임시) */, fish: 380 /* 열대어 */, bird: 160 /* 앵무새 */,
  insect_reptile: 120 /* 도마뱀 */, plant_terrarium: 2300 /* 식물키우기 */,
}

export const CATEGORIES: Category[] = INTEREST_CATS.map((c) => ({
  id: c.id, name: c.name_ko, emoji: c.emoji, tone: c.tone,
  tags: subsIn(c.id).map((t) => ({ id: t.id, name: t.name_ko, count: TAG_COUNTS[t.id] ?? 500 })),
}))

/**
 * 관심사 목록에 없는 주제 말 → 대분류 (게시판·모임·랜딩 문구에 쓰는 짧은 말. 소분류 이름이면 바로 찾음)
 */
const TOPIC_CATEGORY: Record<string, string> = {
  독서: 'book', 에세이: 'book', 'SF 소설': 'book', 그림: 'art_craft', 요리: 'food', 홈카페: 'food',
  러닝: 'sports', 운동: 'sports', 여행: 'outdoor', 등산: 'outdoor', 캠핑: 'outdoor', 지브리: 'culture', 공연: 'culture',
  사진: 'photo_video', 게임: 'game', 음악: 'music_dance',
}

/** 관심사(소분류 이름·주제 말·대분류 이름) → 대분류 */
export function categoryOf(interest: string): Category | undefined {
  const id = subOf(interest)?.category ?? TOPIC_CATEGORY[interest]
  return CATEGORIES.find((c) => c.id === id || c.name === interest)
}

/** Figma 스크린샷에서 확인한 칩 색 (예전 이름 기준이던 것을 새 이름에 이어 둠). 나머지는 대분류 색을 따른다 */
const TONE_OVERRIDE: Record<string, Tone> = {
  '캠핑/글램핑': 'sage', '피아노/건반': 'rose', 게임: 'sky', 독서: 'butter', 음악: 'lilac',
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
    // 2026-11-18 확정본으로 옮김 (예전: 캠핑 · 레트로게임 · SF소설 · 시티팝 · 피아노 · 수채화 · 필름카메라 · 고전영화 · 핸드드립 · 자전거). 가구 세트·소품은 그대로
    interests: ['캠핑/글램핑', '콘솔게임', '소설', 'JPOP/OST', '피아노/건반', '드로잉/회화', '필름/컴팩트', '영화', '카페/커피', '자전거/바이크/드라이브'],
    visitorsNow: 2,
  },
  seobeok: { id: 'seobeok', nickname: '서벅이', affiliation: 'SSAFY 16기 · 서울 · 3반', intro: '', interests: ['드로잉/회화', '보드게임'], worn: ['hat_beret', 'glasses_round', 'scarf_stripe', 'prop_palette'] },
  yerin: {
    id: 'yerin', nickname: '예린', affiliation: 'SSAFY 서울 2반', online: true,
    intro: '안녕하세요. 저는 먹는 것을 좋아하는 개발자입니다. 제 방에 놀러오세요~~',
    // 다도(190명)는 드문 관심사 이펙트를 보여 주려고 2026-11-17 추가 (docs/interest-effects.md) → 2026-11-18 확정본에서 "차/다도"(190명 이음)
    // 나와 겹치는 것 3개(캠핑/글램핑 · 드로잉/회화 · 콘솔게임)도 그대로
    interests: ['캠핑/글램핑', '베이킹/디저트', '드로잉/회화', '콘솔게임', '고양이', '차/다도'],
    worn: ['hat_chef', 'glasses_round', 'scarf_knit', 'prop_cup'],
    qna: [
      { q: 'Q1. 쉬는 날에는 주로 무엇을 하나요?', a: '낮잠 자고 오후 늦게 일어납니다... 그리고 뒹굴 뒹굴' },
      { q: 'Q2. 어떤 사람과 친해지고 싶나요?', a: '개인적으로 mbti가 INTP이신 분들이 좋습니다.' },
      { q: 'Q3. 내 방에 놀러 온 사람들에게 한마디!', a: '방 구경하시고 편하게 연락주세요!!!' },
    ],
  },
  seoyeon: { id: 'seoyeon', nickname: '서연', affiliation: 'SSAFY 16기 · 서울 · 5반', intro: '', interests: ['시/에세이', '글쓰기/필사/블로그', '필름/컴팩트'], online: true, worn: ['hat_straw', 'glasses_sun', 'camera_neck', 'prop_book'] },
  mingu: { id: 'mingu', nickname: '민구', affiliation: 'SSAFY 16기 · 서울 · 1반', intro: '', interests: ['소설', '콘솔게임'], worn: ['headphones', 'glasses_sun', 'bowtie', 'prop_gamepad'] },
  yejin: { id: 'yejin', nickname: '예진', affiliation: 'SSAFY 16기 · 서울 · 4반', intro: '', interests: ['시/에세이', '카페/커피'] },
  kim: { id: 'kim', nickname: '김OO', affiliation: 'SSAFY 13기 · 서울', intro: '', interests: ['소설', '시/에세이', '캠핑/글램핑'] },
  lee: { id: 'lee', nickname: '이OO', affiliation: 'SSAFY 16기 · 서울', intro: '', interests: ['소설'] },
  park: { id: 'park', nickname: '박OO', affiliation: 'SSAFY 16기 · 대전', intro: '', interests: ['소설', '드로잉/회화'] },
  choi: { id: 'choi', nickname: '최OO', affiliation: 'SSAFY 16기 · 구미', intro: '', interests: ['글쓰기/필사/블로그'] },
  ha: { id: 'ha', nickname: '하늘', affiliation: 'SSAFY 서울 6반', intro: '', interests: ['캠핑/글램핑', '미러리스/DSLR'] },
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
  // 오래된 글도 자동으로 지워지지 않는다 (2026-11-21 명세: 7일 자동 삭제 없음). 목록 맨 끝에 그대로 보여야 한다
  { id: 'gb-old', authorId: 'kim', text: '한 달 전에 남긴 글이에요. 오래돼도 그대로 남아 있어요', createdAt: minutesAgo(30 * 24 * 60) },
  // 신고 2명 → 아직 보임. 한 명이 더 신고하면 가려짐 (서로 다른 3명)
  { id: 'gb-rep2', authorId: 'lee', text: '홍보 글 같은 방명록이에요 (신고 2명)', createdAt: minutesAgo(2000), reporters: ['yerin', 'park'] },
  // 서로 다른 3명이 신고 → 가려져 목록과 글 수에서 빠짐. 같은 사람이 여러 번 신고해도 1명 (reporters 는 사람 기준)
  { id: 'gb-hidden', authorId: 'kim', text: '(신고로 가려진 방명록 — 보이면 안 됨)', createdAt: minutesAgo(40), reporters: ['yerin', 'park', 'seoyeon', 'yerin'] },
]

/* ===== 게시판: data/boardStore.ts ===== */

/* ===== 모임 ===== */
export const MEETUPS: Meetup[] = [
  {
    id: 'm1', title: '주말의 작은 독서 모임', category: '취미/문화', date: '2026-11-08', start: '오후 2:00', end: '오후 4:00',
    area: '성수동', place: '성수동 어반플레이스 3층', mode: '오프라인', capacity: 6,
    memberIds: ['kim', 'lee', 'park', 'choi'], hostId: 'kim', myStatus: '참여 확정', sign: '독서 모임',
    intro: '한 주에 한 권씩, 각자 읽은 책을 들고 모입니다. 발제나 독후감 같은 건 없어요. 읽다가 접어둔 페이지를 펴놓고 두 시간쯤 이야기합니다. 처음 오시는 분은 다 못 읽고 오셔도 괜찮아요.',
  },
  {
    id: 'm2', title: '퇴근 후 보드게임 한 판', category: '게임', date: '2026-11-06', start: '오후 7:00', end: '오후 10:00',
    area: '역삼', place: '역삼역 보드게임 카페', mode: '오프라인', capacity: 6,
    memberIds: ['mingu', 'ha', 'lee'], hostId: 'mingu', myStatus: '신청 대기', sign: '보드게임', myNote: '보드게임은 처음인데 괜찮을까요? 규칙 미리 공부해 갈게요!',
    intro: '룰 설명부터 천천히 해드려요. 가벼운 파티 게임 위주로 합니다.',
  },
  {
    id: 'm3', title: '일요일 아침 드로잉', category: '취미/문화', date: '2026-11-22', start: '오전 10:00', end: '오후 12:00',
    area: '망원', place: '망원 한강공원', mode: '오프라인', capacity: 6,
    memberIds: ['me', 'park', 'seobeok'], hostId: 'me', myStatus: '내가 주최', sign: '드로잉',
    intro: '연필 한 자루랑 스케치북만 챙겨오세요. 잘 그리는 것보다 같이 그리는 게 목적이에요.',
  },
  {
    id: 'm4', title: '초보 환영, 가평 1박 캠핑', category: '취미/문화', date: '2026-11-15', start: '오전 10:00', end: '다음 날 오전 11:00',
    area: '가평', place: '가평 자라섬 캠핑장', mode: '오프라인', capacity: 8,
    memberIds: ['yerin', 'ha', 'kim', 'seoyeon', 'mingu'], hostId: 'yerin', myStatus: '참여 확정', sign: '가평 캠핑',
    intro: '장비 없어도 괜찮아요. 공용 텐트 두 동 준비했어요.',
  },
  { id: 'm5', title: '시티팝 LP 듣는 밤', category: '취미/문화', date: '2026-11-19', start: '오후 8:00', end: '오후 10:00', area: '온라인', place: '', mode: '온라인', capacity: 10, memberIds: ['seoyeon', 'yejin'], hostId: 'seoyeon', myStatus: '찜', sign: 'LP 듣는 밤', intro: '각자 좋아하는 한 곡씩 틀어요.' },
  { id: 'm6', title: '테라리움 같이 만들어요', category: '기타', date: '2026-11-23', start: '오후 3:00', end: '오후 5:00', area: '연남동', place: '연남동 공방', mode: '오프라인', capacity: 5, memberIds: ['choi'], hostId: 'choi', sign: '테라리움', intro: '재료비 1만 원. 작은 유리병 하나씩 가져가요.' },
  { id: 'm7', title: '역삼 점심 러닝 크루', category: '운동', date: '2026-11-12', start: '오후 12:10', end: '오후 12:50', area: '역삼', place: '선릉공원 입구', mode: '오프라인', capacity: 12, memberIds: ['ha', 'mingu', 'lee', 'park'], hostId: 'ha', myStatus: '찜', sign: '점심 러닝', intro: '3km 천천히 뛰어요.' },
  { id: 'm8', title: '홈카페 원두 나눔회', category: '식사/카페', date: '2026-11-29', start: '오후 2:00', end: '오후 4:00', area: '성수동', place: '성수 카페거리', mode: '오프라인', capacity: 6, memberIds: ['yejin', 'seoyeon'], hostId: 'yejin', myStatus: '찜', sign: '원두 나눔', intro: '집에 남는 원두 가져와서 바꿔 마셔요.' },
  { id: 'm9', title: '지브리 영화 같이 보기', category: '취미/문화', date: '2026-11-07', start: '오후 9:00', end: '오후 11:00', area: '온라인', place: '', mode: '온라인', capacity: 8, memberIds: ['yerin', 'seobeok', 'park'], hostId: 'seobeok', sign: '지브리', intro: '이번 주는 하울의 움직이는 성!' },
  { id: 'm10', title: '한강 5km 같이 뛰어요', category: '운동', date: '2026-11-07', start: '오후 8:00', end: '오후 9:00', area: '반포', place: '반포 한강공원 달빛광장', mode: '오프라인', capacity: 10, memberIds: ['ha', 'mingu', 'lee', 'park', 'kim', 'choi', 'yejin', 'seoyeon', 'yerin'], hostId: 'ha', myStatus: '신청 대기', sign: '러닝', intro: '페이스 느려도 괜찮아요. 끝까지 같이 뛰어요.', myNote: '페이스는 느린 편인데 끝까지 같이 뛰어보고 싶어요!' },
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
