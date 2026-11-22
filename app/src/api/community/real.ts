/**
 * 08 커뮤니티 — 실제 서버 호출. 명세: docs/backend/team-spec/api/08-community.md
 * 신고(POST /reports)와 사진 올리기(POST /images)도 08 문서에 있어 이 영역이 맡는다 (모임 · 방명록 · 프로필 신고도 같은 API)
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다 → 커뮤니티 작업자가 명세 주소 · DTO 로 바꾼다
 */
import { http } from '../client'
import type { LegacyId as Id } from '../common/legacy'
import type { CursorPageDto, PageDto } from '../common/types'
import type {
  BoardActivityDto, CommentDto, PostDetailDto, PostListItemDto, PostListQuery, PostWriteRequest, ReportReason, ReportRequest, ReportTargetType,
} from './types'

export const ENDPOINTS: readonly string[] = []

export interface CommentWrite { content: string; parentId?: Id | null; mentionMemberId?: Id | null; mentionNickname?: string | null }

/** 화면 사유 문구 ↔ reason 코드 (components/Feedback REPORT_REASONS) */
export const REPORT_REASON_CODE: Record<string, ReportReason> = { '스팸·홍보': 'SPAM', '욕설·비하·괴롭힘': 'ABUSE', 음란물: 'SEXUAL', 기타: 'ETC' }
/** ReportDialog 가 주는 사유("기타: …" 포함) → 요청 본문 */
export function reportBody(targetType: ReportTargetType, targetId: Id, picked: string): ReportRequest {
  const etc = picked.startsWith('기타:')
  return { targetType, targetId, reason: etc ? 'ETC' : REPORT_REASON_CODE[picked] ?? 'ETC', detail: etc ? picked.slice(3).trim() : null }
}

export const real = {
  /** GET /posts — 목록 (번호 페이지, 20개) */
  list: (q: PostListQuery, signal?: AbortSignal) => http.get<PageDto<PostListItemDto>>('/posts', { ...q }, signal),
  /** GET /posts/{id} — 상세 (삭제 404 POST_DELETED, 가려진 남의 글 403 POST_HIDDEN) */
  get: (id: Id, signal?: AbortSignal) => http.get<PostDetailDto>(`/posts/${id}`, undefined, signal),
  /** POST /posts/{id}/views — 조회수 (상세를 열 때 한 번. 같은 사람 중복은 서버가 거름) */
  view: (id: Id) => http.post<void>(`/posts/${id}/views`),
  /** GET /posts/{id}/comments — 댓글 (커서, 답글은 댓글 안에) */
  comments: (id: Id, cursor?: string | null, size = 20, signal?: AbortSignal) => http.get<CursorPageDto<CommentDto>>(`/posts/${id}/comments`, { cursor, size }, signal),
  create: (req: PostWriteRequest) => http.post<PostDetailDto>('/posts', req),
  update: (id: Id, req: PostWriteRequest) => http.put<PostDetailDto>(`/posts/${id}`, req),
  remove: (id: Id) => http.delete<void>(`/posts/${id}`),
  /** PUT·DELETE /posts/{id}/like (멱등) */
  setLike: (id: Id, on: boolean) => (on ? http.put<void>(`/posts/${id}/like`) : http.delete<void>(`/posts/${id}/like`)),
  /** PUT·DELETE /posts/{id}/bookmark (멱등) */
  setBookmark: (id: Id, on: boolean) => (on ? http.put<void>(`/posts/${id}/bookmark`) : http.delete<void>(`/posts/${id}/bookmark`)),
  report: (id: Id, reason: ReportReason, detail: string | null) => http.post<void>('/reports', { targetType: 'POST', targetId: id, reason, detail }),
  addComment: (postId: Id, w: CommentWrite) => http.post<CommentDto>(`/posts/${postId}/comments`, { content: w.content, parentId: w.parentId ?? null, mentionMemberId: w.mentionMemberId ?? null }),
  editComment: (postId: Id, commentId: Id, content: string) => http.patch<CommentDto>(`/posts/${postId}/comments/${commentId}`, { content }),
  deleteComment: (postId: Id, commentId: Id) => http.delete<void>(`/posts/${postId}/comments/${commentId}`),
  setCommentLike: (postId: Id, commentId: Id, on: boolean) => (on ? http.put<void>(`/posts/${postId}/comments/${commentId}/like`) : http.delete<void>(`/posts/${postId}/comments/${commentId}/like`)),
  reportComment: (commentId: Id, reason: ReportReason, detail: string | null) => http.post<void>('/reports', { targetType: 'COMMENT', targetId: commentId, reason, detail }),
  /** GET /posts/hot — 이번 주 인기 글 5 */
  hot: (signal?: AbortSignal) => http.get<PostListItemDto[]>('/posts/hot', undefined, signal),
  /** GET /posts/hot-interests — 많이 이야기하는 관심사 8 */
  hotInterests: (signal?: AbortSignal) => http.get<string[]>('/posts/hot-interests', undefined, signal),
  /** GET /me/board-activity — 내 활동 수 */
  activity: (signal?: AbortSignal) => http.get<BoardActivityDto>('/me/board-activity', undefined, signal),
  /** POST /reports — 아무 대상 신고 (대상마다 한 번, 409 ALREADY_REPORTED) */
  createReport: (req: ReportRequest) => http.post<void>('/reports', req),
}
export type CommunityApi = typeof real
