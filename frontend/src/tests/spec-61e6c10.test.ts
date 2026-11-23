/**
 * 팀 명세 dev 61e6c10 반영 (2026-11-23, KAN-45 · KAN-51 · KAN-54 구현하며 정한 것):
 * 자기소개 앞뒤 공백 · 이모지 한 자, 방명록 목록 page · size 범위와 넘친 페이지, 게시판 검색어 앞뒤 공백
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { toDtoId } from '../api/common/ids'
import { mock as onboarding } from '../api/onboarding/mock'
import { mock as burrow } from '../api/burrow/mock'
import { toInterestCatalog } from '../api/onboarding/mappers'
import { toMyBurrow, toProfileUpdate } from '../api/burrow/mappers'
import { answerOk } from '../data/questions'
import { clampText, counter, lengthOf } from '../lib/validation'

beforeAll(() => { sessionStorage.setItem('digul.api.knobs', 'fast') })

async function failure(p: Promise<unknown>) {
  try { await p } catch (e) { if (e instanceof ApiError) return { status: e.status, code: e.code, fields: e.fields?.map((f) => f.field) ?? [] } }
  throw new Error('실패하지 않음')
}

describe('글자 수: 이모지도 한 자 (DB CHAR_LENGTH, 명세 03 · 04)', () => {
  it('lengthOf · counter · clampText 는 코드 포인트로 셈', () => {
    expect(lengthOf('🐹🐹가')).toBe(3)
    expect(counter('🐹'.repeat(150), 150)).toMatchObject({ n: 150, full: true })
    expect(clampText('🐹'.repeat(151), 150)).toBe('🐹'.repeat(150))
    expect(clampText('가나다', 5)).toBe('가나다')
  })
  it('답변: 이모지 50개는 통과, 51개는 안 됨', () => {
    expect(answerOk('🐹'.repeat(50))).toBe(true)
    expect(answerOk('🐹'.repeat(51))).toBe(false)
  })
})

describe('PATCH /me/profile intro (명세 04, KAN-45)', () => {
  const setup = async () => {
    const now = toMyBurrow(await burrow.myBurrow())
    const catalog = toInterestCatalog(await onboarding.interestCategories())
    const draft = (intro: string) => ({ nickname: now.nickname, intro, campus: now.campus, floor: now.floor, interests: now.interests, qna: now.answers.map((a) => ({ qid: a.questionId, a: a.answer })) })
    return { body: (intro: string) => toProfileUpdate(draft(intro), catalog, now.campusFloorId) }
  }
  it('앞뒤 공백을 지워 보내고, 공백뿐이면 null. 가운데 줄바꿈은 그대로', async () => {
    const { body } = await setup()
    expect(body('  안녕\n하세요  ').intro).toBe('안녕\n하세요')
    expect(body('   \n ').intro).toBeNull()
  })
  it('이모지 150개는 저장, 151개는 400', async () => {
    const { body } = await setup()
    const saved = toMyBurrow(await burrow.updateProfile(body('🐹'.repeat(150))))
    expect(lengthOf(saved.intro)).toBe(150)
    expect(await failure(burrow.updateProfile({ ...body(''), intro: '🐹'.repeat(151) }))).toMatchObject({ status: 400, code: 'INVALID_INPUT', fields: ['intro'] })
  })
})

describe('GET /burrows/{id}/guestbook-entries page · size (명세 04, KAN-45)', () => {
  it('page 가 1보다 작거나 size 가 1 ~ 20 을 벗어나면 400', async () => {
    const me = toMyBurrow(await burrow.myBurrow())
    const id = me.burrowId
    expect(await failure(burrow.guestbookEntries(toDtoId(id), { page: 0 }))).toMatchObject({ status: 400, fields: ['page'] })
    expect(await failure(burrow.guestbookEntries(toDtoId(id), { size: 21 }))).toMatchObject({ status: 400, fields: ['size'] })
    expect(await failure(burrow.guestbookEntries(toDtoId(id), { size: 0 }))).toMatchObject({ status: 400, fields: ['size'] })
  })
  it('글이 있는 페이지를 넘으면 빈 목록이고 전체 수는 실제 값', async () => {
    const me = toMyBurrow(await burrow.myBurrow())
    const first = await burrow.guestbookEntries(toDtoId(me.burrowId), { page: 1, size: 5 })
    const over = await burrow.guestbookEntries(toDtoId(me.burrowId), { page: first.totalPages + 1, size: 5 })
    expect(over.items).toEqual([])
    expect(over.totalItems).toBe(first.totalItems)
    expect(over.totalPages).toBe(first.totalPages)
  })
})
