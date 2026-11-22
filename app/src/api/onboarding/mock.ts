/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) — 목 서버. data/interests.ts · data/questions.ts · data/myBurrow.ts
 */
import { badRequest, mockRead, mockWrite, notFound } from '../mock/server'
import { memberProfile, rawPerson } from '../common/mockPeople'
import { CATEGORIES } from '../../data/mock'
import { MAX_PICK, setMyInterests, subOf } from '../../data/interests'
import { nickTaken } from '../../data/myBurrow'
import { QUESTIONS } from '../../data/questions'
import type { OnboardingApi } from './real'

export const mock: OnboardingApi = {
  profile: (id, signal) => mockRead(() => { if (!rawPerson(id)) throw notFound('USER', '사용자를 찾을 수 없습니다.'); return memberProfile(id) }, { signal, detail: 'USER' }),
  nicknameAvailable: (nickname, signal) => mockRead(() => ({ available: !nickTaken(nickname) }), { signal }),
  updateInterests: (items) => mockWrite(() => {
    if (items.length < 3 || items.length > MAX_PICK) throw badRequest('INTEREST_COUNT', `관심사는 3~${MAX_PICK}개 골라 주세요.`)
    setMyInterests(items.map((x) => subOf(x.interestId)?.name_ko ?? x.interestId))
  }),
  interestCategories: (signal) => mockRead(() => CATEGORIES.map((c) => ({
    id: c.id, name: c.name, interests: c.tags.map((t) => ({ id: t.id, categoryId: c.id, name: t.name, memberCount: t.count })),
  })), { signal }),
  introQuestions: (signal) => mockRead(() => QUESTIONS.map((q) => ({ id: q.id, type: q.kind === 'tmi' ? 'TMI' : 'INTEREST', interestCategoryId: q.category ?? null, content: q.text })), { signal }),
}
