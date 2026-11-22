/**
 * 08 커뮤니티 (신고 · 사진 올리기 포함) DTO. 명세: docs/backend/team-spec/api/08-community.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 커뮤니티 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'
import type { MemberSummaryDto } from '../common/legacy'
import type { MeetupCardDto } from '../meetups/types'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string

/** post.category */
export type PostCategoryCode = 'MEETUP_PROMO' | 'MEETUP_REVIEW' | 'FREE'
/** post.status · comment.status */
export type ContentStatus = 'PUBLIC' | 'HIDDEN' | 'DELETED'

/** report.target_type */
export type ReportTargetType = 'POST' | 'COMMENT' | 'MEMBER' | 'GUESTBOOK' | 'MEETUP'
/** report.reason */
export type ReportReason = 'SPAM' | 'ABUSE' | 'SEXUAL' | 'ETC'

/* ===== 커뮤니티 ===== */
export interface PostImageDto { id: LegacyId; sortOrder: number; url: string }
export interface PostListItemDto {
  id: LegacyId
  category: PostCategoryCode
  title: string
  /** 본문 앞부분 (목록 카드 한 줄) */
  excerpt: string
  author: MemberSummaryDto
  /** post_interest → interest_category.name (최대 5개) */
  interests: string[]
  thumbnailUrl: string | null
  imageCount: number
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  liked: boolean
  /** 내가 저장한 때 (post_bookmark.created_at), 안 했으면 null */
  bookmarkedAt: IsoDateTime | null
  status: ContentStatus
  reportedByMe: boolean
  createdAt: IsoDateTime
  editedAt: IsoDateTime | null
}
export interface PostDetailDto extends PostListItemDto {
  /** VARCHAR(1000) */
  content: string
  images: PostImageDto[]
  meetup: MeetupCardDto | null
  /** 이전/다음 글 (목록 기준, 위험 B8) */
  prevId: LegacyId | null
  nextId: LegacyId | null
}
export interface CommentDto {
  id: LegacyId
  postId: LegacyId
  parentId: LegacyId | null
  author: MemberSummaryDto
  /** 답글에 다시 답할 때 (comment.mention_member_id) */
  mention: { memberId: LegacyId; nickname: string | null } | null
  /** VARCHAR(300) */
  content: string
  status: ContentStatus
  likeCount: number
  liked: boolean
  reportedByMe: boolean
  createdAt: IsoDateTime
  editedAt: IsoDateTime | null
  /** 한 단계만 (parent_id 가 있는 댓글) */
  replies: CommentDto[]
}
export interface PostListQuery {
  category?: PostCategoryCode
  /** 내 관심사만 */
  mine?: boolean
  /** 관심사(대분류) 이름 하나 */
  interest?: string
  q?: string
  sort?: 'LATEST' | 'POPULAR' | 'COMMENTS'
  page?: number
  size?: number
}
export interface PostWriteRequest {
  category: PostCategoryCode
  title: string
  content: string
  interests: string[]
  imageUrls: string[]
  meetupId: LegacyId | null
}
export interface BoardActivityDto { postCount: number; commentedPostCount: number; bookmarkCount: number }


/* ===== 신고 · 관리자 ===== */
export interface ReportRequest {
  targetType: ReportTargetType
  targetId: LegacyId
  reason: ReportReason
  /** "기타"일 때 필수, VARCHAR(100) */
  detail: string | null
}
