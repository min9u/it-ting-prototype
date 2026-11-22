/**
 * 08 커뮤니티 — 목 서버. data/boardStore.ts 를 가짜 DB 로 씀 (거르기·정렬·페이지·이전/다음 글도 여기서 = 서버가 할 일, 위험 B8)
 * 위쪽 "직렬화"는 저장소 값 → DTO
 */
import { ApiError } from '../client'
import { conflict, cursorPage, emptyCursor, emptyPage, mockRead, mockWrite, notFound, paginate } from '../mock/server'
import { memberSummary } from '../common/mockPeople'
import { meetupCard } from '../meetups/mock'
import { USERS } from '../../data/mock'
import { findMeetup } from '../../data/meetupStore'
import {
  addComment, addReply, commentCount, createPost, deleteComment, deletePost, editComment, getPost, hotInterests, hotPosts, isListed, isMine,
  likesOf, myActivity, myBigInterests, nickOf, reportComment, reportPost, savesOf, scoreOf, toggleCommentLike, toggleLike, toggleSave, updatePost,
  viewPost, getPosts, type BoardComment, type BoardPhoto, type BoardPost,
} from '../../data/boardStore'
import type { PostCategory } from '../../data/types'
import { toIso } from '../../lib/time'
import { POST_CATEGORY, toPhoto } from './mappers'
import type { CommunityApi } from './real'
import type { CommentDto, ContentStatus, PostCategoryCode, PostDetailDto, PostListItemDto, PostListQuery } from './types'

/* ===== 직렬화 (저장소 → DTO) ===== */
export const POST_CAT_CODE: Record<PostCategory, PostCategoryCode> = { '모임 홍보': 'MEETUP_PROMO', '모임 후기': 'MEETUP_REVIEW', 자유: 'FREE' }
const STATUS: Record<string, ContentStatus> = { public: 'PUBLIC', hidden: 'HIDDEN', deleted: 'DELETED' }
/** 목 사진은 색 칸뿐이라 "tone:<색>" 주소로 (실제 서버는 이미지 URL) */
export const photoUrl = (ph: BoardPhoto) => ph.url ?? `tone:${ph.tone}`
export function postListItem(p: BoardPost): PostListItemDto {
  return {
    id: p.id, category: POST_CAT_CODE[p.category], title: p.title, excerpt: p.body.replace(/\n+/g, ' ').slice(0, 160),
    author: memberSummary(p.authorId), interests: p.interests,
    thumbnailUrl: p.photos[0] ? photoUrl(p.photos[0]) : null, imageCount: p.photos.length,
    viewCount: p.views, likeCount: likesOf(p), commentCount: commentCount(p), bookmarkCount: savesOf(p),
    liked: !!p.liked, bookmarkedAt: p.savedAt ? toIso(p.savedAt) : null, status: STATUS[p.status], reportedByMe: !!p.reportedByMe,
    createdAt: toIso(p.at), editedAt: p.editedAt ? toIso(p.editedAt) : null,
  }
}
export function postDetail(p: BoardPost, prevId: string | null, nextId: string | null): PostDetailDto {
  const mt = p.meetupId ? findMeetup(p.meetupId) : undefined
  return {
    ...postListItem(p), content: p.body,
    images: p.photos.map((ph, i) => ({ id: `${p.id}-img${i + 1}`, sortOrder: i, url: photoUrl(ph) })),
    meetup: mt ? meetupCard(mt) : null, prevId, nextId,
  }
}
const nickToId = (nick: string) => Object.values(USERS).find((u) => u.nickname === nick)?.id ?? ''
export function commentDto(c: BoardComment, postId: string, parentId: string | null): CommentDto {
  return {
    id: c.id, postId, parentId, author: memberSummary(c.authorId),
    mention: c.mention ? { memberId: nickToId(c.mention), nickname: c.mention } : null,
    // 가려진 댓글은 본문을 보내지 않음 (신고 3명)
    content: c.status === 'hidden' ? '' : c.text, status: STATUS[c.status],
    likeCount: c.likes + (c.liked ? 1 : 0), liked: !!c.liked, reportedByMe: !!c.reportedByMe,
    createdAt: toIso(c.at), editedAt: c.editedAt ? toIso(c.editedAt) : null,
    replies: c.replies.map((r) => commentDto(r, postId, c.id)),
  }
}

/* ===== 목 서버 ===== */
const SORTS: Record<NonNullable<PostListQuery['sort']>, (a: BoardPost, b: BoardPost) => number> = {
  LATEST: (a, b) => b.at - a.at,
  POPULAR: (a, b) => scoreOf(b) - scoreOf(a) || b.at - a.at,
  COMMENTS: (a, b) => commentCount(b) - commentCount(a) || b.at - a.at,
}
const postNotFound = () => notFound('POST', '글을 찾을 수 없습니다.')
function visiblePost(id: string) {
  const p = getPost(id)
  if (!p) throw postNotFound()
  if (p.status === 'deleted') throw new ApiError(404, 'POST_DELETED', '삭제된 글이에요.')
  if (p.status === 'hidden' && !isMine(p)) throw new ApiError(403, 'POST_HIDDEN', '신고로 가려진 글이에요.')
  return p
}
const findComment = (p: BoardPost, id: string) => p.comments.flatMap((c) => [c, ...c.replies]).find((c) => c.id === id)

export const mock: CommunityApi = {
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
  }, { signal, detail: 'POST' }),
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
  remove: (id) => mockWrite(() => { const p = getPost(id); if (!p || p.status === 'deleted') throw postNotFound(); deletePost(id) }),
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
    if (!c) throw notFound('COMMENT', '댓글을 찾을 수 없습니다.')
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
  // 대상별 신고 기록은 각 저장소(boardStore.reportPost · meetupStore.report …)가 하고, 여기서는 받기만
  createReport: () => mockWrite(() => undefined),
}
