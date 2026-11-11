export type Tone = 'sage' | 'clay' | 'butter' | 'sky' | 'lilac' | 'rose' | 'mint' | 'sand'

export interface Tag {
  /** 세부 관심사 id (interest_catalog.json) */
  id: string
  name: string
  /** 같은 취향을 고른 사람 수. 적을수록 니치 */
  count: number
}

export interface Category {
  id: string
  name: string
  emoji: string
  tone: Tone
  tags: Tag[]
}

export interface QnA {
  q: string
  a: string
}

export interface User {
  id: string
  nickname: string
  /** 예: SSAFY 16기 · 지역 · 0반 */
  affiliation: string
  intro: string
  interests: string[]
  qna?: QnA[]
  online?: boolean
  /** 지금 땅굴에 와 있는 방문자 수 */
  visitorsNow?: number
  /** 두더지가 낀 액세서리 id (data/moleItems, 부위마다 1개 최대 4개) */
  worn?: string[]
}

export interface GuestbookEntry {
  id: string
  authorId: string
  text: string
  /** ISO 문자열 */
  createdAt: string
}

export type PostCategory = '자유' | '정보' | '질문' | '모임 후기'

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string
  likes: number
  isAuthor?: boolean
  replies?: Comment[]
}

export interface Post {
  id: string
  category: PostCategory
  interest: string
  title: string
  body: string[]
  authorId: string
  createdAt: string
  views: number
  likes: number
  comments: Comment[]
  hasPhoto?: boolean
}

export type MyMeetupStatus = '참여 확정' | '신청 대기' | '내가 주최' | '찜'

export interface Meetup {
  id: string
  title: string
  interest: string
  /** YYYY-MM-DD */
  date: string
  start: string
  end: string
  area: string
  place: string
  mode: '오프라인' | '온라인'
  capacity: number
  memberIds: string[]
  hostId: string
  intro: string
  closesAt: string
  myStatus?: MyMeetupStatus
  past?: boolean
  /** 카드 위 나무 팻말 글자 (2026-11-11 Meetup Card) */
  sign?: string
  /** 내가 신청할 때 남긴 말 (신청 대기 모임 팝업) */
  myNote?: string
  myNoteAgo?: string
}

export interface Message {
  id: string
  authorId: string
  text: string
  time: string
  system?: boolean
  meetupId?: string
}

export interface ChatRoom {
  id: string
  kind: 'dm' | 'group'
  partnerId?: string
  meetupId?: string
  state: 'pending' | 'open'
  messages: Message[]
  unread: number
  lastAt: string
}

export interface ChatRequest {
  id: string
  kind: 'dm' | 'meetup'
  direction: 'received' | 'sent'
  userId: string
  meetupId?: string
  message: string
  context: string
  ago: string
}
