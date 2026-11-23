/**
 * 08 커뮤니티 — 실제 서버 호출. 명세: docs/backend/team-spec/api/08-community.md
 * 신고(POST /reports)와 사진 올리기(POST /images)도 08 문서에 있어 이 영역이 맡는다 (방명록 · 사용자 신고도 같은 API).
 * 경로는 /api/v1 뒤만 쓴다. id 는 DTO 숫자(Id) — 화면은 mappers · queries 를 거쳐 문자열 id 로 쓴다.
 */
import { http } from '../client'
import { toDtoId } from '../common/ids'
import type { CursorPageDto, Id, ItemsDto, PageDto } from '../common/types'
import type {
  BookmarkStateDto, CommentCreateRequest, CommentCreatedDto, CommentDeletedDto, CommentListQuery, CommentThreadDto, CommentUpdateRequest,
  CommentUpdatedDto, ImageUploadedDto, LikeStateDto, MyPostCardDto, MyPostsQuery, MyPostsSummaryDto, PostCardDto, PostCategoryCode,
  PostCreatedDto, PostDetailDto, PostHighlightsDto, PostListQuery, PostMeetupCardDto, PostWriteRequest, ReportCreatedDto, ReportReason,
  ReportRequest, ReportTargetType, ViewCountDto,
} from './types'

/** 명세대로 만든 API (완성도 검사: src/tests/api-v1-endpoints.test.ts) */
export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/posts',
  'GET /api/v1/posts/highlights',
  'POST /api/v1/posts',
  'GET /api/v1/posts/{postId}',
  'PATCH /api/v1/posts/{postId}',
  'DELETE /api/v1/posts/{postId}',
  'POST /api/v1/posts/{postId}/views',
  'GET /api/v1/posts/{postId}/related-posts',
  'PUT /api/v1/posts/{postId}/like',
  'DELETE /api/v1/posts/{postId}/like',
  'PUT /api/v1/posts/{postId}/bookmark',
  'DELETE /api/v1/posts/{postId}/bookmark',
  'GET /api/v1/posts/{postId}/comments',
  'POST /api/v1/posts/{postId}/comments',
  'PATCH /api/v1/comments/{commentId}',
  'DELETE /api/v1/comments/{commentId}',
  'PUT /api/v1/comments/{commentId}/like',
  'DELETE /api/v1/comments/{commentId}/like',
  'GET /api/v1/me/posts',
  'GET /api/v1/me/posts/summary',
  'GET /api/v1/me/linkable-meetups',
  'POST /api/v1/images',
  'POST /api/v1/reports',
]

/* ===== 신고 사유 (화면 문구 ↔ 코드) ===== */
/** 화면 사유 문구(components/Feedback REPORT_REASONS) → reason 코드 */
export const REPORT_REASON_CODE: Record<string, ReportReason> = { '스팸·홍보': 'SPAM', '욕설·비하·괴롭힘': 'ABUSE', 음란물: 'OBSCENE', 기타: 'ETC' }
/**
 * ReportDialog 가 주는 사유("기타: …" 포함) → POST /reports 본문.
 * 명세 모양 그대로: targetType POST · COMMENT · MEMBER · GUESTBOOK, targetId 숫자(앱 id 문자열을 주면 toDtoId), reason SPAM · ABUSE · OBSCENE · ETC
 */
export function reportBody(targetType: ReportTargetType, targetId: Id | string, picked: string): ReportRequest {
  const etc = picked.startsWith('기타:')
  return { targetType, targetId: toDtoId(targetId), reason: etc ? 'ETC' : REPORT_REASON_CODE[picked] ?? 'ETC', detail: etc ? picked.slice(3).trim() : null }
}

const p = (id: Id) => `/posts/${id}`
const c = (id: Id) => `/comments/${id}`

export const real = {
  /** GET /posts — 목록 (페이지, 기본 20개) */
  list: (q: PostListQuery, signal?: AbortSignal) => http.get<PageDto<PostCardDto>>('/posts', { ...q }, signal),
  /** GET /posts/highlights — 이번 주 인기 글 TOP5 + 많이 이야기하는 관심사 8 */
  highlights: (signal?: AbortSignal) => http.get<PostHighlightsDto>('/posts/highlights', undefined, signal),
  /** POST /posts — 글쓰기 (201 { postId }) */
  create: (req: PostWriteRequest) => http.post<PostCreatedDto>('/posts', req),
  /** GET /posts/{postId} — 상세 (없거나 삭제 404 POST_NOT_FOUND, 가려진 남의 글 404 POST_HIDDEN). 조회수는 올리지 않음 */
  get: (id: Id, signal?: AbortSignal) => http.get<PostDetailDto>(p(id), undefined, signal),
  /** PATCH /posts/{postId} — 고치기 (모든 값을 보냄, data null) */
  update: (id: Id, req: PostWriteRequest) => http.patch<null>(p(id), req),
  /** DELETE /posts/{postId} — 지우기 (댓글 · 답글도 함께) */
  remove: (id: Id) => http.delete<null>(p(id)),
  /** POST /posts/{postId}/views — 조회수 +1 (글 상세를 열 때마다. 글 수정 화면은 부르지 않음) */
  view: (id: Id) => http.post<ViewCountDto>(`${p(id)}/views`),
  /** GET /posts/{postId}/related-posts — 다음 읽을 글 3개 */
  related: (id: Id, signal?: AbortSignal) => http.get<ItemsDto<PostCardDto>>(`${p(id)}/related-posts`, undefined, signal),
  /** PUT · DELETE /posts/{postId}/like (멱등) */
  setLike: (id: Id, on: boolean) => (on ? http.put<LikeStateDto>(`${p(id)}/like`) : http.delete<LikeStateDto>(`${p(id)}/like`)),
  /** PUT · DELETE /posts/{postId}/bookmark (멱등) */
  setBookmark: (id: Id, on: boolean) => (on ? http.put<BookmarkStateDto>(`${p(id)}/bookmark`) : http.delete<BookmarkStateDto>(`${p(id)}/bookmark`)),

  /** GET /posts/{postId}/comments — 댓글 (커서, 댓글 10개씩 · 답글은 모두 붙여서) */
  comments: (postId: Id, q: CommentListQuery = {}, signal?: AbortSignal) => http.get<CursorPageDto<CommentThreadDto>>(`${p(postId)}/comments`, { ...q }, signal),
  /** POST /posts/{postId}/comments — 댓글 · 답글 쓰기 (201) */
  addComment: (postId: Id, req: CommentCreateRequest) => http.post<CommentCreatedDto>(`${p(postId)}/comments`, req),
  /** PATCH /comments/{commentId} */
  editComment: (commentId: Id, req: CommentUpdateRequest) => http.patch<CommentUpdatedDto>(c(commentId), req),
  /** DELETE /comments/{commentId} — 답글이 달린 댓글이면 답글도 함께 */
  deleteComment: (commentId: Id) => http.delete<CommentDeletedDto>(c(commentId)),
  /** PUT · DELETE /comments/{commentId}/like (멱등) */
  setCommentLike: (commentId: Id, on: boolean) => (on ? http.put<LikeStateDto>(`${c(commentId)}/like`) : http.delete<LikeStateDto>(`${c(commentId)}/like`)),

  /** GET /me/posts — 내가 쓴 글 · 댓글 단 글 · 저장한 글 (tab) */
  myPosts: (q: MyPostsQuery, signal?: AbortSignal) => http.get<PageDto<MyPostCardDto>>('/me/posts', { ...q }, signal),
  /** GET /me/posts/summary — 내 활동 개수 */
  myPostsSummary: (signal?: AbortSignal) => http.get<MyPostsSummaryDto>('/me/posts/summary', undefined, signal),
  /** GET /me/linkable-meetups — 글 카테고리에 연결할 수 있는 내 모임 (나누지 않음) */
  linkableMeetups: (postCategory: PostCategoryCode, signal?: AbortSignal) => http.get<ItemsDto<PostMeetupCardDto>>('/me/linkable-meetups', { postCategory }, signal),

  /** POST /images — 사진 한 장 (multipart, 필드 이름 file. JPEG · PNG · WebP, 5MB 이하). 201 { imageId, url } */
  uploadImage: (file: Blob) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<ImageUploadedDto>('/images', form)
  },
  /** POST /reports — 글 · 댓글 · 사용자 · 방명록 글 신고 (201 { reportId }) */
  createReport: (req: ReportRequest) => http.post<ReportCreatedDto>('/reports', req),
}
export type CommunityApi = typeof real
