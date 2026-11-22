/**
 * 08 커뮤니티 (신고 · 사진 올리기 포함) DTO — 명세 그대로. docs/backend/team-spec/api/08-community.md
 * id 는 숫자(Id), 시각은 UTC "…Z"(UtcInstant), enum 은 대문자, 값이 없으면 null. 앱 모양으로는 ./mappers.ts 가 바꾼다.
 */
import type { Id, UserDisplayDto, InterestTagDto, UtcInstant } from '../common/types'

/* ===== 값 ===== */
/** post.category: 모임 홍보 · 모임 후기 · 자유 */
export type PostCategoryCode = 'PROMOTION' | 'REVIEW' | 'FREE'
/** GET /posts 의 sort: 최신순 · 인기순(최근 7일 좋아요) · 댓글순(댓글 + 답글) */
export type PostSort = 'LATEST' | 'POPULAR' | 'MOST_COMMENTED'
/** GET /me/posts 의 tab: 내가 쓴 글 · 댓글 단 글 · 저장한 글 */
export type MyPostsTab = 'WRITTEN' | 'COMMENTED' | 'BOOKMARKED'

/** 글에 붙인 관심사 대분류 { id, name } */
export interface InterestCategoryRefDto { id: Id; name: string }

/* ===== 글 카드 (커뮤니티 · 내 활동 · 다음 읽을 글이 함께 씀) ===== */
export interface PostCardDto {
  id: Id
  category: PostCategoryCode
  title: string
  /** 본문 앞 100자 */
  contentPreview: string
  /** 첫 사진 주소. 없으면 null */
  thumbnailUrl: string | null
  author: UserDisplayDto
  interestCategories: InterestCategoryRefDto[]
  createdAt: UtcInstant
  viewCount: number
  likeCount: number
  /** 댓글 + 답글 (삭제 빼고, 가려진 것은 셈) */
  commentCount: number
  isBookmarked: boolean
  /** 신고로 가려짐. 내가 쓴 글 목록에서만 true 가 온다 */
  isHidden: boolean
  /** 내가 신고함 → 프론트가 접어서 보여 줌 */
  isReportedByMe: boolean
}

/** GET /posts 쿼리 */
export interface PostListQuery {
  category?: PostCategoryCode
  isMyInterestsOnly?: boolean
  interestCategoryId?: Id
  /** 50자 이하. 빈 문자열이면 검색 안 함 */
  keyword?: string
  sort?: PostSort
  /** 1부터 */
  page?: number
  /** 1 ~ 50, 기본 20 */
  size?: number
}

/** GET /posts/highlights */
export interface PostHighlightsDto {
  /** 이번 주 인기 글 (5개까지, 점수 0 인 글은 없음) */
  weeklyTopPosts: { rank: number; id: Id; category: PostCategoryCode; title: string }[]
  /** 많이 이야기하는 관심사 대분류 (8개까지) */
  trendingInterestCategories: InterestCategoryRefDto[]
}

/* ===== 글 쓰기 · 고치기 ===== */
/** POST /posts · PATCH /posts/{postId} 본문 (PATCH 는 바꾸지 않은 값도 모두 보냄) */
export interface PostWriteRequest {
  category: PostCategoryCode
  /** 1 ~ 50자, 공백만은 안 됨 */
  title: string
  /** 1 ~ 1000자, 공백만은 안 됨 */
  content: string
  /** 0 ~ 5개, 겹치지 않게. 없으면 [] */
  interestCategoryIds: Id[]
  /** 0 ~ 3개. 보낸 순서로 보여 주고 첫 장이 대표 사진 */
  imageIds: Id[]
  /** PROMOTION · REVIEW 는 꼭. 연결하지 않으면 null */
  meetupId: Id | null
}
/** POST /posts 응답 (201) */
export interface PostCreatedDto { postId: Id }

/* ===== 글 상세 ===== */
export interface PostImageDto { id: Id; url: string }

/** 글에 연결한 모임 = 07 모임의 "모임 카드". 모임 영역 DTO 가 바뀌어도 깨지지 않게 여기 따로 둔다 */
export interface PostMeetupCardDto {
  id: Id
  title: string
  /** 07 모임 카테고리 코드 */
  category: string
  startsAt: UtcInstant
  endsAt: UtcInstant | null
  mode: 'OFFLINE' | 'ONLINE'
  place: string | null
  /** 주최자 포함 */
  capacity: number
  /** 주최자 포함 */
  confirmedCount: number
  recruitStatus: 'OPEN' | 'CLOSED' | 'PAST' | 'CANCELED'
}

/** GET /posts/{postId} */
export interface PostDetailDto {
  id: Id
  category: PostCategoryCode
  title: string
  content: string
  images: PostImageDto[]
  author: UserDisplayDto
  /** 작성자 관심사 가운데 나와 겹치는 것 (내 글이면 []) */
  authorSharedInterests: InterestTagDto[]
  interestCategories: InterestCategoryRefDto[]
  /** 연결하지 않았거나 모임이 삭제됐으면 null */
  meetup: PostMeetupCardDto | null
  createdAt: UtcInstant
  /** 제목이나 본문을 고친 적이 있음 → "수정됨" */
  isEdited: boolean
  viewCount: number
  likeCount: number
  commentCount: number
  isLiked: boolean
  isBookmarked: boolean
  isMine: boolean
  /** 작성자에게만 true 가 온다 */
  isHidden: boolean
  isReportedByMe: boolean
  /** 내 글이고 가려지지 않음 */
  canEdit: boolean
}

/** POST /posts/{postId}/views */
export interface ViewCountDto { viewCount: number }
/** PUT · DELETE /posts/{postId}/like, /comments/{commentId}/like */
export interface LikeStateDto { isLiked: boolean; likeCount: number }
/** PUT · DELETE /posts/{postId}/bookmark */
export interface BookmarkStateDto { isBookmarked: boolean }

/* ===== 댓글 ===== */
/** 댓글의 모양 (댓글 · 답글 공통) */
export interface CommentDto {
  id: Id
  author: UserDisplayDto
  /** 가려진 댓글은 null */
  content: string | null
  /** 답글에 다시 답했을 때의 "@닉네임" 대상. 댓글은 늘 null. 탈퇴했으면 nickname null */
  mentionUser: { id: Id; nickname: string | null } | null
  createdAt: UtcInstant
  isEdited: boolean
  likeCount: number
  isLiked: boolean
  isMine: boolean
  isHidden: boolean
  isReportedByMe: boolean
}
/** GET /posts/{postId}/comments 의 한 줄: 댓글 + 그 답글 모두 */
export interface CommentThreadDto extends CommentDto { replies: CommentDto[] }
/** GET /posts/{postId}/comments 쿼리 (size 는 답글을 세지 않음, 1 ~ 100, 기본 10) */
export interface CommentListQuery { cursor?: string | null; size?: number }

/** POST /posts/{postId}/comments 본문 */
export interface CommentCreateRequest {
  /** 1 ~ 300자, 공백만은 안 됨 */
  content: string
  /** 답글이면 답하는 대상(댓글이나 답글)의 id, 댓글이면 null */
  replyToCommentId: Id | null
}
/** POST /posts/{postId}/comments 응답 (201) */
export interface CommentCreatedDto extends CommentDto {
  /** 답글이면 달린 댓글의 id, 댓글이면 null */
  parentCommentId: Id | null
  /** 쓴 뒤의 글 댓글 수 */
  commentCount: number
}
/** PATCH /comments/{commentId} */
export interface CommentUpdateRequest { content: string }
export interface CommentUpdatedDto { content: string; isEdited: boolean }
/** DELETE /comments/{commentId} */
export interface CommentDeletedDto { commentCount: number }

/* ===== 내 활동 ===== */
/** GET /me/posts 쿼리 */
export interface MyPostsQuery {
  tab: MyPostsTab
  category?: PostCategoryCode
  page?: number
  size?: number
}
/** GET /me/posts 의 한 줄 = 글 카드 + 아래 값 */
export interface MyPostCardDto extends PostCardDto {
  /** 내 글이고 가려지지 않음 (내가 쓴 글의 더보기) */
  canEdit: boolean
  /** BOOKMARKED 일 때만, 그 밖에는 null */
  bookmarkedAt: UtcInstant | null
  /** COMMENTED 일 때만, 그 밖에는 null */
  myLatestComment: { id: Id; content: string } | null
  /** COMMENTED 가 아니면 0 */
  myCommentCount: number
}
/** GET /me/posts/summary (카테고리로 거르지 않은 전체 수) */
export interface MyPostsSummaryDto { writtenCount: number; commentedCount: number; bookmarkedCount: number }

/* ===== 사진 ===== */
/** POST /images 응답 (201) */
export interface ImageUploadedDto { imageId: Id; url: string }

/* ===== 신고 ===== */
/** report.target_type (명세: 글 · 댓글 · 사용자 · 방명록 글) */
export type ReportTargetType = 'POST' | 'COMMENT' | 'MEMBER' | 'GUESTBOOK'
/** report.reason */
export type ReportReason = 'SPAM' | 'ABUSE' | 'OBSCENE' | 'ETC'
/** POST /reports 본문 */
export interface ReportRequest {
  targetType: ReportTargetType
  targetId: Id
  reason: ReportReason
  /** ETC 면 꼭 (1 ~ 100자), 그 밖에는 null */
  detail: string | null
}
/** POST /reports 응답 (201) */
export interface ReportCreatedDto { reportId: Id }
