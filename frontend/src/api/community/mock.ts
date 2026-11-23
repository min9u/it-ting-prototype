/**
 * 08 커뮤니티 — 목 서버. data/boardStore.ts 를 가짜 DB 로 쓴다 (거르기 · 정렬 · 페이지 · 검사 · 에러 코드도 여기서 = 서버가 할 일).
 * 명세: docs/backend/team-spec/api/08-community.md. 위쪽 "직렬화"는 저장소 값 → DTO
 *
 * id: 저장소 id('p1' · 'c3' · 'm4' · 'outdoor')는 toDtoId 로 숫자가 되고, 받은 숫자는 toAppId 로 되돌린다 (common/ids.ts)
 */
import { ApiError } from '../client'
import { cursorPage, emptyCursor, emptyPage, forbidden, invalidInput, items, mockRead, mockWrite, notFound, paginate, conflict } from '../mock/server'
import { rawPerson, userDisplay, interestTags } from '../common/mockPeople'
import { toAppId, toDtoId } from '../common/ids'
import { categoryCodeOfSeed, categorySeedId } from '../mock/seedIds'
import type { Id } from '../common/types'
import { CATEGORIES, ME_ID, USERS } from '../../data/mock'
import { meetupCategoryOf } from '../../data/meetupCategory'
import { confirmedOf, findMeetup, getMeetupState, myOf, parseHour, recruitOf, startMs, type MeetupX } from '../../data/meetupStore'
import {
  addCommentBy, likeBy,
  addComment, addReply, claimImage, commentCount, createPost, deleteComment, deletePost, editComment, findComment, getPost, getPosts,
  hotInterests, hotPosts, isListed, isMine, likesOf, myActivity, myBigInterests, myCommentsOn, nickOf, registerImage, reportComment,
  reportOther, reportPost, scoreOf, setCommentLike, setLike, setSave, updatePost, uploadedImage, viewPost,
  type BoardComment, type BoardPhoto, type BoardPost, type PostDraft,
} from '../../data/boardStore'
import type { PostCategory } from '../../data/types'
import { toIso } from '../../lib/time'
import { COMMENT_MAX, POST_BODY_MAX, POST_TITLE_MAX } from '../../lib/validation'
import { notifyMockUser } from '../notifications/mock'
import type { CommunityApi } from './real'
import type {
  CommentDto, CommentThreadDto, InterestCategoryRefDto, MyPostCardDto, MyPostsTab, PostCardDto, PostCategoryCode, PostDetailDto,
  PostListQuery, PostMeetupCardDto, PostSort, PostWriteRequest, ReportRequest, ReportTargetType,
} from './types'

/* ===== 직렬화 (저장소 → DTO) ===== */
const CAT_CODE: Record<PostCategory, PostCategoryCode> = { '모임 홍보': 'PROMOTION', '모임 후기': 'REVIEW', 자유: 'FREE' }
const CAT_NAME: Record<PostCategoryCode, PostCategory> = { PROMOTION: '모임 홍보', REVIEW: '모임 후기', FREE: '자유' }
const HOUR = 3_600_000

/** 목 사진은 대개 색 칸뿐이라 "tone:<색>" 주소로 (올린 사진은 object URL). 실제 서버는 이미지 URL */
export const photoUrl = (ph: BoardPhoto) => ph.url ?? `tone:${ph.tone}`
/** 관심사 대분류 이름 → { id, name } (id 는 백엔드 처음 값과 같은 번호, api/mock/seedIds) */
const catRef = (name: string): InterestCategoryRefDto => ({ id: categorySeedId(CATEGORIES.find((c) => c.name === name)?.id ?? name), name })
/** 받은 대분류 id → 이름 (없는 id 면 undefined) */
const catNameOf = (id: Id) => { const code = categoryCodeOfSeed(id); return CATEGORIES.find((c) => c.id === code)?.name }

export function postCard(p: BoardPost, opts: { hiddenVisible?: boolean } = {}): PostCardDto {
  return {
    id: toDtoId(p.id), category: CAT_CODE[p.category], title: p.title, contentPreview: p.body.replace(/\n+/g, ' ').slice(0, 100),
    thumbnailUrl: p.photos[0] ? photoUrl(p.photos[0]) : null, author: userDisplay(p.authorId), interestCategories: p.interests.map(catRef),
    createdAt: toIso(p.at), viewCount: p.views, likeCount: likesOf(p), commentCount: commentCount(p), isBookmarked: !!p.savedAt,
    isHidden: !!opts.hiddenVisible && p.status === 'hidden', isReportedByMe: !!p.reportedByMe,
  }
}

/** '다음 날 오전 11:00' 이나 시작보다 이른 끝 시각은 다음 날 (모임 목 서버와 같은 셈) */
function endMs(m: MeetupX): number | null {
  if (!m.end) return null
  const next = /다음\s*날/.test(m.end) || parseHour(m.end) < parseHour(m.start)
  return startMs({ ...m, start: m.end }) + (next ? 24 * HOUR : 0)
}
const RECRUIT: Record<string, PostMeetupCardDto['recruitStatus']> = { open: 'OPEN', closed: 'CLOSED', past: 'PAST', cancelled: 'CANCELED' }
/** 07 모임 카드 (이 영역에 둔 사본) */
export function meetupCardOf(m: MeetupX): PostMeetupCardDto {
  const s = getMeetupState()
  const end = endMs(m)
  return {
    id: toDtoId(m.id), title: m.title, category: meetupCategoryOf(m.category)?.code ?? m.category,
    startsAt: toIso(startMs(m)), endsAt: end == null ? null : toIso(end), mode: m.mode === '온라인' ? 'ONLINE' : 'OFFLINE',
    place: m.mode === '온라인' ? null : m.place || null, capacity: m.capacity, confirmedCount: confirmedOf(m, s), recruitStatus: RECRUIT[recruitOf(m, s)],
  }
}

export function postDetail(p: BoardPost): PostDetailDto {
  const mt = p.meetupId ? findMeetup(p.meetupId) : undefined
  const mine = isMine(p)
  return {
    id: toDtoId(p.id), category: CAT_CODE[p.category], title: p.title, content: p.body,
    images: p.photos.map((ph, i) => ({ id: toDtoId(ph.id ?? `${p.id}-img${i + 1}`), url: photoUrl(ph) })),
    author: userDisplay(p.authorId), authorSharedInterests: mine ? [] : interestTags(p.authorId).filter((t) => t.isShared),
    interestCategories: p.interests.map(catRef), meetup: mt ? meetupCardOf(mt) : null, createdAt: toIso(p.at), isEdited: !!p.editedAt,
    viewCount: p.views, likeCount: likesOf(p), commentCount: commentCount(p), isLiked: !!p.liked, isBookmarked: !!p.savedAt,
    isMine: mine, isHidden: mine && p.status === 'hidden', isReportedByMe: !!p.reportedByMe, canEdit: mine && p.status === 'public',
  }
}

const userIdByNick = (nick: string) => Object.values(USERS).find((u) => u.nickname === nick)?.id
export function commentDto(c: BoardComment): CommentDto {
  const hidden = c.status === 'hidden'
  const mentionId = c.mention ? userIdByNick(c.mention) : undefined
  return {
    id: toDtoId(c.id), author: userDisplay(c.authorId),
    // 가려진 댓글은 본문을 보내지 않음 (서로 다른 3명 신고)
    content: hidden ? null : c.text,
    mentionUser: c.mention ? { id: toDtoId(mentionId ?? 'gone'), nickname: mentionId ? c.mention : null } : null,
    createdAt: toIso(c.at), isEdited: !!c.editedAt, likeCount: c.likes + (c.liked ? 1 : 0), isLiked: !!c.liked,
    isMine: c.authorId === ME_ID, isHidden: hidden, isReportedByMe: !!c.reportedByMe,
  }
}
const live = (c: BoardComment) => c.status !== 'deleted'
const thread = (c: BoardComment): CommentThreadDto => ({ ...commentDto(c), replies: c.replies.filter(live).map(commentDto) })

/* ===== 검사 (서버가 할 일) ===== */
const postNotFound = () => notFound('POST', '글을 찾을 수 없습니다.')
const postHidden = () => new ApiError(404, 'POST_HIDDEN', '신고로 가려진 글입니다.')
const commentNotFound = () => notFound('COMMENT', '댓글을 찾을 수 없습니다.')
/** 읽기: 없거나 삭제 → POST_NOT_FOUND, 가려진 남의 글 → POST_HIDDEN. 작성자는 가려진 글도 봄 */
function readablePost(id: Id) {
  const p = getPost(toAppId(id))
  if (!p || p.status === 'deleted') throw postNotFound()
  if (p.status === 'hidden' && !isMine(p)) throw postHidden()
  return p
}
/** 좋아요 · 저장 · 댓글 · 조회수: 공개 글만 (작성자가 불러도 같음) */
function publicPost(id: Id) {
  const p = getPost(toAppId(id))
  if (!p || p.status === 'deleted') throw postNotFound()
  if (p.status === 'hidden') throw postHidden()
  return p
}
const blank = (s: unknown) => typeof s !== 'string' || !s.trim()

/** 글쓰기 · 고치기 본문 검사 → 저장소 모양. editing 이면 그 글의 사진도 쓸 수 있음 */
function draftOf(req: PostWriteRequest, editing?: BoardPost): PostDraft {
  const bad: Record<string, string> = {}
  if (!CAT_NAME[req.category]) bad.category = '카테고리를 골라 주세요.'
  if (blank(req.title)) bad.title = '제목을 입력해 주세요.'
  else if (req.title.length > POST_TITLE_MAX) bad.title = `제목은 ${POST_TITLE_MAX}자를 넘을 수 없습니다.`
  if (blank(req.content)) bad.content = '본문을 입력해 주세요.'
  else if (req.content.length > POST_BODY_MAX) bad.content = `본문은 ${POST_BODY_MAX}자를 넘을 수 없습니다.`
  const ids = req.interestCategoryIds ?? []
  const names = ids.map(catNameOf)
  if (!Array.isArray(req.interestCategoryIds) || ids.length > 5 || new Set(ids).size !== ids.length || names.some((n) => !n)) bad.interestCategoryIds = '관심사는 겹치지 않게 5개까지 고를 수 있습니다.'
  const imgs = req.imageIds ?? []
  const photos = imgs.map((id) => {
    const app = toAppId(id)
    return editing?.photos.find((ph) => ph.id === app) ?? uploadedImage(app)
  })
  if (!Array.isArray(req.imageIds) || imgs.length > 3 || new Set(imgs).size !== imgs.length || photos.some((ph) => !ph)) bad.imageIds = '사진은 올린 것 가운데 3장까지 붙일 수 있습니다.'
  if ((req.category === 'PROMOTION' || req.category === 'REVIEW') && req.meetupId == null) bad.meetupId = '연결할 모임을 골라 주세요.'
  if (Object.keys(bad).length) throw invalidInput(bad)
  return {
    category: CAT_NAME[req.category], title: req.title.trim(), body: req.content.trim(), interests: names as string[],
    photos: photos as BoardPhoto[], meetupId: req.meetupId == null ? undefined : toAppId(req.meetupId),
  }
}

/* ===== 글에 연결하는 모임 (api 08 "글에 연결하는 모임") ===== */
/** 내가 열었거나 참여가 확정된 모임 */
const joinedOrHost = (m: MeetupX) => m.hostId === ME_ID || myOf(m.id)?.st === 'joined'
function linkable(cat: PostCategoryCode): MeetupX[] {
  const all = getMeetupState().list
  const r = (m: MeetupX) => recruitOf(m)
  if (cat === 'PROMOTION') return all.filter((m) => m.hostId === ME_ID && r(m) === 'open').sort((a, b) => startMs(a) - startMs(b))
  if (cat === 'REVIEW') return all.filter((m) => joinedOrHost(m) && r(m) === 'past').sort((a, b) => startMs(b) - startMs(a))
  return all.filter((m) => joinedOrHost(m) && r(m) !== 'cancelled').sort((a, b) => startMs(b) - startMs(a))
}
/** 모임 연결 검사: 없으면 MEETUP_NOT_FOUND, 그 카테고리에 고를 수 없으면 MEETUP_NOT_LINKABLE */
function checkMeetup(cat: PostCategoryCode, meetupId: string | undefined) {
  if (!meetupId) return
  if (!findMeetup(meetupId)) throw notFound('MEETUP', '모임을 찾을 수 없습니다.')
  if (!linkable(cat).some((m) => m.id === meetupId)) throw conflict('MEETUP_NOT_LINKABLE', '이 글에 연결할 수 없는 모임입니다.')
}

/* ===== 신고 대상 (다른 영역의 목이 끼울 수 있게) ===== */
/** 신고 대상 확인 결과: 받음 · 대상 없음 · 내 것 · 이미 신고 */
export type MockReportResult = 'ok' | 'missing' | 'own' | 'already'
type ReportHandler = (appId: string) => MockReportResult
const reportHandlers: Partial<Record<ReportTargetType, ReportHandler>> = {
  POST: (id) => {
    const p = getPost(id)
    if (!p || p.status !== 'public') return 'missing'
    if (isMine(p)) return 'own'
    return reportPost(id) ? 'ok' : 'already'
  },
  COMMENT: (id) => {
    const f = findComment(id)
    if (!f || f.comment.status !== 'public' || f.post.status === 'deleted') return 'missing'
    if (f.comment.authorId === ME_ID) return 'own'
    return reportComment(f.post.id, id) ? 'ok' : 'already'
  },
  MEMBER: (id) => {
    if (!rawPerson(id)) return 'missing'
    if (id === ME_ID) return 'own'
    return reportOther('MEMBER', id) ? 'ok' : 'already'
  },
  // 방명록 글은 data/guestbookStore → 04 내 땅굴 목(api/burrow/mock.ts)이 registerMockReportTarget('GUESTBOOK', …) 로 대상 확인 · 가림까지 끼움
  GUESTBOOK: (id) => (reportOther('GUESTBOOK', id) ? 'ok' : 'already'),
}
/** 다른 영역의 목 서버가 신고 대상을 확인 · 기록하는 함수를 끼운다 (예: 방명록 글은 탐색 목 서버) */
export function registerMockReportTarget(type: ReportTargetType, fn: ReportHandler) { reportHandlers[type] = fn }

function createReport(req: ReportRequest) {
  const bad: Record<string, string> = {}
  if (!reportHandlers[req.targetType]) bad.targetType = '신고할 수 없는 대상입니다.'
  if (typeof req.targetId !== 'number') bad.targetId = '대상을 골라 주세요.'
  if (!['SPAM', 'ABUSE', 'OBSCENE', 'ETC'].includes(req.reason)) bad.reason = '신고 사유를 골라 주세요.'
  if (req.reason === 'ETC' && (blank(req.detail) || (req.detail ?? '').length > 100)) bad.detail = '기타 사유를 100자 이내로 입력해 주세요.'
  if (Object.keys(bad).length) throw invalidInput(bad)
  const r = reportHandlers[req.targetType]!(toAppId(req.targetId))
  if (r === 'missing') throw notFound('REPORT_TARGET', '신고할 대상을 찾을 수 없습니다.')
  if (r === 'own') throw forbidden('내 것은 신고할 수 없습니다.', 'OWN_TARGET_NOT_ALLOWED')
  if (r === 'already') throw conflict('ALREADY_REPORTED', '이미 신고한 대상입니다.')
  return { reportId: toDtoId(`report-${req.targetType}-${toAppId(req.targetId)}`) }
}

/* ===== 목록 ===== */
const SORTS: Record<PostSort, (a: BoardPost, b: BoardPost) => number> = {
  LATEST: (a, b) => b.at - a.at,
  POPULAR: (a, b) => scoreOf(b) - scoreOf(a) || b.at - a.at,
  MOST_COMMENTED: (a, b) => commentCount(b) - commentCount(a) || b.at - a.at,
}
function listPosts(q: PostListQuery) {
  if (q.keyword && [...q.keyword.trim()].length > 50) throw invalidInput({ keyword: '검색어는 50자를 넘을 수 없습니다.' })
  const size = q.size ?? 20
  if (size < 1 || size > 50) throw invalidInput({ size: '1 ~ 50 사이로 보내 주세요.' })
  const word = q.keyword?.trim().toLowerCase()
  const myBig = q.isMyInterestsOnly ? myBigInterests() : []
  const interest = q.interestCategoryId != null ? catNameOf(q.interestCategoryId) ?? '\u0000' : null
  let l = getPosts().filter(isListed)
    .filter((p) => !q.category || p.category === CAT_NAME[q.category])
    .filter((p) => !q.isMyInterestsOnly || p.interests.some((t) => myBig.includes(t)))
    .filter((p) => !interest || p.interests.includes(interest))
  if (word) l = l.filter((p) => [p.title, p.body, nickOf(p.authorId)].some((x) => x.toLowerCase().includes(word)))
  l = [...l].sort(SORTS[q.sort ?? 'LATEST'])
  // 명세: 없는 페이지면 items 가 빈 목록 (paginate 는 가까운 쪽으로 당기므로 직접)
  const page = Math.max(1, q.page ?? 1)
  const totalPages = Math.max(1, Math.ceil(l.length / size))
  return { items: l.slice((page - 1) * size, page * size).map((p) => postCard(p)), page, size, totalItems: l.length, totalPages }
}

function myPosts(tab: MyPostsTab, category: PostCategoryCode | undefined, page = 1, size = 20) {
  if (!['WRITTEN', 'COMMENTED', 'BOOKMARKED'].includes(tab)) throw invalidInput({ tab: '탭을 골라 주세요.' })
  const all = getPosts()
  let l: BoardPost[]
  if (tab === 'WRITTEN') l = all.filter((p) => isMine(p) && p.status !== 'deleted').sort((a, b) => b.at - a.at)
  else if (tab === 'BOOKMARKED') l = all.filter((p) => isListed(p) && p.savedAt).sort((a, b) => b.savedAt! - a.savedAt!)
  else l = all.filter((p) => isListed(p) && myCommentsOn(p).length).sort((a, b) => myCommentsOn(b)[0].at - myCommentsOn(a)[0].at)
  l = l.filter((p) => !category || p.category === CAT_NAME[category])
  const pg = paginate(l, page, size)
  return {
    ...pg,
    items: pg.items.map((p): MyPostCardDto => {
      const mine = tab === 'COMMENTED' ? myCommentsOn(p) : []
      return {
        ...postCard(p, { hiddenVisible: tab === 'WRITTEN' }), canEdit: isMine(p) && p.status === 'public',
        bookmarkedAt: tab === 'BOOKMARKED' && p.savedAt ? toIso(p.savedAt) : null,
        myLatestComment: mine[0] ? { id: toDtoId(mine[0].id), content: mine[0].text } : null, myCommentCount: mine.length,
      }
    }),
  }
}

/* ===== 목 서버 ===== */
export const mock: CommunityApi = {
  list: (q, signal) => mockRead(() => listPosts(q), { signal, empty: () => emptyPage(q.size ?? 20) }),
  highlights: (signal) => mockRead(() => {
    const all = getPosts()
    return {
      weeklyTopPosts: hotPosts(all).map((p, i) => ({ rank: i + 1, id: toDtoId(p.id), category: CAT_CODE[p.category], title: p.title })),
      trendingInterestCategories: hotInterests(all).map(catRef),
    }
  }, { signal, empty: () => ({ weeklyTopPosts: [], trendingInterestCategories: [] }) }),
  create: (req) => mockWrite(() => {
    const d = draftOf(req)
    checkMeetup(req.category, d.meetupId)
    const id = createPost(d)
    for (const ph of d.photos) if (ph.id) claimImage(ph.id)
    return { postId: toDtoId(id) }
  }),
  get: (id, signal) => mockRead(() => postDetail(readablePost(id)), { signal, detail: 'POST' }),
  update: (id, req) => mockWrite(() => {
    const p = getPost(toAppId(id))
    if (!p || p.status === 'deleted') throw postNotFound()
    if (!isMine(p)) throw forbidden('내가 쓴 글만 고칠 수 있습니다.')
    if (p.status === 'hidden') throw conflict('POST_EDIT_NOT_ALLOWED', '신고로 가려진 글은 고칠 수 없습니다.')
    const d = draftOf(req, p)
    // 모임이나 카테고리를 바꿨을 때만 다시 검사 (안 바꿨으면 그사이 마감됐어도 그대로)
    if (d.meetupId !== p.meetupId || d.category !== p.category) checkMeetup(req.category, d.meetupId)
    updatePost(p.id, d)
    for (const ph of d.photos) if (ph.id) claimImage(ph.id)
    return null
  }),
  remove: (id) => mockWrite(() => {
    const p = getPost(toAppId(id))
    if (!p || p.status === 'deleted') throw postNotFound()
    if (!isMine(p)) throw forbidden('내가 쓴 글만 지울 수 있습니다.')
    deletePost(p.id)
    return null
  }),
  view: (id) => mockWrite(() => ({ viewCount: viewPost(publicPost(id).id) })),
  related: (id, signal) => mockRead(() => {
    const cur = readablePost(id)
    const pool = getPosts().filter((p) => isListed(p) && p.id !== cur.id && (!cur.interests.length || p.interests.some((t) => cur.interests.includes(t))))
    return items(pool.sort(SORTS.POPULAR).slice(0, 3).map((p) => postCard(p)))
  }, { signal, empty: () => items([]) }),
  setLike: (id, on) => mockWrite(() => {
    const appId = toAppId(id)
    if (on) publicPost(id)
    if (getPost(appId) && getPost(appId)!.status !== 'deleted') setLike(appId, on)
    const p = getPost(appId)
    return { isLiked: on, likeCount: p ? likesOf(p) : 0 }
  }),
  setBookmark: (id, on) => mockWrite(() => {
    const appId = toAppId(id)
    if (on) publicPost(id)
    if (getPost(appId)) setSave(appId, on)
    return { isBookmarked: on }
  }),

  comments: (postId, q = {}, signal) => mockRead(() => {
    const p = readablePost(postId)
    const size = q.size ?? 10
    if (size < 1 || size > 100) throw invalidInput({ size: '1 ~ 100 사이로 보내 주세요.' })
    return cursorPage(p.comments.filter(live).map(thread), q.cursor, size)
  }, { signal, empty: () => emptyCursor() }),
  addComment: (postId, req) => mockWrite(() => {
    if (blank(req.content) || req.content.length > COMMENT_MAX) throw invalidInput({ content: `댓글은 1 ~ ${COMMENT_MAX}자로 입력해 주세요.` })
    const p = publicPost(postId)
    let made: string
    let parentId: string | null = null
    if (req.replyToCommentId != null) {
      const f = findComment(toAppId(req.replyToCommentId))
      if (!f || f.post.id !== p.id || f.comment.status !== 'public') throw commentNotFound()
      // 답글은 한 단계: 답글에 다시 답하면 같은 댓글 아래에, "@닉네임"은 그 답글의 작성자
      parentId = f.parent ? f.parent.id : f.comment.id
      made = addReply(p.id, parentId, req.content.trim(), f.parent ? nickOf(f.comment.authorId) : undefined)
    } else {
      made = addComment(p.id, req.content.trim())
    }
    const after = getPost(p.id)!
    const c = findComment(made)!.comment
    return { ...commentDto(c), parentCommentId: parentId ? toDtoId(parentId) : null, commentCount: commentCount(after) }
  }),
  editComment: (commentId, req) => mockWrite(() => {
    if (blank(req.content) || req.content.length > COMMENT_MAX) throw invalidInput({ content: `댓글은 1 ~ ${COMMENT_MAX}자로 입력해 주세요.` })
    const f = findComment(toAppId(commentId))
    if (!f || f.comment.status === 'deleted' || f.post.status === 'deleted') throw commentNotFound()
    if (f.comment.authorId !== ME_ID) throw forbidden('내가 쓴 댓글만 고칠 수 있습니다.')
    if (f.comment.status === 'hidden') throw conflict('COMMENT_EDIT_NOT_ALLOWED', '신고로 가려진 댓글은 고칠 수 없습니다.')
    editComment(f.post.id, f.comment.id, req.content.trim())
    const c = findComment(f.comment.id)!.comment
    return { content: c.text, isEdited: !!c.editedAt }
  }),
  deleteComment: (commentId) => mockWrite(() => {
    const f = findComment(toAppId(commentId))
    if (!f || f.comment.status === 'deleted' || f.post.status === 'deleted') throw commentNotFound()
    if (f.comment.authorId !== ME_ID) throw forbidden('내가 쓴 댓글만 지울 수 있습니다.')
    deleteComment(f.post.id, f.comment.id)
    return { commentCount: commentCount(getPost(f.post.id)!) }
  }),
  setCommentLike: (commentId, on) => mockWrite(() => {
    const f = findComment(toAppId(commentId))
    if (on && (!f || f.comment.status !== 'public' || f.post.status !== 'public')) throw commentNotFound()
    if (f) setCommentLike(f.post.id, f.comment.id, on)
    const c = f ? findComment(f.comment.id)?.comment : undefined
    return { isLiked: on, likeCount: c ? c.likes + (c.liked ? 1 : 0) : 0 }
  }),

  myPosts: (q, signal) => mockRead(() => myPosts(q.tab, q.category, q.page, q.size ?? 20), { signal, empty: () => emptyPage(q.size ?? 20) }),
  myPostsSummary: (signal) => mockRead(() => {
    const a = myActivity(getPosts())
    return { writtenCount: a.mine, commentedCount: a.commented, bookmarkedCount: a.saved }
  }, { signal }),
  linkableMeetups: (postCategory, signal) => mockRead(() => {
    if (!CAT_NAME[postCategory]) throw invalidInput({ postCategory: '글 카테고리를 골라 주세요.' })
    return items(linkable(postCategory).map(meetupCardOf))
  }, { signal, empty: () => items([]) }),

  uploadImage: (file) => mockWrite(() => {
    // 서버는 내용으로 형식을 본다. 목은 MIME 으로 흉내
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw invalidInput({ file: 'JPEG, PNG, WebP 사진만 올릴 수 있습니다.' })
    if (file.size > 5 * 1024 * 1024) throw invalidInput({ file: '사진은 한 장에 5MB까지 올릴 수 있습니다.' })
    const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : 'tone:sand'
    const id = registerImage(url)
    return { imageId: toDtoId(id), url }
  }),
  createReport: (req) => mockWrite(() => createReport(req)),
}

/**
 * 다른 사람이 하는 일 흉내 (받는 사람이 나면 알림, 명세 09). 개발 서버 콘솔: __digulMock.community
 * postId 를 빼면 내가 쓴 가장 최근 공개 글
 */
const myLatestPost = () => getPosts().filter((p) => isMine(p) && p.status === 'public').sort((a, b) => b.at - a.at)[0]?.id
export const mockCommunityActors = {
  /** userId 가 글에 댓글 → 글쓴이에게 POST_COMMENTED */
  comment(userId = 'yerin', postId = myLatestPost(), text = '좋은 글 고마워요!') {
    const p = postId ? getPost(postId) : undefined
    if (!p || p.status !== 'public' || !rawPerson(userId)) return null
    const id = addCommentBy(p.id, userId, text)
    notifyMockUser(p.authorId, 'POST_COMMENTED', { actorId: userId, targetId: p.id })
    return id
  },
  /** userId 가 글에 좋아요 → 글쓴이에게 POST_LIKED */
  like(userId = 'mingu', postId = myLatestPost()) {
    const p = postId ? getPost(postId) : undefined
    if (!p || p.status !== 'public' || !rawPerson(userId)) return false
    likeBy(p.id)
    notifyMockUser(p.authorId, 'POST_LIKED', { actorId: userId, targetId: p.id })
    return true
  },
}
