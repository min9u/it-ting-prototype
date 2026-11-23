/**
 * 자기소개 질문 목록 (02 F3 온보딩 3 "질문 목록에서 고르기", F4 내 정보 수정 "질문 바꾸기")
 * - 질문은 두 종류: 관심사 질문(관심사 대분류에 딸린 질문, 00 공통 5) + TMI 질문
 * - 추천 = 내가 고른 관심사의 대분류에 딸린 질문 2개 + TMI 질문 1개. 관심사 질문이 부족하면 TMI 질문으로 채움
 * 질문 문장은 Figma 예시(시티팝·필름카메라·테라리움 질문, TMI "투명 인간") 말투를 따라 만든 목 데이터
 */
import { categoriesOf, interestCatOf } from './interests'

export interface Question {
  id: string
  text: string
  kind: 'interest' | 'tmi'
  /** 관심사 질문이면 대분류 id */
  category?: string
  /** 예시 답변 (입력칸 안내 문구) */
  ex: string
}

/**
 * 대분류마다 관심사 질문 [id, 질문, 예시 답변] (2026-11-18 확정본 12개).
 * id 는 저장된 내 답변(digul.myProfile qna 의 qid)이 가리키는 값이라, 예전 질문을 새 대분류로 옮길 때 뜻이 같으면 id 를 그대로 둠
 * (music-1 · photo-1 …). 뜻이 바뀐 것은 새 id + QUESTION_ALIAS 로 예전 id 를 이어 줌. 새 질문은 목 데이터
 */
const CAT_Q: Record<string, [string, string, string][]> = {
  food: [
    ['food-1', '나만의 커피·차 레시피가 있나요?', '얼음 넣은 홍차에 꿀 한 스푼이요.'],
    ['food-2', '단골 가게의 최애 메뉴는?', '바닐라 빈이 들어간 라테요.'],
    ['food-3', '혼자만 알고 싶은 맛집이 있나요?', '회사 뒤 골목 칼국수집이요. 줄 서기 싫어서 비밀이에요.'],
  ],
  sports: [
    ['sports-1', '요즘 가장 열심히 하는 운동은?', '퇴근하고 동네 한 바퀴 뛰어요. 아직 3km가 한계예요.'],
    ['sports-2', '주말에 몸 쓰는 일 하나만 고른다면?', '배드민턴 한 게임이요. 땀 흘리고 나면 개운해요.'],
  ],
  culture: [
    ['culture-1', '몇 번이고 다시 보는 영화가 있나요?', '겨울마다 같은 애니메이션 영화를 봐요.'],
    ['culture-2', '영화 속 장면 하나에 들어갈 수 있다면?', '지브리 영화 속 기차 창가 자리요.'],
    ['culture-3', '미술관·박물관에서 오래 서 있던 곳은?', '공룡 뼈 앞에서 한 시간은 있었어요.'],
  ],
  game: [
    ['game-1', '밤새 해 본 게임이 있나요?', '친구들이랑 보드게임 하다 해 뜨는 걸 봤어요.'],
    ['game-2', '게임 속 직업을 고른다면?', '늘 대장장이를 해요. 뭔가 만드는 게 좋아서요.'],
  ],
  music_dance: [
    ['music-1', '요즘 가장 자주 듣는 노래 한 곡은?', '출근길마다 같은 시티팝 한 곡만 들어요.'],
    ['music-2', '처음으로 좋아하게 된 가수는 누구예요?', '중학생 때 이어폰 한쪽씩 나눠 듣던 밴드요.'],
  ],
  outdoor: [
    ['outdoor-1', '가장 기억에 남는 캠핑 장소는?', '비 오는 날 가평에서 텐트 안에 갇힌 날이요.'],
    ['outdoor-3', '다시 가고 싶은 여행지는?', '비 오는 날의 교토요. 골목이 다 예뻤어요.'],
  ],
  language_selfdev: [
    ['learn-1', '요즘 배우고 있는 것 하나만 소개해 주세요', '일본어요. 애니메이션을 자막 없이 보는 게 목표예요.'],
    ['learn-2', '올해 꼭 이루고 싶은 작은 목표는?', '한 달에 책 두 권 읽고 짧게 기록 남기기요.'],
  ],
  book: [
    ['book-1', '밑줄 그어 둔 문장이 있나요?', '"천천히 가도 괜찮아" 이 한 줄이요.'],
    ['book-2', '요즘 읽는 책은 뭐예요?', '자기 전에 SF 단편을 한 편씩 읽어요.'],
  ],
  photo_video: [
    ['photo-1', '필름카메라로 처음 찍은 건 뭐였어요?', '동네 고양이요. 반은 흔들렸어요.'],
    ['photo-2', '가장 아끼는 사진 한 장은 어떤 사진이에요?', '할머니 댁 마루에서 찍은 여름 오후 사진이요.'],
  ],
  art_craft: [
    ['craft-1', '지금까지 만든 것 중 가장 뿌듯한 건?', '처음 뜬 목도리요. 엄청 삐뚤어요.'],
    ['craft-2', '만들어 보고 싶은 게 있나요?', '내 손으로 빚은 머그컵이요.'],
  ],
  fandom_collect: [
    ['collect-1', '가장 아끼는 수집품은 뭐예요?', '처음 산 피규어요. 상자도 못 버렸어요.'],
    ['collect-2', '덕질하면서 가장 행복했던 순간은?', '콘서트에서 손 흔들어 준 걸 봤을 때요.'],
  ],
  pet_plant: [
    ['pet-1', '함께 사는(살고 싶은) 동물이나 식물을 소개해 주세요', '고양이 두 마리랑 살아요. 둘 다 겁이 많아요.'],
    ['nature-2', '지금 키우는 식물 이름이 있나요?', '몬스테라 이름이 몬순이에요.'],
    ['pet-2', '동물이 된다면 뭐가 되고 싶어요?', '하루 종일 자는 고양이요.'],
    ['nature-1', '테라리움에 꼭 넣고 싶은 식물은?', '이끼랑 아주 작은 고사리요.'],
  ],
}
/** 예전 질문 id → 지금 질문 id (예전 대분류 이름이 붙은 id 중 뜻이 같은 질문으로 옮긴 것). 우주·과학의 밤하늘 질문은 없어짐 */
const QUESTION_ALIAS: Record<string, string> = {
  'tea_coffee-1': 'food-1', 'tea_coffee-2': 'food-2', 'movie-1': 'culture-1', 'movie-2': 'culture-2',
  'science-2': 'culture-3', 'outdoor-2': 'sports-2',
}

const TMI_Q: [string, string][] = [
  ['하루 동안 투명 인간이 된다면 뭐 해볼래요?', '유명한 맛집 주방을 몰래 구경해 볼래요.'],
  ['남들은 모르는 나만의 잠버릇은?', '자면서 이불을 돌돌 말아요.'],
  ['가장 좋아하는 음식은 뭐예요?', '엄마가 해준 김치볶음밥이요. 매운데 자꾸 생각나요.'],
  ['주말 아침, 눈 뜨면 가장 먼저 하는 일은?', '창문부터 열고 이불 속에서 한참 뒹굴어요.'],
  ['가방 속에 늘 들어 있는 물건은?', '필름카메라랑 반쯤 남은 껌이요.'],
  ['비 오는 날 꼭 하고 싶은 일은?', '창가에서 라면 끓여 먹으면서 영화 보기요.'],
  ['요즘 나를 웃게 하는 작은 것은?', '퇴근길에 만나는 동네 강아지요.'],
  ['어릴 때 꿈은 뭐였어요?', '버스 기사요. 큰 운전대가 멋있었어요.'],
]

export const QUESTIONS: Question[] = [
  ...Object.entries(CAT_Q).flatMap(([cat, list]) => list.map(([id, text, ex]) => ({ id, text, kind: 'interest' as const, category: cat, ex }))),
  ...TMI_Q.map(([text, ex], i) => ({ id: `tmi-${i + 1}`, text, kind: 'tmi' as const, ex })),
]
/** 질문 찾기. list = 서버에서 받은 질문 목록(api/onboarding useIntroQuestions). 안 주면 목 데이터 */
export const questionOf = (id: string, list: Question[] = QUESTIONS) => list.find((q) => q.id === id) ?? list.find((q) => q.id === QUESTION_ALIAS[id])
/** 질문 앞 꼬리표: "관심사 · 음악·댄스" 또는 "TMI" */
export const questionTag = (q: Question) => (q.kind === 'tmi' ? 'TMI' : `관심사 · ${interestCatOf(q.category ?? '')?.name_ko ?? ''}`)

/** 내 관심사 대분류에 딸린 질문 (고른 순서대로) */
export function interestQuestions(picks: string[], list: Question[] = QUESTIONS): Question[] {
  return categoriesOf(picks).flatMap((c) => list.filter((q) => q.category === c))
}
export const tmiQuestions = (list: Question[] = QUESTIONS) => list.filter((q) => q.kind === 'tmi')

/** 추천 3개: 서로 다른 대분류의 관심사 질문 2개 + TMI 1개. 관심사 질문이 모자라면 TMI 로 채움 */
export function recommendedQuestions(picks: string[], list: Question[] = QUESTIONS): Question[] {
  const out: Question[] = []
  for (const c of categoriesOf(picks)) {
    if (out.length >= 2) break
    const q = list.find((x) => x.category === c)
    if (q) out.push(q)
  }
  // 대분류가 하나뿐이면 그 대분류의 두 번째 질문
  if (out.length < 2) for (const q of interestQuestions(picks, list)) { if (out.length >= 2) break; if (!out.includes(q)) out.push(q) }
  for (const q of tmiQuestions(list)) { if (out.length >= 3) break; out.push(q) }
  return out
}

// 답변 10~50자 (lib/validation.ts, ERD member_answer.answer VARCHAR(50))
import { ANSWER_MAX, ANSWER_MIN, lengthOf } from '../lib/validation'
export { ANSWER_MAX, ANSWER_MIN }
export const answerOk = (a: string) => lengthOf(a.trim()) >= ANSWER_MIN && lengthOf(a) <= ANSWER_MAX
