/**
 * 08 커뮤니티 DTO → 앱 모양 (화면은 이 결과만 쓴다). id 는 문자열(toAppId), 시각은 ms(parseIso), 카테고리는 한글 이름.
 */
import { toAppId, toDtoId, toPersonFromDisplay, type Id, type Person } from '../common'
import { CATEGORIES } from '../../data/mock'
import { categorySeedId } from '../mock/seedIds'
import type { PostCategory, Tone } from '../../data/types'
import { parseIso } from '../../lib/time'
import type {
  CommentDto, CommentThreadDto, InterestCategoryRefDto, MyPostCardDto, MyPostsSummaryDto, PostCardDto, PostCategoryCode, PostDetailDto,
  PostHighlightsDto, PostMeetupCardDto, PostSort, PostWriteRequest,
} from './types'

/* ===== 카테고리 · 정렬 ===== */
export const POST_CATEGORY: Record<PostCategoryCode, PostCategory> = { PROMOTION: '모임 홍보', REVIEW: '모임 후기', FREE: '자유' }
export const POST_CATEGORY_CODE: Record<PostCategory, PostCategoryCode> = { '모임 홍보': 'PROMOTION', '모임 후기': 'REVIEW', 자유: 'FREE' }
export type PostSortLabel = '최신순' | '인기순' | '댓글순'
export const POST_SORT_CODE: Record<PostSortLabel, PostSort> = { 최신순: 'LATEST', 인기순: 'POPULAR', 댓글순: 'MOST_COMMENTED' }

/* ===== 관심사 대분류: 화면은 이름, 서버는 id ===== */
/**
 * 받은 응답에서 본 { id, name } 을 기억해 둔다 → 거르기(interestCategoryId) · 글쓰기(interestCategoryIds)에 이름으로 id 를 찾는다.
 * 못 본 이름은 앱 대분류 표(data/mock CATEGORIES)의 순서로 (명세 dev 9ea6698: 대분류 id 는 00 공통 5 표 순서 1 ~ 12, api/mock/seedIds).
 * 실제 서버의 대분류 id 는 GET /interest-categories(온보딩 영역)로 채우는 것이 맞다 → docs/backend/api-v1/08-community.md
 */
const catIdByName = new Map<string, Id>()
export function rememberInterestCategories(list: InterestCategoryRefDto[]) { for (const c of list) catIdByName.set(c.name, c.id) }
export function interestCategoryIdOf(name: string): Id | undefined {
  const seen = catIdByName.get(name)
  if (seen != null) return seen
  const cat = CATEGORIES.find((c) => c.name === name)
  return cat ? categorySeedId(cat.id) : undefined
}
const catNames = (l: InterestCategoryRefDto[]) => { rememberInterestCategories(l); return l.map((c) => c.name) }

/* ===== 사진 ===== */
export interface PhotoVM {
  /** 사진 id (글을 고칠 때 imageIds 로 다시 보냄) */
  id: string
  /** 그림이 없을 때 칸 색 */
  tone: Tone
  url?: string
}
const TONES: Tone[] = ['sage', 'clay', 'butter', 'sky', 'lilac', 'rose', 'mint', 'sand']
/** 사진 주소 → 칸. 목 서버의 "tone:<색>" 은 색 칸으로 */
export function toPhoto(url: string, id = ''): PhotoVM {
  const m = /^tone:(\w+)$/.exec(url)
  if (m && (TONES as string[]).includes(m[1])) return { id, tone: m[1] as Tone }
  return { id, tone: 'sand', url }
}

/* ===== 글 카드 ===== */
export interface PostCardVM {
  id: string
  category: PostCategory
  title: string
  /** 본문 앞 100자 */
  preview: string
  thumb: PhotoVM | null
  author: Person
  /** 관심사 대분류 이름 */
  interests: string[]
  createdAt: number
  views: number
  likes: number
  /** 댓글 + 답글 */
  comments: number
  bookmarked: boolean
  /** 신고로 가려짐 (내가 쓴 글에서만) */
  hidden: boolean
  reportedByMe: boolean
}
export function toPostCard(d: PostCardDto): PostCardVM {
  return {
    id: toAppId(d.id), category: POST_CATEGORY[d.category], title: d.title, preview: d.contentPreview,
    thumb: d.thumbnailUrl ? toPhoto(d.thumbnailUrl) : null, author: toPersonFromDisplay(d.author), interests: catNames(d.interestCategories),
    createdAt: parseIso(d.createdAt), views: d.viewCount, likes: d.likeCount, comments: d.commentCount, bookmarked: d.isBookmarked,
    hidden: d.isHidden, reportedByMe: d.isReportedByMe,
  }
}
/** 내 활동 목록의 한 줄 */
export interface MyPostCardVM extends PostCardVM {
  canEdit: boolean
  /** 저장한 글: 저장한 시각 */
  bookmarkedAt: number | null
  /** 댓글 단 글: 내 가장 최근 댓글 */
  myLatestComment: { id: string; content: string } | null
  /** 댓글 단 글: 내 댓글 수 ("외 N개" 는 이 값 - 1) */
  myCommentCount: number
}
export function toMyPostCard(d: MyPostCardDto): MyPostCardVM {
  return {
    ...toPostCard(d), canEdit: d.canEdit, bookmarkedAt: d.bookmarkedAt ? parseIso(d.bookmarkedAt) : null,
    myLatestComment: d.myLatestComment ? { id: toAppId(d.myLatestComment.id), content: d.myLatestComment.content } : null, myCommentCount: d.myCommentCount,
  }
}

/* ===== 인기 글 · 관심사 · 내 활동 ===== */
export interface HighlightsVM {
  top: { rank: number; id: string; category: PostCategory; title: string }[]
  /** 많이 이야기하는 관심사 대분류 이름 */
  interests: string[]
}
export const toHighlights = (d: PostHighlightsDto): HighlightsVM => ({
  top: d.weeklyTopPosts.map((p) => ({ rank: p.rank, id: toAppId(p.id), category: POST_CATEGORY[p.category], title: p.title })),
  interests: catNames(d.trendingInterestCategories),
})
export interface MySummaryVM { mine: number; commented: number; saved: number }
export const toMySummary = (d: MyPostsSummaryDto): MySummaryVM => ({ mine: d.writtenCount, commented: d.commentedCount, saved: d.bookmarkedCount })

/* ===== 글에 연결한 모임 (07 모임 카드) ===== */
export type Recruit = 'open' | 'closed' | 'past' | 'cancelled'
const RECRUIT: Record<PostMeetupCardDto['recruitStatus'], Recruit> = { OPEN: 'open', CLOSED: 'closed', PAST: 'past', CANCELED: 'cancelled' }
export interface LinkedMeetupVM {
  id: string
  title: string
  startsAt: number
  endsAt: number | null
  mode: 'OFFLINE' | 'ONLINE'
  place: string | null
  capacity: number
  confirmed: number
  recruit: Recruit
}
export const toLinkedMeetup = (d: PostMeetupCardDto): LinkedMeetupVM => ({
  id: toAppId(d.id), title: d.title, startsAt: parseIso(d.startsAt), endsAt: d.endsAt ? parseIso(d.endsAt) : null, mode: d.mode, place: d.place,
  capacity: d.capacity, confirmed: d.confirmedCount, recruit: RECRUIT[d.recruitStatus],
})

/* ===== 글 상세 ===== */
export interface PostDetailVM {
  id: string
  category: PostCategory
  title: string
  content: string
  /** 보여 주는 순서, 첫 장이 대표 사진 */
  images: PhotoVM[]
  author: Person
  /** 작성자 관심사 가운데 나와 겹치는 것 (세부 관심사 이름) */
  sharedInterests: string[]
  interests: string[]
  meetup: LinkedMeetupVM | null
  createdAt: number
  /** "수정됨" */
  edited: boolean
  views: number
  likes: number
  comments: number
  liked: boolean
  bookmarked: boolean
  mine: boolean
  hidden: boolean
  reportedByMe: boolean
  canEdit: boolean
}
export function toPostDetail(d: PostDetailDto): PostDetailVM {
  return {
    id: toAppId(d.id), category: POST_CATEGORY[d.category], title: d.title, content: d.content,
    images: d.images.map((i) => toPhoto(i.url, toAppId(i.id))), author: toPersonFromDisplay(d.author),
    sharedInterests: d.authorSharedInterests.map((t) => t.name), interests: catNames(d.interestCategories),
    meetup: d.meetup ? toLinkedMeetup(d.meetup) : null, createdAt: parseIso(d.createdAt), edited: d.isEdited,
    views: d.viewCount, likes: d.likeCount, comments: d.commentCount, liked: d.isLiked, bookmarked: d.isBookmarked,
    mine: d.isMine, hidden: d.isHidden, reportedByMe: d.isReportedByMe, canEdit: d.canEdit,
  }
}

/* ===== 댓글 ===== */
export interface CommentVM {
  id: string
  author: Person
  /** 가려진 댓글은 null */
  content: string | null
  /** 답글에 다시 답했을 때 "@닉네임" (탈퇴했으면 '탈퇴한 사용자') */
  mention: string | null
  createdAt: number
  edited: boolean
  likes: number
  liked: boolean
  mine: boolean
  hidden: boolean
  reportedByMe: boolean
}
export interface CommentThreadVM extends CommentVM { replies: CommentVM[] }
export function toComment(c: CommentDto): CommentVM {
  return {
    id: toAppId(c.id), author: toPersonFromDisplay(c.author), content: c.content,
    mention: c.mentionUser ? c.mentionUser.nickname ?? '탈퇴한 사용자' : null,
    createdAt: parseIso(c.createdAt), edited: c.isEdited, likes: c.likeCount, liked: c.isLiked, mine: c.isMine, hidden: c.isHidden, reportedByMe: c.isReportedByMe,
  }
}
export const toCommentThread = (c: CommentThreadDto): CommentThreadVM => ({ ...toComment(c), replies: c.replies.map(toComment) })

/* ===== 글쓰기 · 고치기 ===== */
/** 글 양식의 값 (앱 모양) */
export interface PostFormValue {
  category: PostCategory
  title: string
  content: string
  /** 관심사 대분류 이름 */
  interests: string[]
  /** 올린 사진 id (보여 줄 순서) */
  imageIds: string[]
  meetupId: string | null
}
export function toPostWriteRequest(v: PostFormValue): PostWriteRequest {
  return {
    category: POST_CATEGORY_CODE[v.category], title: v.title, content: v.content,
    interestCategoryIds: v.interests.map(interestCategoryIdOf).filter((x): x is Id => x != null),
    imageIds: v.imageIds.map(toDtoId), meetupId: v.meetupId ? toDtoId(v.meetupId) : null,
  }
}
