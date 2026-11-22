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
  /** ISO 8601 + 오프셋 ("2026-11-16T17:40:05+09:00"). 표시는 lib/time.ts */
  createdAt: string
  /** 이 글을 신고한 서로 다른 사람들 (목 데이터. 3명이면 가려져 목록·글 수에서 빠짐 — 04 내 땅굴 "방명록 글이 만들어지고 없어지는 때") */
  reporters?: string[]
}

/** 커뮤니티 글 카테고리 (Figma 02 F8: 모임 홍보 · 모임 후기 · 자유) */
export type PostCategory = '모임 홍보' | '모임 후기' | '자유'

export type MyMeetupStatus = '참여 확정' | '신청 대기' | '내가 주최' | '찜'

export interface Meetup {
  id: string
  title: string
  /** 모임 카테고리 이름 (data/meetupCategory.ts 6개 중 하나, 관심사와 관계없음 — 명세 07) */
  category: string
  /** 달력 날짜 YYYY-MM-DD (Asia/Seoul) */
  date: string
  /** 시작·끝 시각: 만들기 양식 값 그대로 ('오후 2:00', 끝은 '다음 날 오전 11:00' 도 있음). 서버와는 ISO 8601(starts_at·ends_at)로 주고받음 → api/mappers */
  start: string
  end: string
  area: string
  place: string
  mode: '오프라인' | '온라인'
  capacity: number
  memberIds: string[]
  hostId: string
  intro: string
  myStatus?: MyMeetupStatus
  past?: boolean
  /** 주최자가 취소한 모임 (2026-11-12 모임 상세 – 취소된 모임) */
  cancelled?: boolean
  /** 카드 위 나무 팻말 글자 (2026-11-11 Meetup Card) */
  sign?: string
  /** 내가 신청할 때 남긴 말 (신청 대기 모임 팝업) */
  myNote?: string
}

