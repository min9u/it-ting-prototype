/**
 * 00(관심사 · 질문 · 프로필) · 03 온보딩 · 04 내 땅굴 API: 목 서버 규칙(명세의 "서버가 하는 일") · 매퍼 · 두더지 코드
 * (docs/backend/api-v1/00-01-03-04-onboarding-burrow.md)
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { toAppId, toDtoId } from '../api/common/ids'
import { mock as onboarding } from '../api/onboarding/mock'
import { mock as burrow } from '../api/burrow/mock'
import { toInterestCatalog, toProfile, toQuestions } from '../api/onboarding/mappers'
import { itemIdOfCode, moleDto, wornOfMole } from '../api/common/moleCodes'
import { campusFloorIdOf, toGuestbookPage, toMyBurrow, toProfileUpdate } from '../api/burrow/mappers'
import { ME_ID } from '../data/mock'
import { getMyInterests } from '../data/interests'
import { getMyWorn } from '../data/moleItems'
import { getMyProfile } from '../data/myBurrow'
import { isUtcInstant } from '../lib/time'

// 목 서버 지연 없이 (손잡이 ?api=fast)
beforeAll(() => { sessionStorage.setItem('digul.api.knobs', 'fast') })

/** 방명록 글 전부 (size 는 1 ~ 20 이라 페이지마다 읽음, 명세 04 KAN-45) */
async function allGuestbook(burrowId: Parameters<typeof burrow.guestbookEntries>[0]) {
  const out = []
  for (let page = 1; ; page++) {
    const p = await burrow.guestbookEntries(burrowId, { page, size: 20 })
    out.push(...p.items)
    if (page >= p.totalPages) return out
  }
}

/** 실패한 요청의 { status, code, fields } */
async function failure(p: Promise<unknown>) {
  try { await p } catch (e) { if (e instanceof ApiError) return { status: e.status, code: e.code, fields: e.fields?.map((f) => f.field) ?? [] } }
  throw new Error('실패하지 않음')
}

describe('두더지 코드 (명세: 영어 대문자 · 숫자 · 밑줄)', () => {
  it('보낼 때 대문자, 받을 때 앱 아이템 id. 모르는 코드는 "없음"', () => {
    expect(moleDto(['hat_beret', 'prop_palette'])).toEqual({ head: 'HAT_BERET', face: null, neck: null, hand: 'PROP_PALETTE' })
    expect(wornOfMole({ head: 'HAT_BERET', face: 'NO_SUCH_ITEM', neck: null, hand: 'prop_cup' })).toEqual(['hat_beret', 'prop_cup'])
    expect(itemIdOfCode('CAP_RED')).toBeNull()
  })
  it('부위가 틀린 코드(머리 자리에 손 아이템)는 뺌', () => {
    expect(wornOfMole({ head: 'PROP_CUP', face: null, neck: null, hand: null })).toEqual([])
  })
  it('공통 사람 직렬화 · 매퍼도 같은 변환 (목 사용자 표시는 대문자, 화면 모양은 앱 아이템 id)', async () => {
    const { userDisplay } = await import('../api/common/mockPeople')
    const { toPersonFromDisplay, wornOf } = await import('../api/common/mappers')
    const d = userDisplay(ME_ID)
    for (const c of [d.mole.head, d.mole.face, d.mole.neck, d.mole.hand]) if (c) expect(c).toMatch(/^[A-Z0-9_]+$/)
    expect(toPersonFromDisplay(d).worn).toEqual(wornOfMole(d.mole))
    expect(wornOf({ head: 'HAT_BERET', face: null, neck: null, hand: null })).toEqual(['hat_beret'])
  })
})

describe('00 목록 · 프로필 (목 서버)', () => {
  it('GET /interest-categories: 대분류 12 · 세부 90, 숫자 id, userCount', async () => {
    const d = await onboarding.interestCategories()
    expect(d.items).toHaveLength(12)
    expect(d.items.flatMap((c) => c.interests)).toHaveLength(90)
    expect(typeof d.items[0].interests[0].id).toBe('number')
    const cat = toInterestCatalog(d)
    expect(cat.unmapped).toEqual([])
    expect(cat.categories[0].tags[1]).toMatchObject({ id: 'cafe_coffee', name: '카페/커피' })
    // 백엔드 처음 값과 같은 번호: 대분류 1 ~ 12, 세부 1 ~ 90 이 00 공통 5 표 순서 (명세 dev 9ea6698 api/00 응답 예시)
    expect(d.items.map((c) => c.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
    expect(d.items.flatMap((c) => c.interests.map((i) => i.id))).toEqual(Array.from({ length: 90 }, (_, i) => i + 1))
    expect(d.items[0]).toMatchObject({ id: 1, name: '음식·음료' })
    expect(d.items[0].interests.slice(0, 3).map((i) => [i.id, i.name])).toEqual([[1, '맛집탐방'], [2, '카페/커피'], [3, '주류/와인/위스키']])
    expect(d.items[1].interests.slice(0, 2).map((i) => [i.id, i.name])).toEqual([[8, '헬스/필라테스/요가'], [9, '러닝/마라톤']])
  })
  it('GET /intro-questions: type 거르기, TMI 는 interestCategoryId null, 대분류 코드로 이어짐', async () => {
    const all = await onboarding.introQuestions()
    const tmi = await onboarding.introQuestions('TMI')
    expect(tmi.items.every((q) => q.type === 'TMI' && q.interestCategoryId === null)).toBe(true)
    expect(tmi.items.length).toBeLessThan(all.items.length)
    const qs = toQuestions(all, toInterestCatalog(await onboarding.interestCategories()))
    expect(qs.find((q) => q.id === 'music-1')).toMatchObject({ kind: 'interest', category: 'music_dance' })
    // 처음 값의 순서: 관심사 질문(대분류 1 → 12) → TMI
    const catOrder = all.items.map((q) => q.interestCategoryId ?? 99)
    expect(catOrder).toEqual([...catOrder].sort((x, y) => x - y))
    expect(all.items[0]).toMatchObject({ type: 'INTEREST', interestCategoryId: 1 })
    expect(await failure(onboarding.introQuestions('X' as never))).toMatchObject({ status: 400, code: 'INVALID_INPUT' })
  })
  it('GET /users/{userId}/profile: 사용자 표시 + 관심사(겹침), 없는 사람은 404 USER_NOT_FOUND', async () => {
    const p = toProfile(await onboarding.userProfile(toDtoId('yerin')))
    expect(p.person.id).toBe('yerin')
    expect(p.interests[0]).toBe('캠핑/글램핑')
    expect(p.shared.length).toBeGreaterThan(0)
    expect(p.person.worn).toContain('hat_chef')
    expect(await failure(onboarding.userProfile(toDtoId('gone')))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
  })
})

describe('03 온보딩 (목 서버)', () => {
  it('POST /nicknames/check: 쓸 수 있으면 5분 뒤 시각(UTC), 겹치면 409, 빈 값은 400', async () => {
    const r = await onboarding.checkNickname('처음보는이름')
    expect(isUtcInstant(r.expiresAt)).toBe(true)
    expect(await failure(onboarding.checkNickname('예린'))).toMatchObject({ status: 409, code: 'NICKNAME_DUPLICATED' })
    expect(await failure(onboarding.checkNickname('  '))).toMatchObject({ status: 400, code: 'INVALID_INPUT', fields: ['nickname'] })
  })
  it('POST /me/onboarding/complete: 모양이 어긋나면 어긋난 칸을 모두 담아 400', async () => {
    const f = await failure(onboarding.completeOnboarding({
      nickname: '', mole: { head: 'hat_beret', face: null, neck: null, hand: null },
      interestIds: [toDtoId('kpop')], answers: [{ introQuestionId: toDtoId('music-1'), answer: '짧음' }],
    }))
    expect(f).toMatchObject({ status: 400, code: 'INVALID_INPUT' })
    expect(f.fields).toEqual(expect.arrayContaining(['nickname', 'mole.head', 'interestIds', 'answers']))
  })
  it('없는 관심사 404 INTEREST_NOT_FOUND · 없는 질문 404 INTRO_QUESTION_NOT_FOUND', async () => {
    const base = {
      nickname: '새닉네임', mole: { head: null, face: null, neck: null, hand: null },
      interestIds: [toDtoId('kpop'), toDtoId('movie'), toDtoId('cat')],
      answers: ['music-1', 'culture-1', 'tmi-1'].map((q) => ({ introQuestionId: toDtoId(q), answer: '열 글자가 넘는 답변이에요' })),
    }
    expect(await failure(onboarding.completeOnboarding({ ...base, interestIds: [...base.interestIds.slice(0, 2), toDtoId('no_such')] }))).toMatchObject({ status: 404, code: 'INTEREST_NOT_FOUND' })
    expect(await failure(onboarding.completeOnboarding({ ...base, answers: [...base.answers.slice(0, 2), { introQuestionId: toDtoId('no-q'), answer: '열 글자가 넘는 답변이에요' }] }))).toMatchObject({ status: 404, code: 'INTRO_QUESTION_NOT_FOUND' })
    expect(await failure(onboarding.completeOnboarding({ ...base, nickname: '예린' }))).toMatchObject({ status: 409, code: 'NICKNAME_DUPLICATED' })
  })
  it('성공하면 한 번에 저장 (닉네임 · 두더지 · 관심사 순서 · 질문 답) + nextStep HOME', async () => {
    const r = await onboarding.completeOnboarding({
      nickname: '새벽산책', mole: { head: 'HAT_BERET', face: null, neck: null, hand: 'PROP_PALETTE' },
      interestIds: [toDtoId('tea'), toDtoId('kpop'), toDtoId('cat')],
      answers: ['food-1', 'music-1', 'tmi-1'].map((q) => ({ introQuestionId: toDtoId(q), answer: `${q} 에 대한 열 글자 넘는 답` })),
    })
    expect(r.nextStep).toBe('HOME')
    expect(toAppId(r.userId)).toBe(ME_ID)
    expect(getMyProfile().nickname).toBe('새벽산책')
    expect(getMyInterests([])).toEqual(['차/다도', 'K-POP', '고양이'])
    expect(getMyWorn()).toEqual(['hat_beret', 'prop_palette'])
  })
})

describe('04 내 땅굴 (목 서버)', () => {
  it('GET /me/burrow → 앱 모양 (관심사 순서 · 질문 자리 · 두더지 · 입구)', async () => {
    const b = toMyBurrow(await burrow.myBurrow())
    expect(b.burrowId).toBe(ME_ID)
    expect(b.interests[0]).toBe('차/다도')
    expect(b.answers.map((a) => a.slot)).toEqual([1, 2, 3])
    expect(b.worn).toEqual(['hat_beret', 'prop_palette'])
    expect(b.entrance.campusFloorId).toBe(b.campusFloorId)
    expect(b.guestbookCount).toBeGreaterThan(0)
  })
  it('PATCH /me/mole: 네 부위 · 코드 모양을 보고 저장, 저장한 두더지를 돌려줌', async () => {
    expect(await failure(burrow.updateMole({ head: 'hat_beret' } as never))).toMatchObject({ status: 400, code: 'INVALID_INPUT' })
    const m = await burrow.updateMole({ head: 'HAT_CROWN', face: 'GLASSES_ROUND', neck: null, hand: null })
    expect(m.head).toBe('HAT_CROWN')
    expect(getMyWorn()).toEqual(['hat_crown', 'glasses_round'])
  })
  it('PATCH /me/profile: 다섯 값이 다 있어야 함 (빠지면 400), 캠퍼스-층이 없으면 404', async () => {
    const now = toMyBurrow(await burrow.myBurrow())
    const catalog = toInterestCatalog(await onboarding.interestCategories())
    const draft = { nickname: now.nickname, intro: '', campus: now.campus, floor: now.floor, interests: now.interests, qna: now.answers.map((a) => ({ qid: a.questionId, a: a.answer })) }
    const body = toProfileUpdate(draft, catalog, now.campusFloorId)
    expect(body.intro).toBeNull()
    const { intro: _drop, ...missing } = body
    void _drop
    expect(await failure(burrow.updateProfile(missing as never))).toMatchObject({ status: 400, code: 'INVALID_INPUT', fields: ['intro'] })
    expect(await failure(burrow.updateProfile({ ...body, campusFloorId: toDtoId('달나라|9') }))).toMatchObject({ status: 404, code: 'CAMPUS_FLOOR_NOT_FOUND' })
    expect(await failure(burrow.updateProfile({ ...body, nickname: '예린' }))).toMatchObject({ status: 409, code: 'NICKNAME_DUPLICATED' })
  })
  it('PATCH /me/profile 성공: 관심사 순서(대표) · 캠퍼스-층 · 자기소개가 바뀐 내 땅굴 전체를 돌려줌', async () => {
    const now = toMyBurrow(await burrow.myBurrow())
    const catalog = toInterestCatalog(await onboarding.interestCategories())
    const campuses = [{ id: '대전|1', name: '대전', floors: [{ id: '대전|1', floor: 1 }] }]
    const cf = campusFloorIdOf(campuses, '대전', 1)!
    const next = toMyBurrow(await burrow.updateProfile(toProfileUpdate({
      nickname: now.nickname, intro: '안녕하세요', campus: '대전', floor: 1, interests: ['고양이', '차/다도', 'K-POP', '영화'],
      qna: now.answers.map((a) => ({ qid: a.questionId, a: a.answer })),
    }, catalog, cf)))
    expect(next.interests).toEqual(['고양이', '차/다도', 'K-POP', '영화'])
    expect(next.campus).toBe('대전')
    expect(next.floor).toBe(1)
    expect(next.intro).toBe('안녕하세요')
  })
  it('방명록: 최신순 5개씩, 주인은 삭제 · 신고 둘 다, 가려진 글은 빠짐, 시각은 UTC', async () => {
    const p1 = toGuestbookPage(await burrow.guestbookEntries(toDtoId(ME_ID), { page: 1 }))
    expect(p1.items).toHaveLength(5)
    expect(p1.totalPages).toBe(Math.ceil(p1.totalItems / 5))
    expect(p1.items.every((g) => g.canDelete && g.canReport)).toBe(true)
    expect(p1.items.every((g) => isUtcInstant(g.createdAt))).toBe(true)
    const all = { items: await allGuestbook(toDtoId(ME_ID)) }
    expect(all.items.length).toBe(p1.totalItems)
    expect(all.items.some((g) => g.content.includes('가려진'))).toBe(false)
    const times = all.items.map((g) => Date.parse(g.createdAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })
  it('남의 땅굴 방명록: 내가 쓴 글만 지울 수 있고, 남의 글은 신고만. 없는 땅굴은 404', async () => {
    const p = { items: await allGuestbook(toDtoId('yerin')) }
    expect(p.items.every((g) => !g.canDelete && g.canReport)).toBe(true)
    expect(await failure(burrow.deleteGuestbookEntry(p.items[0].id))).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(await failure(burrow.guestbookEntries(toDtoId('gone')))).toMatchObject({ status: 404, code: 'BURROW_NOT_FOUND' })
  })
  it('DELETE /guestbook-entries/{id}: 주인은 지울 수 있고, 다시 지우면 404', async () => {
    const before = await burrow.guestbookEntries(toDtoId(ME_ID), { page: 1 })
    const id = before.items[0].id
    expect(await burrow.deleteGuestbookEntry(id)).toBeNull()
    const after = await burrow.guestbookEntries(toDtoId(ME_ID), { page: 1 })
    expect(after.totalItems).toBe(before.totalItems - 1)
    expect(await failure(burrow.deleteGuestbookEntry(id))).toMatchObject({ status: 404, code: 'GUESTBOOK_ENTRY_NOT_FOUND' })
  })
})

describe('신고 본문 (POST /reports, api/burrow/report.ts → api/community reportBody)', () => {
  it('방명록 글 · 사용자 신고는 명세 모양: 숫자 targetId, 사유 코드 OBSCENE, 기타면 detail', async () => {
    const { reportBody } = await import('../api/community/real')
    expect(reportBody('GUESTBOOK', 'me-gb1', '음란물')).toEqual({ targetType: 'GUESTBOOK', targetId: toDtoId('me-gb1'), reason: 'OBSCENE', detail: null })
    expect(reportBody('MEMBER', 'yerin', '기타: 사칭')).toEqual({ targetType: 'MEMBER', targetId: toDtoId('yerin'), reason: 'ETC', detail: '사칭' })
    expect(typeof reportBody('MEMBER', 'yerin', '스팸·홍보').targetId).toBe('number')
  })
})
