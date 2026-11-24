/**
 * 05 탐색 · 방문 (+ 00 학기) API v1 — 목 서버가 명세 모양 · 규칙대로 답하는지, 매퍼가 앱 모양으로 바꾸는지
 * 명세: docs/backend/team-spec/api/05-explore-visit.md, 00-common.md "GET /api/v1/terms". 정리: docs/backend/api-v1/05-explore-visit.md
 * 목 저장소(data/field · data/guestbookStore · data/chat)를 시험마다 새로 쓰려고 모듈을 다시 불러옴
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MockMod from '../api/explore/mock'
import type * as BurrowMockMod from '../api/burrow/mock'
import type * as BurrowMapMod from '../api/burrow/mappers'
import type * as MapMod from '../api/explore/mappers'
import type * as IdsMod from '../api/common/ids'
import type * as FieldMod from '../data/field'
import type { FieldDto } from '../api/explore/types'
import { isDateString, isUtcInstant } from '../lib/time'

let B: typeof MockMod['mock'], BB: typeof BurrowMockMod['mock'], BP: typeof BurrowMapMod, P: typeof MapMod, D: typeof IdsMod, F: typeof FieldMod

beforeAll(() => { window.history.replaceState(null, '', '/?api=fast') }) // 목 서버 지연 없이
beforeEach(async () => {
  sessionStorage.clear(); localStorage.clear()
  vi.resetModules()
  B = (await import('../api/explore/mock')).mock
  BB = (await import('../api/burrow/mock')).mock
  BP = await import('../api/burrow/mappers')
  P = await import('../api/explore/mappers')
  D = await import('../api/common/ids')
  F = await import('../data/field')
})

/** ApiError 인지 (모듈을 다시 불러와서 instanceof 대신 모양으로) */
const isApiError = (e: unknown): e is { code: string; fields: { field: string }[] | null } => !!e && typeof e === 'object' && 'code' in e && 'status' in e
/** 실패한 호출의 code */
async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p } catch (e) { return isApiError(e) ? e.code : String(e) }
  return 'OK'
}
const id = (s: string) => D.toDtoId(s)
const CUR = '2026 하반기', PAST = '2026 상반기'

describe('GET /terms (00 공통)', () => {
  it('최근에 열린 학기부터, 첫 번째가 이번 학기 (isCurrent 하나만)', async () => {
    const terms = P.toTerms(await B.terms())
    expect(terms.map((t) => t.label)).toEqual([CUR, PAST])
    expect(terms.filter((t) => t.isCurrent)).toHaveLength(1)
    expect(terms[0].isCurrent).toBe(true)
    expect(P.termLabel(2027, 1)).toBe('2027 상반기')
  })
})

describe('들판 (GET /terms/{termId}/fields · /fields/{campusFloorId})', () => {
  it('내 들판: 입구를 자리 순으로, 내 입구는 isMine, 구역 수 = ceil(가장 큰 자리/25)', async () => {
    const dto = await B.field(id(CUR), id('서울|2'))
    expect(dto.term).toMatchObject({ year: 2026, half: 2, isCurrent: true })
    expect(dto.campusName).toBe('서울')
    expect(dto.items.map((x) => x.slot)).toEqual([...dto.items.map((x) => x.slot)].sort((a, b) => a - b))
    expect(dto.items.every((x) => x.answers.length <= 3 && typeof x.burrowId === 'number' && typeof x.owner.id === 'number')).toBe(true)
    const vm = P.toField(dto)
    expect(P.placeId(vm.place)).toBe(`${CUR}|서울|2`) // 목 모드: 예전 들판 id 와 같은 글자 (?floor= 주소가 그대로)
    expect(vm.floor).toMatchObject({ campus: '서울', floor: 2, current: true })
    expect(vm.mySeat).toBe(F.MY_SEAT)
    expect(vm.zones).toBe(Math.max(1, Math.ceil(vm.maxSeat / 25)))
    // 나와 겹치는 관심사 = isShared, 내 입구는 겹침 없음
    const me = vm.residents.find((r) => r.mine)!
    expect(me.shared).toEqual([])
    const other = dto.items.find((x) => !x.isMine && x.interests.some((t) => t.isShared))!
    expect(vm.residents.find((r) => r.seat === other.slot)!.shared).toEqual(other.interests.filter((t) => t.isShared).map((t) => t.name))
  })
  it('들판마다 비어 있는지 (캠퍼스 순서), 빈 층은 isEmpty', async () => {
    const past = P.toFieldStatuses(await B.fieldStatuses(id(PAST)))
    expect(past.get('부울경|1')).toBe(true)
    const cur = await B.fieldStatuses(id(CUR))
    expect(D.toAppId(cur.items[0].campusFloorId)).toBe('서울|2')
    expect(cur.items.find((x) => D.toAppId(x.campusFloorId) === '서울|2')?.isEmpty).toBe(false)
  })
  it('없는 학기 404 TERM_NOT_FOUND, 없는 캠퍼스-층 404 CAMPUS_FLOOR_NOT_FOUND', async () => {
    expect(await codeOf(B.field(id('1999 상반기'), id('서울|2')))).toBe('TERM_NOT_FOUND')
    expect(await codeOf(B.field(id(CUR), id('서울|99')))).toBe('CAMPUS_FLOOR_NOT_FOUND')
    expect(await codeOf(B.fieldStatuses(id('1999 상반기')))).toBe('TERM_NOT_FOUND')
  })
  it('실제 서버 모양(명세 응답 예시)도 같은 앱 모양으로', () => {
    const owner = (n: number, nick: string) => ({ id: n, nickname: nick, profileImageUrl: null, mole: { head: null, face: null, neck: null, hand: null }, campusName: '서울', generation: 14, floor: 2, isWithdrawn: false })
    const dto: FieldDto = {
      term: { id: 4, year: 2026, half: 2, isCurrent: true }, campusFloorId: 12, campusName: '서울', floor: 2,
      items: [
        { slot: 31, burrowId: 18, isMine: true, owner: owner(31, '두더지왕'), interests: [{ id: 12, name: '러닝', interestCategoryId: 3, isShared: false }], answers: [], intro: null },
        { slot: 7, burrowId: 27, isMine: false, owner: owner(52, '새벽산책'), interests: [{ id: 12, name: '러닝', interestCategoryId: 3, isShared: true }, { id: 61, name: '캠핑', interestCategoryId: 5, isShared: false }], answers: [{ slot: 1, introQuestionId: 8, question: '가장 좋아하는 운동 코스는?', answer: '한강' }], intro: '주말마다 달리고 캠핑 가는 14기입니다.' },
      ],
    }
    const vm = P.toField(dto)
    expect(P.placeId(vm.place)).toBe('4|12')
    expect(vm.residents.map((r) => r.seat)).toEqual([7, 31])
    expect(vm.mySeat).toBe(31)
    expect(vm.zones).toBe(2)
    expect(vm.residents[0]).toMatchObject({ burrowId: '27', shared: ['러닝'] })
    expect(vm.residents[0].user.qna).toEqual([{ q: 'Q1. 가장 좋아하는 운동 코스는?', a: '한강' }])
    // 방노트의 자기소개 (명세 05 dev 2862f69 KAN-46 items[].intro, 안 썼으면 null → 빈 칸)
    expect(vm.residents[0].user.intro).toBe('주말마다 달리고 캠핑 가는 14기입니다.')
    expect(vm.residents[1].user.intro).toBe('')
  })
  it('주소 값: 학기 id|캠퍼스-층 id (첫 | 로 나눔)', () => {
    expect(P.parsePlace('4|12')).toEqual({ termId: '4', campusFloorId: '12' })
    expect(P.parsePlace(`${CUR}|서울|2`)).toEqual({ termId: CUR, campusFloorId: '서울|2' })
    expect(P.parsePlace('잘못된값')).toBeNull()
    expect(P.exploreHrefOf({ termId: '4', campusFloorId: '12' }, 7)).toBe(`/burrow/explore?floor=${encodeURIComponent('4|12')}&seat=7`)
  })
})

describe('단골 (GET /me/regular-burrows · PUT · DELETE /burrows/{burrowId}/regular)', () => {
  it('담으면 목록 맨 앞, 다시 담아도 그대로(멱등), 빼면 사라지고 또 빼도 성공', async () => {
    const before = P.toRegulars(await B.regularBurrows())
    const kim = id('b-kim')
    expect(await B.addRegular(kim)).toEqual({ isRegular: true })
    expect(await B.addRegular(kim)).toEqual({ isRegular: true })
    const after = await B.regularBurrows()
    expect(after.items).toHaveLength(before.length + 1)
    expect(D.toAppId(after.items[0].owner.id)).toBe('kim')
    expect(isUtcInstant(after.items[0].createdAt)).toBe(true)
    expect(await B.removeRegular(kim)).toEqual({ isRegular: false })
    expect(await B.removeRegular(kim)).toEqual({ isRegular: false })
    expect((await B.regularBurrows()).items).toHaveLength(before.length)
  })
  it('내 땅굴은 403 OWN_BURROW_NOT_ALLOWED, 없는 땅굴은 404 BURROW_NOT_FOUND', async () => {
    expect(await codeOf(B.addRegular(id('b-me')))).toBe('OWN_BURROW_NOT_ALLOWED')
    expect(await codeOf(B.addRegular(id('b-nobody')))).toBe('BURROW_NOT_FOUND')
    expect(await codeOf(B.removeRegular(id('b-nobody')))).toBe('BURROW_NOT_FOUND')
  })
})

describe('오늘의 추천 (GET · POST /me/daily-recommendation)', () => {
  it('받기 전: hasReceived false · items [] · 오늘 날짜', async () => {
    const d = await B.dailyRecommendation()
    expect(d).toMatchObject({ hasReceived: false, items: [] })
    expect(isDateString(d.recommendedOn)).toBe(true)
  })
  it('없는 기수 400 INVALID_INPUT(generation), 없는 캠퍼스-층 404', async () => {
    try { await B.drawRecommendation({ campusFloorId: id('서울|2'), generation: 99 }); expect.unreachable() } catch (e) {
      expect(isApiError(e) && e.code).toBe('INVALID_INPUT')
      expect(isApiError(e) && e.fields?.[0].field).toBe('generation')
    }
    expect(await codeOf(B.drawRecommendation({ campusFloorId: id('서울|99'), generation: 16 }))).toBe('CAMPUS_FLOOR_NOT_FOUND')
  })
  it('받으면 최대 3명 · 관심사 3개(겹치는 것 먼저) · 답변, 같은 날 다시 보내면 조건이 달라도 처음 결과', async () => {
    const first = await B.drawRecommendation({ campusFloorId: id('서울|2'), generation: 16 })
    expect(first.hasReceived).toBe(true)
    expect(first.items.length).toBeGreaterThan(0)
    expect(first.items.length).toBeLessThanOrEqual(3)
    for (const f of first.items) {
      expect(f.interests.length).toBeLessThanOrEqual(3)
      const flags = f.interests.map((t) => t.isShared)
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a))) // true 가 앞
      expect(D.toAppId(f.owner.id)).not.toBe('me')
    }
    const again = await B.drawRecommendation({ campusFloorId: id('대전|1'), generation: 12 })
    expect(again.items.map((x) => x.owner.id)).toEqual(first.items.map((x) => x.owner.id))
    expect((await B.dailyRecommendation()).items.map((x) => x.owner.id)).toEqual(first.items.map((x) => x.owner.id))
    const vm = P.toDailyRecommendation(first)
    expect(vm.friends[0].tags).toHaveLength(first.items[0].interests.length)
    expect(vm.friends[0].qna.length).toBe(first.items[0].answers.length)
  })
})

describe('남의 땅굴 (GET /users/{userId}/burrow)', () => {
  it('주인 · 자기소개 · 관심사 · 답변 · 방명록 수 · 단골 · 대화 상태 · 입구', async () => {
    const dto = await B.userBurrow(id('yerin'))
    expect(dto.isMine).toBe(false)
    expect(['CHATTING', 'REQUEST_SENT', 'REQUEST_RECEIVED', 'NONE']).toContain(dto.chat.status)
    expect(dto.chat.chatRoomId === null).toBe(dto.chat.status !== 'CHATTING')
    const vm = P.toBurrow(dto)
    expect(vm.owner.id).toBe('yerin')
    expect(vm.owner.intro).toBe(dto.intro ?? '')
    expect(vm.shared).toEqual(dto.interests.filter((t) => t.isShared).map((t) => t.name))
    expect(vm.entrance.place).toEqual({ termId: CUR, campusFloorId: '서울|2' })
    expect(vm.entrance.seat).toBe(1)
  })
  it('내 계정이면 isMine · 단골 false · 대화 NONE, 없는 사람은 404 BURROW_NOT_FOUND', async () => {
    expect(await B.userBurrow(id('me'))).toMatchObject({ isMine: true, isRegular: false, chat: { status: 'NONE', chatRoomId: null } })
    expect(await codeOf(B.userBurrow(id('nobody')))).toBe('BURROW_NOT_FOUND')
  })
  it('지난 학기 들판에만 있는 사람(새 학기에 아직 안 들어옴)도 땅굴이 있음 → 입구는 지난 학기', async () => {
    const past = P.toField(await B.field(id(PAST), id('서울|12')))
    const r = past.residents.find((x) => !x.mine)!
    const vm = P.toBurrow(await B.userBurrow(id(r.user.id)))
    expect(vm.entrance).toEqual({ place: { termId: PAST, campusFloorId: '서울|12' }, seat: r.seat })
  })
})

describe('방명록 쓰기 (POST /burrows/{burrowId}/guestbook-entries) — 04 목록 · 지우기와 같은 저장소', () => {
  it('1 ~ 50자 · 공백만은 400 INVALID_INPUT(content), 내 땅굴은 403, 없는 땅굴은 404', async () => {
    expect(await codeOf(B.writeGuestbook(id('b-yerin'), '   '))).toBe('INVALID_INPUT')
    expect(await codeOf(B.writeGuestbook(id('b-yerin'), 'ㄱ'.repeat(51)))).toBe('INVALID_INPUT')
    expect(await codeOf(B.writeGuestbook(id('b-me'), '안녕'))).toBe('OWN_BURROW_NOT_ALLOWED')
    expect(await codeOf(B.writeGuestbook(id('b-nobody'), '안녕'))).toBe('BURROW_NOT_FOUND')
  })
  it('쓴 글은 canDelete true · canReport false, 목록 맨 위 · 글 수 + 1, 지우면 다시 빠짐', async () => {
    const before = (await B.userBurrow(id('yerin'))).guestbookCount
    const g = await B.writeGuestbook(id('b-yerin'), '가구 구경 잘 하고 가요')
    expect(g).toMatchObject({ content: '가구 구경 잘 하고 가요', canDelete: true, canReport: false })
    expect(isUtcInstant(g.createdAt)).toBe(true)
    expect((await B.userBurrow(id('yerin'))).guestbookCount).toBe(before + 1)
    // 주인의 방명록 목록(04 GET /burrows/{burrowId}/guestbook-entries)에 그대로 나옴
    const page = BP.toGuestbookPage(await BB.guestbookEntries(id('b-yerin'), { page: 1, size: 5 }))
    expect(page.items[0]).toMatchObject({ text: '가구 구경 잘 하고 가요', authorId: 'me', canDelete: true, canReport: false })
    expect(page.totalItems).toBe(before + 1)
    expect(await BB.deleteGuestbookEntry(g.id)).toBeNull()
    expect(await codeOf(BB.deleteGuestbookEntry(g.id))).toBe('GUESTBOOK_ENTRY_NOT_FOUND')
    expect((await B.userBurrow(id('yerin'))).guestbookCount).toBe(before)
  })
  it('방문자는 남이 쓴 글을 못 지움 (403 FORBIDDEN)', async () => {
    const page = await BB.guestbookEntries(id('b-yerin'), { page: 1, size: 5 })
    const other = page.items.find((x) => !x.canDelete)!
    expect(other.canReport).toBe(true)
    expect(await codeOf(BB.deleteGuestbookEntry(other.id))).toBe('FORBIDDEN')
  })
  it('방명록 글 신고 (POST /reports GUESTBOOK): 같은 저장소의 글을 확인 · 기록, 두 번째는 409, 내 글은 403', async () => {
    const C = (await import('../api/community/mock')).mock
    const page = await BB.guestbookEntries(id('b-yerin'), { page: 1, size: 5 })
    const other = page.items.find((x) => x.canReport)!
    expect(await C.createReport({ targetType: 'GUESTBOOK', targetId: other.id, reason: 'SPAM', detail: null })).toHaveProperty('reportId')
    expect(await codeOf(C.createReport({ targetType: 'GUESTBOOK', targetId: other.id, reason: 'SPAM', detail: null }))).toBe('ALREADY_REPORTED')
    const mine = await B.writeGuestbook(id('b-yerin'), '내 글')
    expect(await codeOf(C.createReport({ targetType: 'GUESTBOOK', targetId: mine.id, reason: 'SPAM', detail: null }))).toBe('OWN_TARGET_NOT_ALLOWED')
    expect(await codeOf(C.createReport({ targetType: 'GUESTBOOK', targetId: id('nope-gb9'), reason: 'SPAM', detail: null }))).toBe('REPORT_TARGET_NOT_FOUND')
  })
})

describe('대화 요청 보내기 (POST /chat-requests)', () => {
  it('내가 거절한 요청이 남은 사람에게 보내면 새 요청 대신 대화방이 바로 열림 (서버가 하는 일 7)', async () => {
    const chat = await import('../data/chat')
    chat.rejectRequest('q1') // seobeok 이 보낸 요청을 내가 거절해 둠
    const r = await B.sendChatRequest({ receiverId: id('seobeok'), message: '저도 드로잉 좋아해요' })
    expect(r).toMatchObject({ chatRequestId: null, createdAt: null, expiresAt: null })
    expect(r.chatRoomId).not.toBeNull()
    expect((await B.userBurrow(id('seobeok'))).chat).toMatchObject({ status: 'CHATTING', chatRoomId: r.chatRoomId })
  })
  it('NONE 인 사람에게 보내면 요청이 생기고(만료 5일) 땅굴 상태가 REQUEST_SENT, 또 보내면 409', async () => {
    const ids = ['kim', 'lee', 'park', 'choi', 'mingu', 'yejin', 'ha', 'seoyeon', 'seobeok', 'yerin']
    let target: string | null = null
    for (const u of ids) if ((await B.userBurrow(id(u))).chat.status === 'NONE') { target = u; break }
    expect(target).not.toBeNull()
    const r = await B.sendChatRequest({ receiverId: id(target!), message: null })
    expect(r.chatRoomId).toBeNull()
    expect(isUtcInstant(r.createdAt)).toBe(true)
    expect(Date.parse(r.expiresAt!) - Date.parse(r.createdAt!)).toBe(5 * 86_400_000)
    expect(P.toChatRequestResult(r).chatRequestId).not.toBeNull()
    expect((await B.userBurrow(id(target!))).chat.status).toBe('REQUEST_SENT')
    expect(await codeOf(B.sendChatRequest({ receiverId: id(target!), message: '또' }))).toBe('CHAT_REQUEST_ALREADY_SENT')
  })
  it('나에게 · 50자 넘는 인사는 400 INVALID_INPUT, 없는 사람은 404 USER_NOT_FOUND', async () => {
    expect(await codeOf(B.sendChatRequest({ receiverId: id('me'), message: null }))).toBe('INVALID_INPUT')
    expect(await codeOf(B.sendChatRequest({ receiverId: id('kim'), message: 'ㄱ'.repeat(51) }))).toBe('INVALID_INPUT')
    expect(await codeOf(B.sendChatRequest({ receiverId: id('nobody'), message: null }))).toBe('USER_NOT_FOUND')
  })
})

describe('새 학기 (POST /me/burrow/move · 403 NEW_TERM_INCOMPLETE)', () => {
  it('고르기 전에는 학기 목록 · 이사만 되고, 이사하면 이번 학기 들판의 다음 자리로 옮김 (두 번 불러도 한 번)', async () => {
    const mod = await import('../api/explore/mock')
    mod.startMockNewTerm()
    expect(await codeOf(B.field(id(CUR), id('서울|2')))).toBe('NEW_TERM_INCOMPLETE')
    expect(await codeOf(B.regularBurrows())).toBe('NEW_TERM_INCOMPLETE')
    expect((await B.terms()).items.length).toBe(2)
    // 지난 학기 들판에 내 땅굴이 남아 있음
    expect(await codeOf(B.moveBurrow({ campusFloorId: id('서울|99') }))).toBe('CAMPUS_FLOOR_NOT_FOUND')
    const moved = await B.moveBurrow({ campusFloorId: id('대전|1') })
    expect(moved.nextStep).toBe('HOME')
    const e = P.toMoved(moved)
    expect(e.place).toEqual({ termId: CUR, campusFloorId: '대전|1' })
    expect(e.seat).toBeGreaterThan(0)
    // 프로필의 캠퍼스 · 층도 바뀜 (GET /me 의 campusFloorId)
    expect(F.ME_HOME).toMatchObject({ campus: '대전', floor: 1 })
    // 이미 이사한 계정이 다시 부르면 본문을 보지 않고 지금 값
    expect(P.toMoved(await B.moveBurrow({ campusFloorId: id('서울|2') }))).toEqual(e)
    const field = P.toField(await B.field(id(CUR), id('대전|1')))
    expect(field.mySeat).toBe(e.seat)
    expect(field.residents.find((r) => r.mine)?.seat).toBe(e.seat)
    expect(P.toField(await B.field(id(CUR), id('서울|2'))).mySeat).toBeNull()
  })
})
