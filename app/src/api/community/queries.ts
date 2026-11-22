/**
 * 08 커뮤니티 — TanStack Query 훅 · 캐시 키 · 쓰기 훅. 화면(screens/board)은 여기와 ./mappers 의 모양만 쓴다.
 * 좋아요 · 저장 · 댓글 좋아요 · 댓글 수정은 낙관적(먼저 바꾸고 실패하면 되돌림 + 오류 토스트), 나머지 쓰기는 서버 답을 받고 캐시를 고친다.
 */
import { useEffect, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { isApiError } from '../client'
import { toAppId, toDtoId } from '../common/ids'
import { patch, toastApiError, useOptimistic, type CachePatch } from '../optimistic'
import { useMockStoreSync } from '../storeSync'
import { usePosts } from '../../data/boardStore'
import type { PostCategory } from '../../data/types'
import { communityApi } from './api'
import { COMMUNITY_ERRORS } from './errors'
import {
  POST_CATEGORY_CODE, POST_SORT_CODE, interestCategoryIdOf, toCommentThread, toHighlights, toLinkedMeetup, toMyPostCard, toMySummary,
  toPostCard, toPostDetail, toPostWriteRequest, toComment,
  type CommentThreadVM, type CommentVM, type MyPostCardVM, type PostCardVM, type PostDetailVM, type PostFormValue, type PostSortLabel,
} from './mappers'
import { reportBody } from './real'
import type { CommentUpdatedDto, LikeStateDto, MyPostsTab, ReportTargetType } from './types'

/* ===== 캐시 키 (첫 칸 'community') ===== */
/** 목록 화면의 거르기 (앱 모양) */
export interface PostListParams {
  category?: PostCategory
  mineOnly?: boolean
  /** 관심사 대분류 이름 */
  interest?: string | null
  keyword?: string
  sort?: PostSortLabel
  page?: number
  size?: number
}
export interface MyPostsParams { tab: MyPostsTab; category?: PostCategory; page?: number }

export const communityKeys = {
  all: ['community'] as const,
  lists: ['community', 'list'] as const,
  list: (q: PostListParams) => ['community', 'list', q] as const,
  highlights: ['community', 'highlights'] as const,
  detail: (id: string) => ['community', 'detail', id] as const,
  comments: (id: string) => ['community', 'comments', id] as const,
  related: (id: string) => ['community', 'related', id] as const,
  me: ['community', 'me'] as const,
  myPostsAll: ['community', 'me', 'posts'] as const,
  myPosts: (q: MyPostsParams) => ['community', 'me', 'posts', q] as const,
  summary: ['community', 'me', 'summary'] as const,
  linkable: (category: PostCategory | null) => ['community', 'me', 'linkable', category] as const,
}

/** 한 페이지 글 수 (명세 20) · 댓글 한 번에 (명세 10) */
export const POST_PAGE_SIZE = 20
export const COMMENT_PAGE_SIZE = 10

/* ===== 읽기 ===== */
/** GET /posts — 목록 (거르기 · 정렬 · 페이지는 서버가) */
export function usePostList(q: PostListParams, enabled = true) {
  return useQuery({
    queryKey: communityKeys.list(q),
    queryFn: async ({ signal }) => {
      const interestId = q.interest ? interestCategoryIdOf(q.interest) : undefined
      const d = await communityApi.list({
        category: q.category ? POST_CATEGORY_CODE[q.category] : undefined, isMyInterestsOnly: q.mineOnly || undefined,
        interestCategoryId: interestId, keyword: q.keyword?.trim() || undefined, sort: q.sort ? POST_SORT_CODE[q.sort] : undefined,
        page: q.page, size: q.size ?? POST_PAGE_SIZE,
      }, signal)
      return { ...d, items: d.items.map(toPostCard) }
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}
/** GET /posts/highlights — 이번 주 인기 글 · 많이 이야기하는 관심사 */
export function usePostHighlights() {
  return useQuery({ queryKey: communityKeys.highlights, queryFn: async ({ signal }) => toHighlights(await communityApi.highlights(signal)) })
}
/** GET /me/posts/summary — 내 활동 개수 */
export function useMyPostsSummary() {
  return useQuery({ queryKey: communityKeys.summary, queryFn: async ({ signal }) => toMySummary(await communityApi.myPostsSummary(signal)) })
}
/** GET /me/posts — 내가 쓴 글 · 댓글 단 글 · 저장한 글 */
export function useMyPosts(q: MyPostsParams) {
  return useQuery({
    queryKey: communityKeys.myPosts(q),
    queryFn: async ({ signal }) => {
      const d = await communityApi.myPosts({ tab: q.tab, category: q.category ? POST_CATEGORY_CODE[q.category] : undefined, page: q.page, size: POST_PAGE_SIZE }, signal)
      return { ...d, items: d.items.map(toMyPostCard) }
    },
    placeholderData: keepPreviousData,
  })
}
/** GET /posts/{postId} — 글 상세 · 글 수정 화면 */
export function usePostDetail(id: string) {
  return useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: async ({ signal }) => toPostDetail(await communityApi.get(toDtoId(id), signal)),
    // 없는 글 · 가려진 글(404)은 다시 시도해도 같음
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 2,
  })
}
/** GET /posts/{postId}/related-posts — 다음 읽을 글 3개 (실패하면 그 칸만 안 보임) */
export function useRelatedPosts(id: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.related(id),
    queryFn: async ({ signal }) => (await communityApi.related(toDtoId(id), signal)).items.map(toPostCard),
    enabled,
  })
}
type CommentPage = { items: CommentThreadVM[]; nextCursor: string | null; hasNext: boolean }
type CommentData = InfiniteData<CommentPage, string | null>
/** GET /posts/{postId}/comments — 댓글 10개씩 ("댓글 10개 더 보기" = fetchNextPage) */
export function useComments(postId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: communityKeys.comments(postId),
    queryFn: async ({ pageParam, signal }): Promise<CommentPage> => {
      const d = await communityApi.comments(toDtoId(postId), { cursor: pageParam, size: COMMENT_PAGE_SIZE }, signal)
      return { ...d, items: d.items.map(toCommentThread) }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
    enabled,
  })
}
/** 받은 댓글 페이지들을 한 줄로 (쓴 뒤 끝에 붙인 댓글이 다음 페이지에도 오면 한 번만) */
export function flattenComments(d: { pages: CommentPage[] } | undefined): CommentThreadVM[] {
  const seen = new Set<string>()
  const out: CommentThreadVM[] = []
  for (const pg of d?.pages ?? []) for (const c of pg.items) if (!seen.has(c.id)) { seen.add(c.id); out.push(c) }
  return out
}
/** GET /me/linkable-meetups — 글 카테고리에 연결할 수 있는 내 모임 (카테고리를 고르기 전에는 안 부름) */
export function useLinkableMeetups(category: PostCategory | null) {
  return useQuery({
    queryKey: communityKeys.linkable(category),
    queryFn: async ({ signal }) => (await communityApi.linkableMeetups(POST_CATEGORY_CODE[category!], signal)).items.map(toLinkedMeetup),
    enabled: !!category,
  })
}

/** POST /posts/{postId}/views — 글 상세를 열 때 한 번 (StrictMode 의 두 번 실행은 한 번으로). 올린 뒤의 조회수 */
let lastView = { id: '', t: 0 }
export function usePostView(id: string) {
  const qc = useQueryClient()
  const [views, setViews] = useState<number | null>(null)
  useEffect(() => {
    if (!id || (lastView.id === id && Date.now() - lastView.t < 1000)) return
    lastView = { id, t: Date.now() }
    communityApi.view(toDtoId(id)).then((r) => {
      setViews(r.viewCount)
      qc.setQueryData<PostDetailVM>(communityKeys.detail(id), (o) => (o ? { ...o, views: Math.max(o.views, r.viewCount) } : o))
    }).catch(() => { /* 조회수는 실패해도 화면에 알리지 않음 */ })
  }, [id, qc])
  return views
}

/* ===== 캐시 고치기 도우미 ===== */
type Page<T> = { items: T[] }
/**
 * 글 하나가 보이는 모든 곳(목록 · 내 활동 · 다음 읽을 글 · 상세)의 캐시를 같이 바꿈.
 * 키가 겹치는 patch 를 두 번 주면 되돌릴 때 순서가 꼬이므로 곳마다 하나씩만 (dropMine: 내 활동 목록에서 그 글을 뺄 줄 고르기)
 */
function postPatches(id: string, card: (c: PostCardVM) => PostCardVM, detail?: (d: PostDetailVM) => PostDetailVM, dropMine?: (c: MyPostCardVM) => boolean): CachePatch[] {
  const inPage = <T extends PostCardVM>(o: Page<T>) => ({ ...o, items: o.items.map((x) => (x.id === id ? (card(x) as T) : x)) })
  const inMine = (o: Page<MyPostCardVM> & { totalItems?: number }) => {
    const gone = dropMine ? o.items.filter((x) => x.id === id && dropMine(x)).length : 0
    const next = inPage(o)
    return gone ? { ...next, items: next.items.filter((x) => x.id !== id), totalItems: Math.max(0, (o.totalItems ?? 0) - gone) } : next
  }
  return [
    patch<Page<PostCardVM>>(communityKeys.lists, inPage),
    patch<Page<MyPostCardVM>>(communityKeys.myPostsAll, inMine),
    patch<PostCardVM[]>(communityKeys.related(id).slice(0, 2), (l) => (Array.isArray(l) ? l.map((x) => (x.id === id ? card(x) : x)) : l)),
    ...(detail ? [patch<PostDetailVM>(communityKeys.detail(id), detail)] : []),
  ]
}
/** 댓글 캐시(여러 페이지)에서 댓글 · 답글 하나 바꾸기. f 가 null 을 주면 뺌 */
function mapCommentData(d: CommentData, cid: string, f: (c: CommentVM) => CommentVM | null): CommentData {
  const one = <T extends CommentVM>(c: T): T | null => (c.id === cid ? (f(c) as T | null) : c)
  return {
    ...d,
    pages: d.pages.map((pg) => ({
      ...pg,
      items: pg.items.map((t) => { const top = one(t); return top ? { ...top, replies: top.replies.map(one).filter((r): r is CommentVM => !!r) } : null })
        .filter((t): t is CommentThreadVM => !!t),
    })),
  }
}

/* ===== 쓰기 ===== */
/** 글 · 댓글에서 쓰는 쓰기 모음. 완료 토스트는 화면이 onDone 등으로 띄움 */
export function usePostActions(postId: string) {
  const qc = useQueryClient()
  const run = useOptimistic()
  const dto = toDtoId(postId)
  const detailKey = communityKeys.detail(postId)
  const commentsKey = communityKeys.comments(postId)
  const setDetail = (f: (d: PostDetailVM) => PostDetailVM) => qc.setQueryData<PostDetailVM>(detailKey, (o) => (o ? f(o) : o))
  const setComments = (f: (d: CommentData) => CommentData) => qc.setQueryData<CommentData>(commentsKey, (o) => (o ? f(o) : o))
  const afterMine = () => { void qc.invalidateQueries({ queryKey: communityKeys.me }) }

  /** 댓글 · 답글 쓰기: 서버가 만든 댓글을 받아 끝에 붙임 (답글이면 parentCommentId 의 답글 끝) */
  const addComment = useMutation({
    mutationFn: (v: { content: string; replyTo: string | null }) => communityApi.addComment(dto, { content: v.content, replyToCommentId: v.replyTo ? toDtoId(v.replyTo) : null }),
    onSuccess: (r) => {
      const made = toComment(r)
      const parent = r.parentCommentId == null ? null : toAppId(r.parentCommentId)
      setComments((d) => {
        if (parent == null) {
          const pages = [...d.pages]
          const last = pages[pages.length - 1]
          pages[pages.length - 1] = { ...last, items: [...last.items, { ...made, replies: [] }] }
          return { ...d, pages }
        }
        return { ...d, pages: d.pages.map((pg) => ({ ...pg, items: pg.items.map((t) => (t.id === parent ? { ...t, replies: [...t.replies, made] } : t)) })) }
      })
      setDetail((o) => ({ ...o, comments: r.commentCount }))
      afterMine()
    },
    onError: (e) => toastApiError(e, '댓글을 등록하지 못했어요', COMMUNITY_ERRORS),
  })
  /** 댓글 지우기 (확인 팝업 뒤). 답글이 달린 댓글이면 답글도 */
  const deleteComment = useMutation({
    mutationFn: (cid: string) => communityApi.deleteComment(toDtoId(cid)),
    onSuccess: (r, cid) => { setComments((d) => mapCommentData(d, cid, () => null)); setDetail((o) => ({ ...o, comments: r.commentCount })); afterMine() },
    onError: (e) => toastApiError(e, '댓글을 삭제하지 못했어요', COMMUNITY_ERRORS),
  })
  /** 글 지우기 */
  const removePost = useMutation({
    mutationFn: () => communityApi.remove(dto),
    // 화면이 곧 목록으로 가므로 상세는 다시 받지 않음 (지운 글을 다시 받으면 404)
    onSuccess: () => { void qc.invalidateQueries({ queryKey: communityKeys.all, predicate: (q) => q.queryKey[1] !== 'detail' && q.queryKey[1] !== 'comments' }) },
    onError: (e) => toastApiError(e, '게시물을 삭제하지 못했어요', COMMUNITY_ERRORS),
  })

  return {
    addComment,
    deleteComment,
    removePost,
    /** 글 좋아요 (PUT · DELETE /like) */
    setLike: (on: boolean) => run.mutate({
      call: () => communityApi.setLike(dto, on), errors: COMMUNITY_ERRORS, errorTitle: '좋아요를 반영하지 못했어요', invalidate: [],
      patches: [patch<PostDetailVM>(detailKey, (o) => ({ ...o, liked: on, likes: Math.max(0, o.likes + (on ? 1 : -1)) }))],
    }, { onSuccess: (r) => { const x = r as LikeStateDto; setDetail((o) => ({ ...o, liked: x.isLiked, likes: x.likeCount })) } }),
    /** 댓글 고치기: 그 자리에서 바로 바꾸고 실패하면 되돌림 */
    editComment: (cid: string, content: string) => run.mutate({
      call: () => communityApi.editComment(toDtoId(cid), { content }), errors: COMMUNITY_ERRORS, errorTitle: '댓글을 고치지 못했어요', invalidate: [communityKeys.me],
      patches: [patch<CommentData>(commentsKey, (d) => mapCommentData(d, cid, (c) => ({ ...c, content, edited: true })))],
    }, { onSuccess: (r) => { const x = r as CommentUpdatedDto; setComments((d) => mapCommentData(d, cid, (c) => ({ ...c, content: x.content, edited: x.isEdited }))) } }),
    /** 댓글 좋아요 */
    setCommentLike: (c: CommentVM, on: boolean) => run.mutate({
      call: () => communityApi.setCommentLike(toDtoId(c.id), on), errors: COMMUNITY_ERRORS, errorTitle: '좋아요를 반영하지 못했어요', invalidate: [],
      patches: [patch<CommentData>(commentsKey, (d) => mapCommentData(d, c.id, (x) => ({ ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) })))],
    }, { onSuccess: (r) => { const y = r as LikeStateDto; setComments((d) => mapCommentData(d, c.id, (x) => ({ ...x, liked: y.isLiked, likes: y.likeCount }))) } }),
  }
}
/**
 * 저장(북마크) 켜고 끄기: 글이 보이는 모든 캐시를 먼저 바꾸고 실패하면 되돌림. 저장한 글 목록에서 끄면 그 목록에서 바로 뺌
 * onFail: 화면이 먼저 띄운 완료 토스트를 거둘 때
 */
export function useBookmark() {
  const run = useOptimistic()
  return (id: string, on: boolean, onFail?: () => void) => run.mutate({
    call: () => communityApi.setBookmark(toDtoId(id), on), errors: COMMUNITY_ERRORS, errorTitle: on ? '글을 저장하지 못했어요' : '저장을 취소하지 못했어요',
    invalidate: [communityKeys.me],
    patches: [
      // 저장한 글 목록(bookmarkedAt 이 있는 줄)에서 끄면 바로 빠짐 (08 저장한 글 4)
      ...postPatches(id, (c) => ({ ...c, bookmarked: on }), (d) => ({ ...d, bookmarked: on }), on ? undefined : (x) => x.bookmarkedAt != null),
      patch<{ mine: number; commented: number; saved: number }>(communityKeys.summary, (o) => ({ ...o, saved: Math.max(0, o.saved + (on ? 1 : -1)) })),
    ],
  }, { onError: () => onFail?.() })
}

/** 내 글 지우기 (내가 쓴 글 목록에서): 지운 뒤 그 목록에 머묾 */
export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => communityApi.remove(toDtoId(id)),
    onSuccess: (_r, id) => { qc.removeQueries({ queryKey: communityKeys.detail(id) }); void qc.invalidateQueries({ queryKey: communityKeys.all }) },
    onError: (e) => toastApiError(e, '게시물을 삭제하지 못했어요', COMMUNITY_ERRORS),
  })
}

/** 글쓰기 · 글 수정 (id 가 있으면 수정). 성공하면 글 id */
export function useSavePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, value }: { id?: string; value: PostFormValue }) => {
      const req = toPostWriteRequest(value)
      if (id) { await communityApi.update(toDtoId(id), req); return id }
      return toAppId((await communityApi.create(req)).postId)
    },
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: communityKeys.all }); return id },
  })
}
/** 사진 한 장 올리기 (POST /images) → { id, url } */
/** 사진 한 장 올리기 (POST /images) → 앱 id · 주소. 글쓰기(useUploadImage)와 채팅 사진 첨부가 같이 씀 (명세: 파일 올리기는 08 이 맡음) */
export const uploadImage = async (file: File) => { const r = await communityApi.uploadImage(file); return { id: toAppId(r.imageId), url: r.url } }
export function useUploadImage() {
  return useMutation({ mutationFn: uploadImage })
}

/**
 * 신고 (POST /reports) — 글 · 댓글 · 사용자 · 방명록 글 모두. picked 는 ReportDialog 가 준 사유 ("기타: …" 포함).
 * 이미 신고했으면(ALREADY_REPORTED) 오류 대신 onAlready 로 알림 ("이미 신고했어요"). 다른 영역도 이 훅을 쓰면 된다
 */
export function useReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { type: ReportTargetType; id: string; picked: string; onAlready?: () => void }) => communityApi.createReport(reportBody(v.type, v.id, v.picked)),
    onError: (e, v) => {
      if (isApiError(e) && e.code === 'ALREADY_REPORTED' && v.onAlready) { v.onAlready(); return }
      toastApiError(e, '신고를 접수하지 못했어요', COMMUNITY_ERRORS)
    },
    onSettled: (_r, _e, v) => {
      if (v.type === 'POST' || v.type === 'COMMENT') void qc.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/** 목 모드: 게시판 저장소가 바뀌면 커뮤니티 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useCommunityMockSync() { useMockStoreSync('community', usePosts(), communityKeys.all) }
