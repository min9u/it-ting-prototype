/**
 * 커뮤니티 (F8). 계약: docs/backend/api-draft.md "커뮤니티"
 * 목 구현은 data/boardStore.ts 를 가짜 서버로 씀 (거르기·정렬·페이지·이전/다음 글도 여기서 = 서버가 할 일, 위험 B8)
 */
import { API_MODE } from './config'
import { ApiError, http } from './client'
import { conflict, cursorPage, emptyCursor, emptyPage, mockRead, mockWrite, notFound, paginate } from './mock/server'
import { commentDto, postDetail, postListItem } from './mock/serialize'
import { POST_CATEGORY, toPhoto } from './mappers'
import {
  addComment, addReply, commentCount, createPost, deleteComment, deletePost, editComment, getPost, hotInterests, hotPosts, isListed, isMine,
  myActivity, myBigInterests, nickOf, reportComment, reportPost, scoreOf, toggleCommentLike, toggleLike, toggleSave, updatePost,
  viewPost, getPosts, type BoardPost,
} from '../data/boardStore'
import type { BoardActivityDto, CommentDto, CursorPageDto, Id, PageDto, PostDetailDto, PostListItemDto, PostListQuery, PostWriteRequest, ReportReason } from './types'

export interface CommentWrite { content: string; parentId?: Id | null; mentionMemberId?: Id | null; mentionNickname?: string | null }

const real = {
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
}
export type BoardApi = typeof real

/* ===== 목 서버 ===== */
const SORTS: Record<NonNullable<PostListQuery['sort']>, (a: BoardPost, b: BoardPost) => number> = {
  LATEST: (a, b) => b.at - a.at,
  POPULAR: (a, b) => scoreOf(b) - scoreOf(a) || b.at - a.at,
  COMMENTS: (a, b) => commentCount(b) - commentCount(a) || b.at - a.at,
}
function visiblePost(id: Id) {
  const p = getPost(id)
  if (!p) throw notFound('글')
  if (p.status === 'deleted') throw new ApiError(404, 'POST_DELETED', '삭제된 글이에요.')
  if (p.status === 'hidden' && !isMine(p)) throw new ApiError(403, 'POST_HIDDEN', '신고로 가려진 글이에요.')
  return p
}
const findComment = (p: BoardPost, id: Id) => p.comments.flatMap((c) => [c, ...c.replies]).find((c) => c.id === id)

const mock: BoardApi = {
  list: (q, signal) => mockRead(() => {
    const posts = getPosts()
    const word = q.q?.trim().toLowerCase()
    const myBig = q.mine ? myBigInterests() : []
    let l = posts.filter(isListed)
      .filter((p) => !q.category || p.category === POST_CATEGORY[q.category])
      .filter((p) => !q.mine || p.interests.some((t) => myBig.includes(t)))
      .filter((p) => !q.interest || p.interests.includes(q.interest))
    if (word) l = l.filter((p) => [p.title, p.body, nickOf(p.authorId)].some((x) => x.toLowerCase().includes(word)))
    l = [...l].sort(SORTS[q.sort ?? 'LATEST'])
    const page = paginate(l, q.page, q.size ?? 20)
    return { ...page, items: page.items.map(postListItem) }
  }, { signal, empty: () => emptyPage(q.size ?? 20) }),
  get: (id, signal) => mockRead(() => {
    const p = visiblePost(id)
    const listed = getPosts().filter(isListed).sort((a, b) => b.at - a.at)
    const i = listed.findIndex((x) => x.id === id)
    return postDetail(p, i > 0 ? listed[i - 1].id : null, i >= 0 && i < listed.length - 1 ? listed[i + 1].id : null)
  }, { signal, detail: true }),
  view: (id) => mockWrite(() => viewPost(id)),
  comments: (id, cursor, size = 20, signal) => mockRead(() => {
    const p = visiblePost(id)
    return cursorPage(p.comments.filter((c) => c.status !== 'deleted').map((c) => commentDto(c, p.id, null)), cursor, size)
  }, { signal, empty: () => emptyCursor() }),
  create: (req) => mockWrite(() => {
    const id = createPost({ category: POST_CATEGORY[req.category], title: req.title, body: req.content, interests: req.interests, photos: req.imageUrls.map(toPhoto), meetupId: req.meetupId ?? undefined })
    return postDetail(getPost(id)!, null, null)
  }),
  update: (id, req) => mockWrite(() => {
    const p = visiblePost(id)
    if (!isMine(p)) throw new ApiError(403, 'FORBIDDEN', '내 글만 고칠 수 있어요.')
    updatePost(id, { category: POST_CATEGORY[req.category], title: req.title, body: req.content, interests: req.interests, photos: req.imageUrls.map(toPhoto), meetupId: req.meetupId ?? undefined })
    return postDetail(getPost(id)!, null, null)
  }),
  remove: (id) => mockWrite(() => { const p = getPost(id); if (!p || p.status === 'deleted') throw notFound('글'); deletePost(id) }),
  setLike: (id, on) => mockWrite(() => { const p = visiblePost(id); if (!!p.liked !== on) toggleLike(id) }),
  setBookmark: (id, on) => mockWrite(() => { const p = visiblePost(id); if (!!p.savedAt !== on) toggleSave(id) }),
  report: (id) => mockWrite(() => { if (!reportPost(id)) throw conflict('ALREADY_REPORTED', '이미 신고한 글이에요.') }),
  addComment: (postId, w) => mockWrite(() => {
    visiblePost(postId)
    if (w.parentId) addReply(postId, w.parentId, w.content, w.mentionNickname ?? undefined)
    else addComment(postId, w.content)
    const p = getPost(postId)!
    const parent = w.parentId ? p.comments.find((c) => c.id === w.parentId) : undefined
    const made = parent ? parent.replies[parent.replies.length - 1] : p.comments[p.comments.length - 1]
    return commentDto(made, postId, w.parentId ?? null)
  }),
  editComment: (postId, commentId, content) => mockWrite(() => {
    editComment(postId, commentId, content)
    const c = findComment(visiblePost(postId), commentId)
    if (!c) throw notFound('댓글')
    return commentDto(c, postId, null)
  }),
  deleteComment: (postId, commentId) => mockWrite(() => deleteComment(postId, commentId)),
  setCommentLike: (postId, commentId, on) => mockWrite(() => { const c = findComment(visiblePost(postId), commentId); if (c && !!c.liked !== on) toggleCommentLike(postId, commentId) }),
  reportComment: (commentId) => mockWrite(() => {
    const p = getPosts().find((x) => findComment(x, commentId))
    if (!p || !reportComment(p.id, commentId)) throw conflict('ALREADY_REPORTED', '이미 신고한 댓글이에요.')
  }),
  hot: (signal) => mockRead(() => hotPosts(getPosts()).map(postListItem), { signal, empty: () => [] }),
  hotInterests: (signal) => mockRead(() => hotInterests(getPosts()), { signal, empty: () => [] }),
  activity: (signal) => mockRead(() => { const a = myActivity(getPosts()); return { postCount: a.mine, commentedPostCount: a.commented, bookmarkCount: a.saved } }, { signal }),
}

export const board: BoardApi = API_MODE === 'real' ? real : mock
