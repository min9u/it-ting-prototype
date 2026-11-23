/**
 * 08 커뮤니티 API 목 서버가 명세(docs/backend/team-spec/api/08-community.md)대로 답하는지.
 * 화면은 이 목 서버로 돌고, 실제 서버로 바꿔도 같은 모양 · 같은 에러 코드가 와야 한다.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { toAppId, toDtoId } from '../api/common/ids'
import { mock as api } from '../api/community/mock'
import { interestCategoryIdOf, reportBody, toPostCard, toPostDetail } from '../api/community'
import { getMeetupState, recruitOf } from '../data/meetupStore'
import { isUtcInstant } from '../lib/time'

beforeAll(() => { sessionStorage.setItem('digul.api.knobs', 'fast') })

/** 실패한 호출의 code (성공하면 시험 실패) */
async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p } catch (e) { expect(e).toBeInstanceOf(ApiError); return (e as ApiError).code }
  throw new Error('실패해야 하는데 성공함')
}
const id = (s: string) => toDtoId(s)

describe('글 목록 · 인기 글 (GET /posts, /posts/highlights)', () => {
  it('공개 글만, 20개씩 페이지, id 는 숫자 · 시각은 UTC', async () => {
    const d = await api.list({})
    expect(d.size).toBe(20)
    expect(d.page).toBe(1)
    expect(d.items.length).toBeLessThanOrEqual(20)
    expect(d.totalPages).toBe(Math.ceil(d.totalItems / 20))
    for (const p of d.items) {
      expect(typeof p.id).toBe('number')
      expect(isUtcInstant(p.createdAt)).toBe(true)
      expect(p.isHidden).toBe(false)
      expect(p.contentPreview.length).toBeLessThanOrEqual(100)
    }
    const ids = d.items.map((p) => toAppId(p.id))
    expect(ids).not.toContain('p27') // 남이 쓴 가려진 글
    expect(ids).not.toContain('p28') // 삭제된 글
  })
  it('카테고리 · 관심사 · 검색어 · 정렬', async () => {
    const promo = await api.list({ category: 'PROMOTION', size: 50 })
    expect(promo.items.every((p) => p.category === 'PROMOTION')).toBe(true)
    const outdoor = await api.list({ interestCategoryId: interestCategoryIdOf('아웃도어'), size: 50 })
    expect(outdoor.items.length).toBeGreaterThan(0)
    expect(outdoor.items.every((p) => p.interestCategories.some((c) => c.name === '아웃도어'))).toBe(true)
    const kw = await api.list({ keyword: '캠핑', size: 50 })
    expect(kw.items.length).toBeGreaterThan(0)
    const pop = await api.list({ sort: 'POPULAR', size: 50 })
    for (let i = 1; i < pop.items.length; i++) expect(pop.items[i - 1].likeCount).toBeGreaterThanOrEqual(pop.items[i].likeCount)
    const mc = await api.list({ sort: 'MOST_COMMENTED', size: 50 })
    for (let i = 1; i < mc.items.length; i++) expect(mc.items[i - 1].commentCount).toBeGreaterThanOrEqual(mc.items[i].commentCount)
  })
  it('없는 페이지는 빈 목록, 검색어 50자 넘으면 INVALID_INPUT', async () => {
    expect((await api.list({ page: 99 })).items).toEqual([])
    expect(await codeOf(api.list({ keyword: 'ㄱ'.repeat(51) }))).toBe('INVALID_INPUT')
  })
  it('인기 글 5개까지(순위 1부터), 관심사 8개까지', async () => {
    const h = await api.highlights()
    expect(h.weeklyTopPosts.length).toBeLessThanOrEqual(5)
    h.weeklyTopPosts.forEach((p, i) => expect(p.rank).toBe(i + 1))
    expect(h.trendingInterestCategories.length).toBeLessThanOrEqual(8)
  })
})

describe('글 상세 (GET /posts/{postId})', () => {
  it('남이 쓴 가려진 글은 404 POST_HIDDEN, 삭제된 글은 404 POST_NOT_FOUND', async () => {
    expect(await codeOf(api.get(id('p27')))).toBe('POST_HIDDEN')
    expect(await codeOf(api.get(id('p28')))).toBe('POST_NOT_FOUND')
    expect(await codeOf(api.view(id('p27')))).toBe('POST_HIDDEN')
  })
  it('내가 쓴 가려진 글은 작성자에게 보이고 고칠 수 없음 (canEdit false)', async () => {
    const d = await api.get(id('p24'))
    expect(d.isMine).toBe(true)
    expect(d.isHidden).toBe(true)
    expect(d.canEdit).toBe(false)
    expect(await codeOf(api.update(id('p24'), { category: 'FREE', title: 'x', content: 'y', interestCategoryIds: [], imageIds: [], meetupId: null }))).toBe('POST_EDIT_NOT_ALLOWED')
  })
  it('연결한 모임은 모임 카드, 사진은 id · url', async () => {
    const d = await api.get(id('p1'))
    expect(d.meetup?.recruitStatus).toMatch(/^(OPEN|CLOSED|PAST|CANCELED)$/)
    expect(d.images[0]).toEqual({ id: expect.any(Number), url: expect.any(String) })
    const vm = toPostDetail(d)
    expect(vm.id).toBe('p1')
    expect(vm.meetup?.id).toBe('m4')
  })
  it('조회수: 열 때마다 +1 (작성자도 셈)', async () => {
    const before = (await api.get(id('p6'))).viewCount
    expect((await api.view(id('p6'))).viewCount).toBe(before + 1)
  })
  it('다음 읽을 글: 3개까지, 지금 글은 빼고, 태그 대분류가 겹침', async () => {
    const r = await api.related(id('p1'))
    expect(r.items.length).toBeLessThanOrEqual(3)
    expect(r.items.map((x) => toAppId(x.id))).not.toContain('p1')
    for (const x of r.items) expect(x.interestCategories.some((c) => c.name === '아웃도어')).toBe(true)
  })
})

describe('글쓰기 · 고치기 · 지우기', () => {
  const base = { title: '제목', content: '본문', interestCategoryIds: [] as number[], imageIds: [] as number[] }
  it('제목이 비면 INVALID_INPUT + fields.title, 모임 홍보 · 후기는 모임이 꼭', async () => {
    try { await api.create({ ...base, category: 'FREE', title: '  ', meetupId: null }); throw new Error('성공하면 안 됨') }
    catch (e) { expect((e as ApiError).code).toBe('INVALID_INPUT'); expect((e as ApiError).fields?.map((f) => f.field)).toContain('title') }
    expect(await codeOf(api.create({ ...base, category: 'PROMOTION', meetupId: null }))).toBe('INVALID_INPUT')
    expect(await codeOf(api.create({ ...base, category: 'REVIEW', meetupId: null }))).toBe('INVALID_INPUT')
  })
  it('고를 수 없는 모임은 409 MEETUP_NOT_LINKABLE, 없는 모임은 404 MEETUP_NOT_FOUND', async () => {
    const open = (await api.linkableMeetups('PROMOTION')).items[0]
    if (open) expect(await codeOf(api.create({ ...base, category: 'REVIEW', meetupId: open.id }))).toBe('MEETUP_NOT_LINKABLE')
    expect(await codeOf(api.create({ ...base, category: 'FREE', meetupId: id('no-such-meetup') }))).toBe('MEETUP_NOT_FOUND')
  })
  it('연결할 수 있는 모임: 홍보는 내가 연 모집 중, 후기는 지난 모임만', async () => {
    const all = getMeetupState().list
    for (const m of (await api.linkableMeetups('PROMOTION')).items) {
      expect(m.recruitStatus).toBe('OPEN')
      expect(all.find((x) => x.id === toAppId(m.id))?.hostId).toBe('me')
    }
    for (const m of (await api.linkableMeetups('REVIEW')).items) expect(m.recruitStatus).toBe('PAST')
    for (const m of (await api.linkableMeetups('FREE')).items) expect(recruitOf(all.find((x) => x.id === toAppId(m.id))!)).not.toBe('cancelled')
  })
  it('사진: JPEG · PNG · WebP 만, 올린 id 로 글에 붙음 (첫 장이 대표)', async () => {
    expect(await codeOf(api.uploadImage(new File(['x'], 'a.gif', { type: 'image/gif' })))).toBe('INVALID_INPUT')
    const up = await api.uploadImage(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(typeof up.imageId).toBe('number')
    const tag = interestCategoryIdOf('게임')!
    const { postId } = await api.create({ ...base, category: 'FREE', interestCategoryIds: [tag], imageIds: [up.imageId], meetupId: null })
    const d = await api.get(postId)
    expect(d.images.map((i) => i.id)).toEqual([up.imageId])
    expect(d.interestCategories.map((c) => c.name)).toEqual(['게임'])
    expect(d.isEdited).toBe(false)
    // 이미 붙은 사진은 다른 글에 못 씀
    expect(await codeOf(api.create({ ...base, category: 'FREE', imageIds: [up.imageId], meetupId: null }))).toBe('INVALID_INPUT')
    // 고치기: 태그만 바꾸면 "수정됨" 안 붙음, 제목을 바꾸면 붙음
    await api.update(postId, { ...base, category: 'FREE', interestCategoryIds: [], imageIds: [up.imageId], meetupId: null })
    expect((await api.get(postId)).isEdited).toBe(false)
    await api.update(postId, { ...base, title: '새 제목', category: 'FREE', interestCategoryIds: [], imageIds: [], meetupId: null })
    const after = await api.get(postId)
    expect(after.isEdited).toBe(true)
    expect(after.images).toEqual([])
    // 지우기 → 다시 열면 POST_NOT_FOUND, 남의 글은 FORBIDDEN
    expect(await api.remove(postId)).toBeNull()
    expect(await codeOf(api.get(postId))).toBe('POST_NOT_FOUND')
    expect(await codeOf(api.remove(id('p1')))).toBe('FORBIDDEN')
  })
})

describe('댓글 (GET · POST /posts/{postId}/comments, /comments/{commentId})', () => {
  it('댓글 10개씩 커서, 답글은 댓글에 붙고 size 에 안 셈, 가려진 댓글은 본문 null', async () => {
    const first = await api.comments(id('p1'))
    expect(first.items.length).toBe(10)
    expect(first.hasNext).toBe(true)
    const next = await api.comments(id('p1'), { cursor: first.nextCursor })
    expect(next.items[0].id).not.toBe(first.items[0].id)
    const all = [...first.items, ...next.items]
    expect(all.some((c) => c.replies.length > 0)).toBe(true)
    const hidden = all.find((c) => c.isHidden)!
    expect(hidden.content).toBeNull()
  })
  it('답글에 다시 답하면 같은 댓글 아래 + @닉네임, 응답에 parentCommentId · commentCount', async () => {
    const page = await api.comments(id('p1'))
    const thread = page.items.find((c) => c.replies.length > 0)!
    const reply = thread.replies[0]
    const before = (await api.get(id('p1'))).commentCount
    const made = await api.addComment(id('p1'), { content: '저도요', replyToCommentId: reply.id })
    expect(made.parentCommentId).toBe(thread.id)
    expect(made.mentionUser?.nickname).toBe(reply.author.nickname)
    expect(made.commentCount).toBe(before + 1)
    expect(made.isMine).toBe(true)
    // 고치기 → isEdited, 같은 본문이면 그대로
    const edited = await api.editComment(made.id, { content: '저도 갈래요' })
    expect(edited).toEqual({ content: '저도 갈래요', isEdited: true })
    // 좋아요 켜고 끄기
    expect((await api.setCommentLike(made.id, true)).isLiked).toBe(true)
    expect((await api.setCommentLike(made.id, false)).likeCount).toBe(0)
    // 지우기 → 댓글 수
    expect((await api.deleteComment(made.id)).commentCount).toBe(before)
    expect(await codeOf(api.deleteComment(made.id))).toBe('COMMENT_NOT_FOUND')
  })
  it('남의 댓글은 고칠 수 없음 (403 FORBIDDEN), 빈 댓글은 INVALID_INPUT', async () => {
    const other = (await api.comments(id('p1'))).items.find((c) => !c.isMine && !c.isHidden)!
    expect(await codeOf(api.editComment(other.id, { content: '바꿈' }))).toBe('FORBIDDEN')
    expect(await codeOf(api.addComment(id('p1'), { content: '   ', replyToCommentId: null }))).toBe('INVALID_INPUT')
  })
})

describe('좋아요 · 저장 · 내 활동', () => {
  it('좋아요 · 저장은 PUT 켜기 · DELETE 끄기 (멱등), 가려진 글에는 못 함', async () => {
    const a = await api.setLike(id('p2'), true)
    const b = await api.setLike(id('p2'), true)
    expect(b).toEqual(a)
    expect((await api.setLike(id('p2'), false)).likeCount).toBe(a.likeCount - 1)
    expect(await api.setBookmark(id('p4'), true)).toEqual({ isBookmarked: true })
    expect(await codeOf(api.setBookmark(id('p27'), true))).toBe('POST_HIDDEN')
  })
  it('내가 쓴 글에는 가려진 글도(isHidden), 저장한 글은 최근 저장 순 + bookmarkedAt, 댓글 단 글은 내 최근 댓글', async () => {
    const written = await api.myPosts({ tab: 'WRITTEN' })
    const hidden = written.items.find((p) => toAppId(p.id) === 'p24')!
    expect(hidden.isHidden).toBe(true)
    expect(hidden.canEdit).toBe(false)
    const saved = await api.myPosts({ tab: 'BOOKMARKED' })
    for (let i = 1; i < saved.items.length; i++) expect(saved.items[i - 1].bookmarkedAt! >= saved.items[i].bookmarkedAt!).toBe(true)
    expect(saved.items.every((p) => p.myLatestComment === null && p.myCommentCount === 0)).toBe(true)
    const commented = await api.myPosts({ tab: 'COMMENTED' })
    expect(commented.items.length).toBeGreaterThan(0)
    for (const p of commented.items) { expect(p.myLatestComment).not.toBeNull(); expect(p.myCommentCount).toBeGreaterThan(0); expect(p.bookmarkedAt).toBeNull() }
    const sum = await api.myPostsSummary()
    expect(sum).toEqual({ writtenCount: written.totalItems, commentedCount: commented.totalItems, bookmarkedCount: saved.totalItems })
    expect(await codeOf(api.myPosts({ tab: 'NOPE' as never }))).toBe('INVALID_INPUT')
  })
  it('글 카드 매퍼: 앱 id · 한글 카테고리 · ms 시각', async () => {
    const d = (await api.list({ category: 'REVIEW' })).items[0]
    const vm = toPostCard(d)
    expect(vm.category).toBe('모임 후기')
    expect(typeof vm.id).toBe('string')
    expect(vm.createdAt).toBeGreaterThan(0)
  })
})

describe('신고 (POST /reports)', () => {
  it('사유 문구 → 코드, "기타: …" 는 detail', () => {
    expect(reportBody('POST', 'p1', '음란물')).toMatchObject({ targetType: 'POST', reason: 'OBSCENE', detail: null, targetId: id('p1') })
    expect(reportBody('COMMENT', 'c1', '기타: 도배')).toMatchObject({ reason: 'ETC', detail: '도배' })
  })
  it('같은 대상은 한 번(ALREADY_REPORTED), 내 것은 OWN_TARGET_NOT_ALLOWED, 없거나 가려진 대상은 REPORT_TARGET_NOT_FOUND', async () => {
    const r = await api.createReport({ targetType: 'POST', targetId: id('p3'), reason: 'SPAM', detail: null })
    expect(typeof r.reportId).toBe('number')
    expect((await api.get(id('p3'))).isReportedByMe).toBe(true)
    expect(await codeOf(api.createReport({ targetType: 'POST', targetId: id('p3'), reason: 'SPAM', detail: null }))).toBe('ALREADY_REPORTED')
    expect(await codeOf(api.createReport({ targetType: 'POST', targetId: id('p6'), reason: 'SPAM', detail: null }))).toBe('OWN_TARGET_NOT_ALLOWED')
    expect(await codeOf(api.createReport({ targetType: 'POST', targetId: id('p27'), reason: 'SPAM', detail: null }))).toBe('REPORT_TARGET_NOT_FOUND')
    expect(await codeOf(api.createReport({ targetType: 'MEMBER', targetId: id('me'), reason: 'ABUSE', detail: null }))).toBe('OWN_TARGET_NOT_ALLOWED')
    expect(await codeOf(api.createReport({ targetType: 'MEMBER', targetId: id('yerin'), reason: 'ETC', detail: '' }))).toBe('INVALID_INPUT')
    await api.createReport({ targetType: 'MEMBER', targetId: id('yerin'), reason: 'ETC', detail: '사칭' })
    expect(await codeOf(api.createReport({ targetType: 'MEMBER', targetId: id('yerin'), reason: 'SPAM', detail: null }))).toBe('ALREADY_REPORTED')
  })
})
