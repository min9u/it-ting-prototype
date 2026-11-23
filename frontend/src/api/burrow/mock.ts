/**
 * 04 내 땅굴 — 목 서버 (명세 모양 그대로).
 * "DB": data/myBurrow(닉네임 · 자기소개 · 질문 답 · 캠퍼스 · 층 · 단골 수) · data/interests(내 관심사) · data/moleItems(내 두더지) ·
 *       data/guestbookStore(방명록, 05 방문자 쪽과 같은 저장소) · data/field(땅굴 입구)
 * 목 id: 땅굴 id = 주인 사용자 id (toDtoId('me')), 캠퍼스-층 = '서울|2' (common 목과 같음), 질문 = 'music-1' …
 */
import { ME_ID } from '../../data/mock'
import { CAMPUS_FLOORS, ME_HOME, locateUser, moveMyBurrow } from '../../data/field'
import { setMyInterests } from '../../data/interests'
import { setMyWorn } from '../../data/moleItems'
import { MY_REGULARS_COUNT, getMyProfile, nickTaken, qnaOf, setMyProfile } from '../../data/myBurrow'
import { findGuestbookEntry, guestbookCountOf, ownerOfBurrow, removeGuestbookEntry, reportGuestbookEntry, visibleGuestbookOf } from '../../data/guestbookStore'
import { isGuestbookHidden } from '../../lib/format'
import { registerMockReportTarget } from '../community/mock'
import { parseIso, toIso } from '../../lib/time'
import { RULES, lengthOf } from '../../lib/validation'
import { forbidden, invalidInput, mockRead, mockWrite, notFound } from '../mock/server'
import { toAppId, toDtoId } from '../common/ids'
import { interestTags, rawPerson } from '../common/mockPeople'
import type { FieldError, PageDto } from '../common/types'
import { userDisplayDto } from '../onboarding/mock'
import {
  answersErrors, interestIdsError, interestNamesOf, moleErrors, nicknameError, questionsOf, throwIfInvalid, throwIfNicknameTaken, wornFromMole,
} from '../onboarding/mockRules'
import { GUESTBOOK_PAGE_SIZE, type BurrowApi } from './real'
import type { GuestbookEntryDto, MyBurrowDto } from './types'


/** 지금 내 땅굴 (목 저장소 → 명세 모양) */
export function myBurrowDto(): MyBurrowDto {
  const p = getMyProfile()
  const spot = locateUser(ME_ID)
  const campusFloorId = toDtoId(`${p.campus}|${p.floor}`)
  return {
    burrowId: toDtoId(ME_ID),
    owner: { ...userDisplayDto(ME_ID), nickname: p.nickname, campusName: p.campus, generation: ME_HOME.gen, floor: p.floor },
    campusFloorId,
    intro: p.intro.trim() || null,
    interests: interestTags(ME_ID, ME_ID),
    answers: qnaOf(p.qna).map((x, i) => ({ slot: i + 1, introQuestionId: toDtoId(x.q.id), question: x.q.text, answer: x.a })),
    regularCount: MY_REGULARS_COUNT,
    guestbookCount: guestbookCountOf(ME_ID),
    entrance: { termId: toDtoId(spot?.floor.term ?? '2026 하반기'), campusFloorId, slot: spot?.seat ?? 1 },
  }
}

/** 방명록 글 → DTO (보는 사람 = 나) */
function entryDto(g: { id: string; authorId: string; text: string; createdAt: string }, ownerId: string): GuestbookEntryDto {
  const mine = g.authorId === ME_ID
  const owner = ownerId === ME_ID
  return {
    id: toDtoId(g.id), author: userDisplayDto(g.authorId), content: g.text, createdAt: toIso(parseIso(g.createdAt)),
    canDelete: owner || mine, canReport: !mine,
  }
}

/** 명세의 페이지 모양 (글이 없으면 totalPages 0) */
function page<T>(all: T[], pageNo = 1, size = GUESTBOOK_PAGE_SIZE): PageDto<T> {
  const totalItems = all.length
  const totalPages = Math.ceil(totalItems / size)
  const p = Math.max(1, pageNo)
  return { items: all.slice((p - 1) * size, p * size), page: p, size, totalItems, totalPages }
}

const campusFloorOf = (appId: string) => {
  const [campus, fl] = appId.split('|')
  return CAMPUS_FLOORS.some((c) => c.campus === campus && c.floors.includes(Number(fl))) ? { campus, floor: Number(fl) } : null
}

export const mock: BurrowApi = {
  myBurrow: (signal) => mockRead(myBurrowDto, { signal }),

  updateMole: (body) => mockWrite(() => {
    throwIfInvalid(moleErrors(body, ''))
    setMyWorn(wornFromMole(body))
    return { head: body.head, face: body.face, neck: body.neck, hand: body.hand }
  }),

  updateProfile: (body) => mockWrite(() => {
    // 1 모양: 다섯 값이 모두 있는지 + 칸마다 규칙 (어긋난 것 모두)
    const fields: FieldError[] = []
    for (const k of ['nickname', 'campusFloorId', 'interestIds', 'answers', 'intro'] as const) if (!body || !(k in body)) fields.push({ field: k, message: '빠졌습니다.' })
    throwIfInvalid(fields)
    const nick = nicknameError(body.nickname)
    if (nick) fields.push({ field: 'nickname', message: nick })
    const ints = interestIdsError(body.interestIds)
    if (ints) fields.push({ field: 'interestIds', message: ints })
    fields.push(...answersErrors(body.answers))
    if (body.intro != null && (typeof body.intro !== 'string' || lengthOf(body.intro.trim()) > RULES.intro.max)) fields.push({ field: 'intro', message: `${RULES.intro.max}자 이하로 써야 합니다.` })
    throwIfInvalid(fields)
    // 2 ~ 4 있는 값인지 (404)
    const cf = campusFloorOf(toAppId(body.campusFloorId))
    if (!cf) throw notFound('CAMPUS_FLOOR', '캠퍼스-층을 찾을 수 없습니다.')
    const names = interestNamesOf(body.interestIds)
    const qs = questionsOf(body.answers)
    // 5 닉네임 (지금 내 닉네임은 빼고)
    throwIfNicknameTaken(nickTaken(body.nickname, getMyProfile().nickname))
    // 6 저장. 캠퍼스-층이 바뀌면 이번 학기 들판의 입구도 옮겨짐 (명세 04 내 정보 수정 2 → 05 목의 이사와 같은 moveMyBurrow)
    const before = getMyProfile()
    if (before.campus !== cf.campus || before.floor !== cf.floor) moveMyBurrow(cf.campus, cf.floor)
    setMyProfile({
      nickname: body.nickname.trim(), intro: body.intro?.trim() ?? '',
      qna: qs.map((q, i) => ({ qid: q.id, a: body.answers[i].answer.trim() })), campus: cf.campus, floor: cf.floor,
    })
    setMyInterests(names)
    return myBurrowDto()
  }),

  guestbookEntries: (burrowId, q = {}, signal) => mockRead(() => {
    const owner = ownerOfBurrow(toAppId(burrowId))
    if (!rawPerson(owner)) throw notFound('BURROW', '땅굴을 찾을 수 없습니다.')
    // 명세 04 (KAN-45): page 1 이상, size 1 ~ 20. 글이 있는 페이지를 넘으면 빈 목록 (오류 아님)
    const pg = q.page ?? 1, size = q.size ?? GUESTBOOK_PAGE_SIZE
    if (!Number.isInteger(pg) || pg < 1) throw invalidInput({ page: '1 이상이어야 합니다.' })
    if (!Number.isInteger(size) || size < 1 || size > 20) throw invalidInput({ size: '1 ~ 20 사이여야 합니다.' })
    const list = visibleGuestbookOf(owner)
    return page(list.map((g) => entryDto(g, owner)), q.page ?? 1, q.size ?? GUESTBOOK_PAGE_SIZE)
  }, { signal, empty: () => page([], 1, q.size ?? GUESTBOOK_PAGE_SIZE) }),

  deleteGuestbookEntry: (guestbookEntryId) => mockWrite(() => {
    const hit = findGuestbookEntry(toAppId(guestbookEntryId))
    if (!hit || isGuestbookHidden(hit.entry)) throw notFound('GUESTBOOK_ENTRY', '방명록 글을 찾을 수 없습니다.')
    if (hit.ownerId !== ME_ID && hit.entry.authorId !== ME_ID) throw forbidden('이 글을 지울 수 없습니다.')
    removeGuestbookEntry(hit.entry.id)
    return null
  }),
}

/**
 * 방명록 글 신고의 대상 확인 · 기록 (POST /reports targetType GUESTBOOK, 08 커뮤니티 목 서버에 끼움).
 * 없거나 가려진 글 404, 내 글 403, 이미 신고 409. 서로 다른 3명이면 가려져 목록 · 글 수에서 빠짐
 */
registerMockReportTarget('GUESTBOOK', (id) => reportGuestbookEntry(id, ME_ID))
