/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) — 목 서버 (명세 모양 그대로).
 * "DB": data/mock CATEGORIES(관심사 + 목 인원수) · data/questions QUESTIONS · data/myBurrow(닉네임 · 질문 답) ·
 *        data/interests(내 관심사) · data/moleItems(내 두더지)
 * id: 대분류 · 세부 관심사는 백엔드 처음 값과 같은 번호(00 공통 5 표 순서, api/mock/seedIds.ts). 앱은 이름으로 잇는다.
 *     질문은 앱 코드(music-1)를 toDtoId 로 목 번호로 (앱 쪽 toAppId 로 되돌아옴). 순서는 대분류 표 순서 → TMI (백엔드 처음 값과 같은 순서)
 */
import { setMockNextStep } from '../../data/auth'
import { CATEGORIES, ME_ID } from '../../data/mock'
import { setMyInterests } from '../../data/interests'
import { setMyWorn } from '../../data/moleItems'
import { getMyProfile, nickTaken, resetMyRoom, setMyProfile } from '../../data/myBurrow'
import { QUESTIONS } from '../../data/questions'
import { toIso } from '../../lib/time'
import { badRequest, invalidInput, items, mockRead, mockWrite, notFound } from '../mock/server'
import { toAppId, toDtoId } from '../common/ids'
import { categorySeedId, interestSeedId } from '../mock/seedIds'
import { interestTags, rawPerson, userDisplay } from '../common/mockPeople'
import type { FieldError, UserDisplayDto } from '../common/types'
import { getMyWorn } from '../../data/moleItems'
import { moleDto } from '../common/moleCodes'
import {
  answersErrors, interestIdsError, interestNamesOf, moleErrors, nicknameError, questionsOf, throwIfInvalid, throwIfNicknameTaken, wornFromMole,
} from './mockRules'
import type { OnboardingApi } from './real'

/** 사용자 표시 (명세: 두더지 코드는 대문자). common/mockPeople userDisplay 의 mole 만 대문자 코드로 바꿈 */
export function userDisplayDto(appId: string): UserDisplayDto {
  const d = userDisplay(appId)
  if (d.isWithdrawn) return d
  const worn = appId === ME_ID ? getMyWorn() : rawPerson(appId)?.worn ?? []
  return { ...d, mole: moleDto(worn) }
}

export const mock: OnboardingApi = {
  interestCategories: (signal) => mockRead(() => items(CATEGORIES.map((c) => ({
    id: categorySeedId(c.id), name: c.name,
    interests: c.tags.map((t) => ({ id: interestSeedId(t.id), name: t.name, userCount: t.count })),
  }))), { signal }),

  introQuestions: (type, signal) => mockRead(() => {
    if (type && type !== 'INTEREST' && type !== 'TMI') throw invalidInput({ type: 'INTEREST, TMI 가운데 하나여야 합니다.' })
    // 백엔드 처음 값의 순서(id 순): 관심사 질문(대분류 표 순서) → TMI
    const order = (q: (typeof QUESTIONS)[number]) => (q.kind === 'tmi' || !q.category ? 1000 : Number(categorySeedId(q.category)))
    const all = [...QUESTIONS].sort((a, b) => order(a) - order(b)).map((q) => ({
      id: toDtoId(q.id), type: q.kind === 'tmi' ? 'TMI' as const : 'INTEREST' as const,
      interestCategoryId: q.kind === 'tmi' || !q.category ? null : categorySeedId(q.category), content: q.text,
    }))
    return items(type ? all.filter((q) => q.type === type) : all)
  }, { signal }),

  userProfile: (userId, signal) => mockRead(() => {
    const id = toAppId(userId)
    if (!rawPerson(id)) throw notFound('USER', '사용자를 찾을 수 없습니다.')
    return { user: userDisplayDto(id), interests: interestTags(id) }
  }, { signal, detail: 'USER' }),

  checkNickname: (nickname) => mockWrite(() => {
    const bad = nicknameError(nickname)
    if (bad) throw invalidInput({ nickname: bad })
    // 요청한 사람 자신의 지금 닉네임은 뺀다 (내 정보 수정에서 그대로 둘 때)
    throwIfNicknameTaken(nickTaken(nickname, getMyProfile().nickname))
    return { expiresAt: toIso(Date.now() + 5 * 60_000) }
  }),

  completeOnboarding: (body) => mockWrite(() => {
    if (!body || typeof body !== 'object') throw badRequest('INVALID_INPUT', '본문이 없습니다.')
    // 1 모양 (어긋난 것 모두)
    const fields: FieldError[] = []
    const nick = nicknameError(body.nickname)
    if (nick) fields.push({ field: 'nickname', message: nick })
    fields.push(...moleErrors(body.mole, 'mole'))
    const ints = interestIdsError(body.interestIds)
    if (ints) fields.push({ field: 'interestIds', message: ints })
    fields.push(...answersErrors(body.answers))
    throwIfInvalid(fields)
    // 2 관심사 · 질문이 있는지 (404)
    const names = interestNamesOf(body.interestIds)
    const qs = questionsOf(body.answers)
    // 3 닉네임 (409). 목은 "맡아 두기"를 따로 흉내 내지 않음: 목 사용자 닉네임과 겹치면 실패
    throwIfNicknameTaken(nickTaken(body.nickname))
    // 4 저장 (목 저장소). 새로 시작하므로 꾸민 방 값도 비움
    setMyProfile({ nickname: body.nickname.trim(), intro: '', qna: qs.map((q, i) => ({ qid: q.id, a: body.answers[i].answer.trim() })) })
    setMyWorn(wornFromMole(body.mole))
    setMyInterests(names)
    resetMyRoom()
    // 5 세션의 다음 단계가 HOME 으로 (목 세션 = data/auth). 안 하면 LOGIN_FREE = false 일 때 가드가 온보딩 1 로 되돌림
    setMockNextStep('HOME')
    return { userId: toDtoId(ME_ID), nextStep: 'HOME' as const, burrowId: toDtoId(ME_ID) }
  }),
}
