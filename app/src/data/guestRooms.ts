/**
 * 둘러보기(비로그인)의 견본 방 (02 명세 F1 · 둘러보기 · 견본 방, N-83).
 * 팀이 만들어 둔 예시 방이고 실제 사용자의 땅굴이 아니다. 비로그인은 캠퍼스-층을 고르지 않고 이 견본 방으로 채운 들판 하나만 본다.
 * 관심사는 data/interests.ts 의 소분류 이름 (가구 배치에 씀, 2026-11-18 확정본 이름으로 옮김)
 */
export interface GuestRoom {
  id: string
  /** 방 이름 (팻말·방 카드·방노트 제목) */
  name: string
  /** 방 카드에 보이는 관심사 요약 */
  tags: string
  owner: string
  intro: string
  interests: string[]
  qna: { q: string; a: string }[]
  worn: string[]
}

export const GUEST_ROOMS: GuestRoom[] = [
  {
    id: 'sample-a', name: '내굴', tags: '독서 · 게임 · 캠핑', owner: '견본 두더지',
    intro: '안녕하세요. 저는 먹는 것을 좋아하는 개발자입니다.\n제 방에 놀러오세요~~',
    interests: ['캠핑/글램핑', '콘솔게임', '소설', '베이킹/디저트', '보드게임', '자수/뜨개/패브릭', '영화'],
    qna: [
      { q: '요즘 가장 자주 듣는 시티팝 한 곡은?', a: '마리야 타케우치 「Plastic Love」요. 출근길마다 들어요.' },
      { q: '필름카메라로 처음 찍은 건 뭐였어요?', a: '동네 고양이요. 반은 흔들렸어요.' },
      { q: '하루 동안 투명 인간이 된다면 뭐 해볼래요?', a: '유명한 맛집 주방을 몰래 구경해 볼래요.' },
    ],
    worn: ['headphones', 'glasses_sun', 'bowtie', 'prop_gamepad'],
  },
  {
    id: 'sample-b', name: '책굴', tags: '독서 · 홈카페 · 사진', owner: '견본 두더지',
    intro: '조용한 데서 책 읽고 커피 내리는 걸 좋아해요.\n좋아하는 시집이 있으면 알려 주세요.',
    interests: ['시/에세이', '글쓰기/필사/블로그', '카페/커피', '필름/컴팩트', '식물/테라리움'],
    qna: [
      { q: '요즘 읽는 책은?', a: '여름이 끝날 무렵에 읽기 좋은 시집이요.' },
      { q: '커피는 어떻게 마셔요?', a: '핸드드립으로 산미 있는 원두를 좋아해요.' },
      { q: '주말에 꼭 하는 일은?', a: '동네 서점 한 바퀴 돌기요.' },
    ],
    worn: ['hat_straw', 'glasses_round', 'camera_neck', 'prop_book'],
  },
  {
    id: 'sample-c', name: '그림굴', tags: '그림 · 요리 · 고양이', owner: '견본 두더지',
    intro: '수채화로 매일 한 장씩 그리는 중이에요.\n고양이 사진 자랑도 환영해요.',
    interests: ['드로잉/회화', '베이킹/디저트', '고양이', '캠핑/글램핑', '애니메이션'],
    qna: [
      { q: '가장 아끼는 물건은?', a: '처음 산 24색 수채 물감이요.' },
      { q: '자신 있는 요리는?', a: '버터 듬뿍 스콘이요.' },
      { q: '고양이 이름은?', a: '두부예요. 하얗고 말랑해요.' },
    ],
    worn: ['hat_beret', 'scarf_stripe', 'prop_palette'],
  },
]

/** 비로그인은 방 3개까지 구경 (02 명세 "제안") */
export const GUEST_FREE = 3

/* 구경한 방 수: 로그인 화면에 다녀와도 남게 (탭 안에서만) */
const SEEN_KEY = 'digul.guestSeen'
let seen: number | null = null
export function getGuestSeen() {
  if (seen != null) return seen
  try { seen = Number(sessionStorage.getItem(SEEN_KEY) ?? 0) || 0 } catch { seen = 0 }
  return seen
}
export function setGuestSeen(n: number) {
  seen = n
  try { sessionStorage.setItem(SEEN_KEY, String(n)) } catch { /* 저장소가 막힌 곳 */ }
}
