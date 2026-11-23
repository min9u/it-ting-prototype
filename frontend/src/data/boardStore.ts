/**
 * 커뮤니티(08) 목 서버의 "DB": 글·댓글·좋아요·저장·신고·올린 사진 (api/community/mock.ts 만 읽고 씀).
 * 화면은 이 파일을 직접 부르지 않고 api/community 의 훅 · 함수를 쓴다 (2026-11-22 API v1 맞추기).
 * - 바뀌면 useSyncExternalStore 구독자(api/community queries 의 목 동기화)가 캐시를 새로 받게 함
 * - 새로고침하면 처음 목 데이터로 돌아감 (아티팩트는 sessionStorage 가 막힐 수 있어 저장하지 않음)
 * 명세: docs/backend/team-spec/spec/08-community.md, api/08-community.md
 */
import { useSyncExternalStore } from 'react'
import { CATEGORIES, ME_ID, USERS, categoryOf } from './mock'
import { getMyInterests } from './interests'
import type { PostCategory, Tone } from './types'

/* ===== 모양 ===== */
/** 공개 / 가려짐(신고 3명) / 삭제 — 명세 F8 신고 팝업 4 */
export type Visibility = 'public' | 'hidden' | 'deleted'

export interface BoardComment {
  id: string
  authorId: string
  text: string
  /** 답글에 다시 답할 때 붙는 "@닉네임" (닉네임 자체) */
  mention?: string
  at: number
  editedAt?: number
  likes: number
  liked?: boolean
  status: Visibility
  /** 신고한 사람 수 (3명이면 가려짐) */
  reports: number
  /** 내가 신고함 → 나에게만 접힌 채로 보임 */
  reportedByMe?: boolean
  /** 답글 (한 단계만) */
  replies: BoardComment[]
}

export interface BoardPhoto {
  /** 사진 id (uploaded_image.id 자리). 목 글의 색 칸 사진은 '<글id>-img<n>' */
  id?: string
  tone: Tone
  /** "사진 추가"로 올린 그림 (object URL). 없으면 색 칸으로 그림 */
  url?: string
}

export interface BoardPost {
  id: string
  category: PostCategory
  /** 관심사 대분류 이름 (최대 5개, F0 공통 5: 커뮤니티 글은 대분류) */
  interests: string[]
  title: string
  body: string
  authorId: string
  at: number
  editedAt?: number
  views: number
  likes: number
  liked?: boolean
  /** 다른 사람들이 저장한 수 (인기 점수에는 안 들어감) */
  saves: number
  /** 내가 저장한 때. 없으면 저장 안 함 */
  savedAt?: number
  photos: BoardPhoto[]
  meetupId?: string
  status: Visibility
  reports: number
  reportedByMe?: boolean
  comments: BoardComment[]
  /** 댓글 본문 없이 수만 있을 때 (지금은 시험에서만) */
  commentTotal?: number
}

/* ===== 상수 (명세 숫자). 화면이 쓰는 상수는 screens/board/parts.tsx ===== */
/** 서로 다른 3명이 신고하면 가려짐 */
export const HIDE_AT = 3
const DAY = 86_400_000

/** 관심사 대분류 12개 이름 (2026-11-18 확정본 순서, data/interestTags.ts) */
export const BIG_INTERESTS = CATEGORIES.map((c) => c.name)
export const bigOf = (name: string) => CATEGORIES.find((c) => c.name === name)

/* ===== 사람 표시 (F0 공통 4) ===== */
export const GONE_ID = 'gone'
export const isGone = (id: string) => id === GONE_ID || !USERS[id]
export function nickOf(id: string) {
  return isGone(id) ? '탈퇴한 사용자' : USERS[id].nickname
}

/* ===== 목 데이터 ===== */
const NOW = Date.now()
const m = (min: number) => NOW - min * 60_000
let seq = 0
const cid = () => `c${++seq}`

function c(authorId: string, text: string, minAgo: number, likes = 0, extra: Partial<BoardComment> = {}): BoardComment {
  return { id: cid(), authorId, text, at: m(minAgo), likes, status: 'public', reports: 0, replies: [], ...extra }
}

const CHATTER = [
  '저도 궁금했던 거예요! 정리해 주셔서 고마워요', '다음에 저도 같이 가고 싶어요', '오 이거 땅굴에 가구로 두고 싶네요 ㅎㅎ',
  '좋은 글 저장해 두고 갑니다', '이런 이야기 너무 좋아요', '혹시 초보도 괜찮을까요?', '사진 보니까 분위기 좋네요',
  '저는 반대로 생각했는데 듣고 보니 그렇네요', '다음 모임 열리면 알려 주세요!', '덕분에 주말 계획 생겼어요',
]
const PEOPLE = ['yerin', 'ha', 'mingu', 'seoyeon', 'yejin', 'park', 'kim', 'lee', 'choi', 'seobeok']
/** 글마다 댓글 수를 맞추려고 만드는 잡담 댓글 */
function chatter(n: number, postMin: number, salt: number): BoardComment[] {
  return Array.from({ length: n }, (_, i) => {
    const at = Math.max(1, Math.round(postMin - ((i + 1) * postMin) / (n + 1)))
    return c(PEOPLE[(i * 3 + salt) % PEOPLE.length], CHATTER[(i + salt) % CHATTER.length], at, (i * 7 + salt) % 5)
  })
}

interface Seed {
  id: string; cat: PostCategory; tags: string[]; title: string; body: string; author: string; min: number
  views: number; likes: number; saves: number; photos?: Tone[]; meetup?: string; comments?: BoardComment[]
  savedMin?: number; status?: Visibility; reports?: number; edited?: number
}

const SEEDS: Seed[] = [
  {
    id: 'p1', cat: '모임 후기', tags: ['아웃도어'], author: 'yerin', min: 70, views: 284, likes: 52, saves: 18, photos: ['sage'], meetup: 'm4', savedMin: 60 * 24 * 7,
    title: '첫 캠핑 모임 다녀왔어요! 두더지 다섯 마리의 1박 2일',
    body: '지난 주말 가평으로 첫 캠핑 모임을 다녀왔어요. 다섯 명 중 세 명이 캠핑이 처음이라 텐트 치는 데만 한 시간이 걸렸지만, 다 같이 헤매는 게 오히려 재밌었어요.\n\n밤에는 불 앞에 둘러앉아서 각자 땅굴에 둔 가구 이야기를 했어요. 다음 달에도 열어볼 생각이라, 관심 있는 분들은 아래 모임에서 신청해주세요!',
    comments: [
      c('ha', '텐트 치다가 다 같이 웃었던 거 아직도 생각나요 ㅋㅋ 다음 달에도 꼭 갈게요!', 65, 12, {
        replies: [c('yerin', '네! 다음엔 타프도 챙겨갈게요', 62, 4), c('mingu', '타프 있으면 비 와도 괜찮겠네요', 61, 1, { mention: '예린' })],
      }),
      c('mingu', '초보도 괜찮나요? 장비가 하나도 없는데 빌릴 수 있는 곳이 있으면 알려주세요.', 64, 3),
      c('seoyeon', '후기 읽고 저도 캠핑 가구 하나 땅굴에 들여놨어요. 모임 열리면 신청할게요!', 63, 1),
      c(ME_ID, '사진만 봐도 즐거웠던 게 느껴져요. 다음엔 저도 신청할게요!', 62, 2),
      c(GONE_ID, '불멍 최고죠. 저도 다녀오고 싶네요', 61, 0),
      c('kim', '장비 대여는 제가 정리한 글 참고하세요! 초보 캠핑 장비 빌릴 수 있는 곳', 60, 6, { replies: [c('mingu', '감사합니다! 바로 볼게요', 59, 0)] }),
      c('lee', '이 댓글은 신고로 가려졌어요', 58, 0, { status: 'hidden', reports: 3 }),
      ...chatter(7, 57, 2),
    ],
  },
  {
    id: 'p2', cat: '자유', tags: ['책·글'], author: 'seoyeon', min: 12, views: 171, likes: 14, saves: 6, savedMin: 10,
    title: '성수동 근처에 조용히 책 읽기 좋은 카페 있을까요?',
    body: '독서 모임 끝나고 바로 혼자 더 읽다 가고 싶은데, 너무 시끄럽지 않은 곳 추천 부탁드려요.',
    comments: [
      c('yejin', '어반플레이스 1층 안쪽 자리가 조용해요', 11, 2),
      c(ME_ID, '저도 거기 가 봤는데 2층 창가 자리가 제일 좋아요', 9, 1),
      c('kim', '평일 저녁이면 어디든 괜찮더라고요', 8, 0, { replies: [c(ME_ID, '저는 거기 가봤는데 2층 창가 자리가 조용해요', 6, 0, { mention: '김OO' })] }),
      c(ME_ID, '카페 이름 알려 주시면 저도 가 볼게요', 5, 0),
      ...chatter(3, 4, 5),
    ],
  },
  {
    id: 'p3', cat: '자유', tags: ['미술·수공예'], author: 'seobeok', min: 180, views: 342, likes: 30, saves: 5, savedMin: 60 * 24 * 10,
    title: '다들 땅굴에 어떤 가구 제일 먼저 두셨어요?',
    body: '저는 이젤부터 놨는데, 다른 분들 땅굴 구경하다 보니 오락기 들인 분이 많더라고요 ㅋㅋ',
    comments: [...chatter(9, 170, 1), c(ME_ID, '저는 책장부터 들였어요 ㅎㅎ', 20, 3), ...chatter(5, 15, 4)],
  },
  {
    id: 'p4', cat: '자유', tags: ['책·글'], author: 'yerin', min: 60 * 26, views: 198, likes: 21, saves: 4,
    title: '이번 달에 읽은 책 한 줄씩 남겨요',
    body: '저부터! SF 단편집 읽었는데 마지막 편이 제일 좋았어요. 다들 이번 달에 읽은 책 한 줄씩 남겨 주세요.',
    comments: chatter(6, 60 * 25, 3),
  },
  {
    id: 'p5', cat: '자유', tags: ['게임'], author: 'mingu', min: 60 * 30, views: 128, likes: 41, saves: 9, photos: ['lilac'], savedMin: 60 * 24 * 11,
    title: '보드게임 처음 시작할 때 추천하는 다섯 가지',
    body: '룰이 간단하고 4명 이하로 하기 좋은 게임 위주로 골라봤어요. 모임에서 해본 후기도 같이 적었어요.',
    comments: [...chatter(3, 60 * 29, 6), c(ME_ID, '스플렌더 추천 감사해요. 바로 샀어요', 60 * 20, 2)],
  },
  {
    id: 'p6', cat: '모임 홍보', tags: ['미술·수공예'], author: ME_ID, min: 60 * 50, views: 88, likes: 11, saves: 3, meetup: 'm3',
    title: '일요일 아침 망원에서 같이 그려요',
    body: '연필 한 자루랑 스케치북만 챙겨오세요. 잘 그리는 것보다 같이 그리는 게 목적이에요. 그림을 처음 그려 보는 분도 환영해요.',
    comments: chatter(4, 60 * 49, 7),
  },
  {
    id: 'p7', cat: '모임 홍보', tags: ['스포츠'], author: 'ha', min: 60 * 54, views: 120, likes: 9, saves: 2, meetup: 'm7',
    title: '역삼 점심 러닝 크루 모집해요',
    body: '점심시간에 3km만 천천히 뛰어요. 샤워실 있는 곳 알려드릴게요.',
    comments: chatter(2, 60 * 53, 8),
  },
  {
    id: 'p8', cat: '모임 후기', tags: ['문화생활'], author: 'seobeok', min: 60 * 60, views: 150, likes: 26, saves: 4, photos: ['rose'],
    meetup: 'm9', title: '지브리 같이 보기 후기: 하울은 언제 봐도 좋네요', body: '온라인으로 모였는데 채팅으로 명장면마다 소리 지르는 게 재밌었어요. 다음 편은 센과 치히로!',
    comments: chatter(5, 60 * 59, 9),
  },
  {
    id: 'p9', cat: '자유', tags: ['음식·음료'], author: 'yejin', min: 60 * 70, views: 301, likes: 44, saves: 12, photos: ['butter'],
    title: '자취방 오븐 없이 만드는 스콘', body: '에어프라이어로도 충분해요. 버터는 차갑게, 반죽은 덜 치대는 게 핵심이에요. 레시피 공유합니다.',
    comments: chatter(11, 60 * 69, 2),
  },
  {
    id: 'p10', cat: '자유', tags: ['사진·영상'], author: 'ha', min: 60 * 75, views: 156, likes: 9, saves: 1,
    title: '필름카메라 입문용 추천 부탁드려요', body: '땅굴에 카메라 가구만 두고 실제로는 없어요… 첫 필름카메라 뭐가 좋을까요?',
    comments: chatter(4, 60 * 74, 3),
  },
  {
    id: 'p11', cat: '모임 홍보', tags: ['게임'], author: 'mingu', min: 60 * 80, views: 97, likes: 13, saves: 2, meetup: 'm2',
    title: '퇴근 후 보드게임 한 판 하실 분', body: '역삼역 보드게임 카페에서 가벼운 파티 게임 위주로 해요. 룰 설명부터 천천히 해드려요.',
    comments: chatter(3, 60 * 79, 4),
  },
  {
    id: 'p12', cat: '자유', tags: ['반려동물·식물'], author: 'choi', min: 60 * 90, views: 64, likes: 7, saves: 1,
    title: '사무실 창가에서 키우기 쉬운 식물 있을까요?', body: '햇빛이 오전에만 잠깐 드는 자리예요. 물 주는 걸 자주 잊어버려요 ㅠㅠ',
    comments: chatter(2, 60 * 89, 5),
  },
  {
    id: 'p13', cat: '자유', tags: ['반려동물·식물'], author: 'lee', min: 60 * 100, views: 210, likes: 38, saves: 3, photos: ['clay'],
    title: '고양이가 키보드 위에서만 자요', body: '코딩하려고 앉으면 꼭 키보드 위로 올라와요. 다들 어떻게 하세요?',
    comments: chatter(8, 60 * 99, 6),
  },
  {
    id: 'p14', cat: '모임 후기', tags: ['책·글'], author: 'kim', min: 60 * 110, views: 77, likes: 12, saves: 2, meetup: 'm1',
    title: '주말의 작은 독서 모임 2회차 후기', body: '이번에는 각자 접어둔 페이지를 하나씩 읽어 줬어요. 처음 오신 분도 금방 섞였어요.',
    comments: chatter(3, 60 * 109, 7),
  },
  {
    id: 'p15', cat: '자유', tags: ['아웃도어'], author: 'park', min: 60 * 120, views: 59, likes: 8, saves: 1,
    title: '이번 주말 유성우 보러 갈 만한 곳', body: '서울 근교에서 빛 공해 적은 곳 아시는 분 계실까요? 차 없이 갈 수 있으면 더 좋아요.',
    comments: chatter(2, 60 * 119, 8),
  },
  {
    id: 'p16', cat: '자유', tags: ['문화생활'], author: ME_ID, min: 60 * 125, views: 92, likes: 10, saves: 2, edited: 60 * 100,
    title: '비 오는 날 보기 좋은 고전 영화', body: '요즘 비가 자주 와서 옛날 영화를 다시 보고 있어요. 다들 비 오는 날 꺼내 보는 영화가 있나요?',
    comments: chatter(5, 60 * 124, 9),
  },
  {
    id: 'p17', cat: '모임 홍보', tags: ['음식·음료'], author: 'yejin', min: 60 * 130, views: 45, likes: 6, saves: 1, meetup: 'm8',
    title: '홈카페 원두 나눔회 열어요', body: '집에 남는 원두 가져와서 바꿔 마셔요. 드리퍼는 제가 챙길게요.',
    comments: chatter(1, 60 * 129, 1),
  },
  {
    id: 'p18', cat: '자유', tags: ['게임'], author: 'mingu', min: 60 * 140, views: 133, likes: 17, saves: 6,
    title: '기계식 키보드 축 고르는 법 정리', body: '적축, 갈축, 청축 차이를 사무실에서 써도 되는지 기준으로 정리했어요.',
    comments: chatter(4, 60 * 139, 2),
  },
  {
    id: 'p19', cat: '자유', tags: ['음악·댄스'], author: 'seoyeon', min: 60 * 150, views: 80, likes: 15, saves: 4,
    title: '퇴근길에 듣는 시티팝 플레이리스트', body: '지하철에서 듣기 좋은 곡 열 곡 골라봤어요. 다들 추천 곡 있으면 댓글로!',
    comments: chatter(6, 60 * 149, 3),
  },
  {
    id: 'p20', cat: '모임 후기', tags: ['스포츠'], author: 'ha', min: 60 * 160, views: 70, likes: 11, saves: 1, meetup: 'm10',
    title: '한강 5km 같이 뛰고 왔어요', body: '페이스가 다 달랐는데 끝까지 같이 뛰었어요. 끝나고 먹은 라면이 제일 맛있었어요.',
    comments: chatter(2, 60 * 159, 4),
  },
  {
    id: 'p21', cat: '자유', tags: ['미술·수공예'], author: 'yerin', min: 60 * 170, views: 66, likes: 9, saves: 1,
    title: '뜨개질 처음 시작했는데 코 잡는 게 제일 어렵네요', body: '유튜브 보면서 세 번째 다시 하는 중이에요. 팁 있으면 알려주세요!',
    comments: chatter(3, 60 * 169, 5),
  },
  {
    id: 'p22', cat: '자유', tags: ['아웃도어'], author: 'kim', min: 60 * 190, views: 520, likes: 61, saves: 22,
    title: '초보 캠핑 장비 빌릴 수 있는 곳', body: '장비 대여 업체 세 곳을 가격, 배송, 반납 방법으로 비교해봤어요.',
    comments: chatter(7, 60 * 189, 6),
  },
  {
    id: 'p23', cat: '모임 홍보', tags: ['반려동물·식물'], author: 'choi', min: 60 * 200, views: 40, likes: 5, saves: 1, meetup: 'm6',
    title: '테라리움 같이 만들어요', body: '재료비 1만 원이에요. 작은 유리병 하나씩 만들어 가요.',
    comments: chatter(1, 60 * 199, 7),
  },
  {
    id: 'p24', cat: '자유', tags: ['책·글'], author: ME_ID, min: 60 * 220, views: 33, likes: 2, saves: 0, status: 'hidden', reports: 3,
    title: 'SF 단편 추천해 주세요', body: '짧게 읽을 수 있는 SF 단편집 찾고 있어요. 링크 남겨 둘게요.',
    comments: chatter(1, 60 * 219, 8),
  },
  {
    id: 'p25', cat: '자유', tags: ['사진·영상'], author: 'seoyeon', min: 60 * 24 * 10, views: 140, likes: 19, saves: 3, photos: ['mint', 'sky'],
    title: '출사 다녀온 사진 몇 장', body: '서울숲에서 필름 한 롤 다 찍고 왔어요. 현상하니까 생각보다 잘 나왔어요.',
    comments: chatter(4, 60 * 24 * 10 - 30, 9),
  },
  {
    id: 'p26', cat: '자유', tags: ['반려동물·식물'], author: 'lee', min: 60 * 24 * 12, views: 110, likes: 23, saves: 2,
    title: '앵무새가 제 알람 소리를 따라 해요', body: '이제 알람이 울린 건지 앵무새가 운 건지 모르겠어요 ㅋㅋ',
    comments: chatter(3, 60 * 24 * 12 - 30, 1),
  },
  { id: 'p27', cat: '자유', tags: ['게임'], author: 'lee', min: 60 * 24 * 2, views: 12, likes: 0, saves: 0, status: 'hidden', reports: 3, title: '(신고로 가려진 글)', body: '홍보 글' },
  { id: 'p28', cat: '자유', tags: ['음악·댄스'], author: 'kim', min: 60 * 24 * 3, views: 5, likes: 0, saves: 0, status: 'deleted', title: '(삭제된 글)', body: '' },
]

function fromSeed(s: Seed): BoardPost {
  return {
    id: s.id, category: s.cat, interests: s.tags, title: s.title, body: s.body, authorId: s.author, at: m(s.min),
    editedAt: s.edited ? m(s.edited) : undefined, views: s.views, likes: s.likes, saves: s.saves,
    savedAt: s.savedMin ? m(s.savedMin) : undefined, photos: (s.photos ?? []).map((tone, i) => ({ id: `${s.id}-img${i + 1}`, tone })), meetupId: s.meetup,
    status: s.status ?? 'public', reports: s.reports ?? 0, comments: s.comments ?? [],
  }
}

/* ===== 저장소 ===== */
let posts: BoardPost[] = SEEDS.map(fromSeed)
const subs = new Set<() => void>()
function commit(next: BoardPost[]) { posts = next; subs.forEach((f) => f()) }
function patch(id: string, f: (p: BoardPost) => BoardPost) { commit(posts.map((p) => (p.id === id ? f(p) : p))) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const snap = () => posts

/** 모든 글 (삭제 포함). 화면에서는 아래 골라내기 함수와 같이 씀 */
export function usePosts() { return useSyncExternalStore(subscribe, snap, snap) }
export const getPost = (id: string) => posts.find((p) => p.id === id)
/** 훅 바깥에서 지금 글 목록 (목 서버 api/board.ts) */
export const getPosts = () => posts

/* ===== 계산 ===== */
const live = (c: BoardComment) => c.status !== 'deleted'
/** 댓글 수 = 댓글 + 답글 (삭제 빼고) */
export function commentCount(p: BoardPost) {
  const n = p.comments.filter(live).reduce((a, c) => a + 1 + c.replies.filter(live).length, 0)
  return p.comments.length ? n : p.commentTotal ?? n
}
export const likesOf = (p: BoardPost) => p.likes + (p.liked ? 1 : 0)
/**
 * 인기 점수 = 최근 7일 동안 받은 좋아요 수 (F8 명세 11-20: 댓글 · 저장은 안 셈).
 * 인기순 정렬 · 이번 주 TOP5 · 글 상세 "다음 읽을 글"이 같이 씀.
 * 목 데이터에는 좋아요 시각이 없어 지금은 받은 좋아요 전체를 7일 안의 것으로 봄(TOP5 는 글 쓴 날 기준 7일 필터).
 * 서버가 오면 서버의 "최근 7일 좋아요 수"로 바꾼다
 */
export const scoreOf = (p: BoardPost) => likesOf(p)
/** 목록·인기·저장·댓글 단 글에 보이는 글 (가려짐·삭제 빼고) */
export const isListed = (p: BoardPost) => p.status === 'public'
export const isMine = (p: { authorId: string }) => p.authorId === ME_ID
const within7 = (p: BoardPost) => Date.now() - p.at <= 7 * DAY

/** 이번 주 인기 글 TOP5: 최근 7일, 좋아요 많은 순, 같으면 최신. 점수 0 인 글은 빼서 5개보다 적을 수 있음 (api 08 highlights) */
export function hotPosts(all: BoardPost[], n = 5) {
  return all.filter((p) => isListed(p) && within7(p) && scoreOf(p) > 0).sort((a, b) => scoreOf(b) - scoreOf(a) || b.at - a.at).slice(0, n)
}
/** 많이 이야기하는 관심사: 최근 7일 글 수가 많은 대분류 상위 8개 */
export function hotInterests(all: BoardPost[], n = 8) {
  const cnt = new Map<string, number>()
  for (const p of all) if (isListed(p) && within7(p)) for (const t of p.interests) cnt.set(t, (cnt.get(t) ?? 0) + 1)
  return [...cnt.entries()].sort((a, b) => b[1] - a[1] || BIG_INTERESTS.indexOf(a[0]) - BIG_INTERESTS.indexOf(b[0])).slice(0, n).map(([k]) => k)
}
/** 내 관심사 (세부) → 대분류 이름 */
export function myBigInterests() {
  return [...new Set(getMyInterests(USERS[ME_ID].interests).map((i) => categoryOf(i)?.name).filter((x): x is string => !!x))]
}
/** 내 댓글·답글 (최근 것 먼저) */
export function myCommentsOn(p: BoardPost) {
  const out: BoardComment[] = []
  for (const c of p.comments) {
    if (live(c) && c.authorId === ME_ID) out.push(c)
    for (const r of c.replies) if (live(r) && r.authorId === ME_ID) out.push(r)
  }
  return out.sort((a, b) => b.at - a.at)
}

/* ===== 바꾸기 ===== */
export interface PostDraft {
  category: PostCategory
  title: string
  body: string
  interests: string[]
  photos: BoardPhoto[]
  meetupId?: string
}

let postSeq = 0
export function createPost(d: PostDraft): string {
  const id = `p${Date.now().toString(36)}${++postSeq}`
  commit([{ id, ...d, authorId: ME_ID, at: Date.now(), views: 0, likes: 0, saves: 0, status: 'public', reports: 0, comments: [] }, ...posts])
  return id
}
/**
 * 글 수정. "수정됨"(editedAt)은 **제목이나 본문을 고쳤을 때만** 붙인다 (08 글 상세 6).
 * 카테고리 · 태그 · 사진 · 모임 연결만 바꾸면 안 붙이고, 이미 붙어 있던 것도 그대로 둔다
 */
export function updatePost(id: string, d: PostDraft) {
  patch(id, (p) => ({ ...p, ...d, editedAt: d.title !== p.title || d.body !== p.body ? Date.now() : p.editedAt }))
}
/** 글 삭제: 댓글·답글도 함께 사라짐 */
export function deletePost(id: string) { patch(id, (p) => ({ ...p, status: 'deleted', comments: [], savedAt: undefined })) }

/** 조회수 +1: 글을 열 때마다 셈 (작성자 본인도 셈, api 08 POST /views). 올린 뒤의 수 */
export function viewPost(id: string): number {
  patch(id, (x) => ({ ...x, views: x.views + 1 }))
  return getPost(id)?.views ?? 0
}
/** 좋아요 켜기 · 끄기 (같은 값이면 그대로) */
export function setLike(id: string, on: boolean) { if (!!getPost(id)?.liked !== on) patch(id, (p) => ({ ...p, liked: on })) }
/** 저장 켜기 · 끄기 (같은 값이면 그대로, 켤 때 저장한 시각) */
export function setSave(id: string, on: boolean) { if (!!getPost(id)?.savedAt !== on) patch(id, (p) => ({ ...p, savedAt: on ? Date.now() : undefined })) }
/** 신고: 내게는 접힘, 3명이 되면 가려짐. 이미 신고했으면 false */
export function reportPost(id: string): boolean {
  const p = getPost(id)
  if (!p || p.reportedByMe) return false
  patch(id, (x) => { const reports = x.reports + 1; return { ...x, reports, reportedByMe: true, status: reports >= HIDE_AT ? 'hidden' : x.status } })
  return true
}

/* 댓글 */
let commentSeq = 0
const newCommentId = (prefix: string) => `${prefix}${Date.now().toString(36)}${++commentSeq}`
function mapComments(postId: string, f: (list: BoardComment[]) => BoardComment[]) { patch(postId, (p) => ({ ...p, comments: f(p.comments) })) }
/** 댓글이나 답글 하나 바꾸기 */
function mapOne(postId: string, commentId: string, f: (c: BoardComment) => BoardComment) {
  mapComments(postId, (l) => l.map((c) => (c.id === commentId ? f(c) : { ...c, replies: c.replies.map((r) => (r.id === commentId ? f(r) : r)) })))
}
/** 댓글 하나와 그 글 · 달린 댓글(답글이면 부모) 찾기 */
export function findComment(commentId: string): { post: BoardPost; comment: BoardComment; parent: BoardComment | null } | undefined {
  for (const post of posts) {
    for (const c of post.comments) {
      if (c.id === commentId) return { post, comment: c, parent: null }
      const r = c.replies.find((x) => x.id === commentId)
      if (r) return { post, comment: r, parent: c }
    }
  }
  return undefined
}
/** 댓글 쓰기 → 새 댓글 id */
export function addComment(postId: string, text: string): string {
  const id = newCommentId('c')
  mapComments(postId, (l) => [...l, { id, authorId: ME_ID, text, at: Date.now(), likes: 0, status: 'public', reports: 0, replies: [] }])
  return id
}
/** 다른 사람이 댓글 쓰기 (목 서버의 "다른 계정" 흉내, api/community/mock.ts mockCommunityActors) → 새 댓글 id */
export function addCommentBy(postId: string, authorId: string, text: string): string {
  const id = newCommentId('c')
  mapComments(postId, (l) => [...l, { id, authorId, text, at: Date.now(), likes: 0, status: 'public', reports: 0, replies: [] }])
  return id
}
/** 다른 사람이 좋아요 (내 좋아요 여부는 그대로, 수만 + 1) */
export function likeBy(postId: string) { patch(postId, (p) => ({ ...p, likes: p.likes + 1 })) }
/** 답글 쓰기 (parentId 는 댓글) → 새 답글 id. mention 은 답글에 다시 답할 때의 닉네임 */
export function addReply(postId: string, parentId: string, text: string, mention?: string): string {
  const id = newCommentId('r')
  const r: BoardComment = { id, authorId: ME_ID, text, mention, at: Date.now(), likes: 0, status: 'public', reports: 0, replies: [] }
  mapComments(postId, (l) => l.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, r] } : c)))
  return id
}
/** 댓글 고치기. 본문이 달라졌을 때만 "수정됨" */
export function editComment(postId: string, commentId: string, text: string) {
  mapOne(postId, commentId, (c) => (c.text === text ? c : { ...c, text, editedAt: Date.now() }))
}
/** 댓글 삭제: 답글이 달렸으면 답글까지 지움 */
export function deleteComment(postId: string, commentId: string) {
  mapComments(postId, (l) => l.filter((c) => c.id !== commentId).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })))
}
export function setCommentLike(postId: string, commentId: string, on: boolean) { mapOne(postId, commentId, (c) => ({ ...c, liked: on })) }
export function reportComment(postId: string, commentId: string): boolean {
  const p = getPost(postId)
  const target = p?.comments.flatMap((c) => [c, ...c.replies]).find((c) => c.id === commentId)
  if (!target || target.reportedByMe) return false
  mapOne(postId, commentId, (x) => { const reports = x.reports + 1; return { ...x, reports, reportedByMe: true, status: reports >= HIDE_AT ? 'hidden' : x.status } })
  return true
}

/* ===== 올린 사진 (uploaded_image 자리) ===== */
const uploaded = new Map<string, { url: string; tone: Tone }>()
let imageSeq = 0
const UPLOAD_TONES: Tone[] = ['sage', 'clay', 'butter', 'sky', 'lilac', 'rose', 'mint']
/** POST /images 목: 사진 주소(object URL)를 기록하고 id 를 줌 */
export function registerImage(url: string): string {
  const id = `img-${Date.now().toString(36)}-${++imageSeq}`
  uploaded.set(id, { url, tone: UPLOAD_TONES[imageSeq % UPLOAD_TONES.length] })
  return id
}
/** 올려 두고 아직 어느 글에도 붙이지 않은 사진 */
export function uploadedImage(id: string): BoardPhoto | undefined {
  const u = uploaded.get(id)
  return u ? { id, tone: u.tone, url: u.url } : undefined
}
/** 글에 붙이면 "올려 둔 사진"에서 뺀다 (다른 글에 또 쓸 수 없음) */
export function claimImage(id: string) { uploaded.delete(id) }

/* ===== 사용자 · 방명록 신고 기록 (POST /reports 의 MEMBER · GUESTBOOK) ===== */
const otherReports = new Set<string>()
/** 처음 신고면 true, 이미 신고했으면 false */
export function reportOther(kind: 'MEMBER' | 'GUESTBOOK', id: string): boolean {
  const k = `${kind}:${id}`
  if (otherReports.has(k)) return false
  otherReports.add(k)
  return true
}

/** 내 활동 개수 */
export function myActivity(all: BoardPost[]) {
  return {
    mine: all.filter((p) => isMine(p) && p.status !== 'deleted').length,
    commented: all.filter((p) => isListed(p) && myCommentsOn(p).length > 0).length,
    saved: all.filter((p) => isListed(p) && p.savedAt).length,
  }
}
