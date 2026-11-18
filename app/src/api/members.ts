/**
 * 회원 · 프로필 · 관심사 · 추천 (F3 · F4 · F5 · F10). 계약: docs/backend/api-draft.md "회원", "관심사", "추천"
 * 목 구현: data/myBurrow.ts(내 프로필) · data/interests.ts · data/moleItems.ts · data/field.ts(추천) · data/account.ts
 */
import { API_MODE } from './config'
import { http } from './client'
import { badRequest, conflict, mockRead, mockWrite, notFound } from './mock/server'
import { memberProfile, moleOf, rawPerson } from './mock/serialize'
import { CATEGORIES, ME_ID } from '../data/mock'
import { INTEREST_SUBS, MAX_PICK, setMyInterests, subOf } from '../data/interests'
import { MAX_WORN, itemOf, setMyWorn } from '../data/moleItems'
import { NICK_MAX, nickTaken, setMyProfile } from '../data/myBurrow'
import { QUESTIONS } from '../data/questions'
import { accountStore, blockUser, unblockUser, withdraw as withdrawAccount } from '../data/account'
import { drawRecommendations, getRecommendSettings, setRecommendSettings, todaysPicks } from '../data/field'
import { seoulYmd } from '../lib/time'
import type {
  DailyRecommendationDto, Id, InterestCategoryDto, IntroQuestionDto, MemberProfileDto, MemberSummaryDto, MoleLookDto, RecommendSettingDto,
} from './types'

export interface ProfilePatch {
  nickname?: string
  intro?: string | null
  /** 질문 3개와 답 (slot 1~3) */
  answers?: { slot: number; questionId: Id; answer: string }[]
  campusFloorId?: Id
}

const real = {
  /** GET /members/{id} — 프로필 팝업 (탈퇴 404 MEMBER_NOT_FOUND) */
  profile: (id: Id, signal?: AbortSignal) => http.get<MemberProfileDto>(`/members/${id}`, undefined, signal),
  /** PATCH /me/profile — 닉네임·자기소개·질문·캠퍼스-층 (409 NICKNAME_TAKEN) */
  updateProfile: (p: ProfilePatch) => http.patch<MemberProfileDto>('/me/profile', p),
  /** GET /nicknames/{nickname}/availability */
  nicknameAvailable: (nickname: string, signal?: AbortSignal) => http.get<{ available: boolean }>(`/nicknames/${encodeURIComponent(nickname)}/availability`, undefined, signal),
  /** PUT /me/mole — 두더지 꾸미기 (부위마다 하나, 관심사 잠금은 서버도 검사) */
  updateMole: (look: MoleLookDto) => http.put<MoleLookDto>('/me/mole', look),
  /** PUT /me/interests — 관심사 (순서 = sort_order, 맨 앞이 대표). 3~10개 */
  updateInterests: (items: { interestId: Id; furniture: string | null }[]) => http.put<void>('/me/interests', { items }),
  /** GET /interest-categories — 대분류 12 + 소분류 90 (2026-11-18 확정본, docs/backend/interest-enum.md) */
  interestCategories: (signal?: AbortSignal) => http.get<InterestCategoryDto[]>('/interest-categories', undefined, signal),
  /** GET /intro-questions */
  introQuestions: (signal?: AbortSignal) => http.get<IntroQuestionDto[]>('/intro-questions', undefined, signal),
  /** 차단 (ERD 에 차단 테이블 없음 → erd-gaps) */
  blocked: (signal?: AbortSignal) => http.get<(MemberSummaryDto & { blockedAt: string })[]>('/me/blocks', undefined, signal),
  block: (memberId: Id) => http.put<void>(`/me/blocks/${memberId}`),
  unblock: (memberId: Id) => http.delete<void>(`/me/blocks/${memberId}`),
  /** DELETE /me — 회원 탈퇴 (사유 선택) */
  withdraw: (reason: string | null) => http.delete<void>('/me', { body: { reason } }),
  /** 오늘의 추천 친구 */
  recommendSetting: (signal?: AbortSignal) => http.get<RecommendSettingDto>('/me/recommend-setting', undefined, signal),
  updateRecommendSetting: (s: RecommendSettingDto) => http.put<RecommendSettingDto>('/me/recommend-setting', s),
  /** GET /me/recommendations/today — 아직 안 받았으면 404 NOT_DRAWN */
  todayRecommendation: (signal?: AbortSignal) => http.get<DailyRecommendationDto>('/me/recommendations/today', undefined, signal),
  /** POST /me/recommendations/today — 하루 한 번 (409 ALREADY_DRAWN) */
  drawRecommendation: () => http.post<DailyRecommendationDto>('/me/recommendations/today'),
}
export type MembersApi = typeof real

/* ===== 목 서버 ===== */
const recSetting = (): RecommendSettingDto => {
  const s = getRecommendSettings()
  return {
    useInterest: s.interests.length > 0, interestIds: s.interests.map((n) => subOf(n)?.id ?? n),
    useSameQuestion: s.sameQuestionFirst, questionIds: s.question ? [s.question] : [],
    useAffiliation: s.sameCampus || s.sameGen || s.sameFloor, sameCampus: s.sameCampus, sameGeneration: s.sameGen, sameFloor: s.sameFloor,
  }
}
const daily = (ids: string[]): DailyRecommendationDto => ({ recommendedOn: seoulYmd(Date.now()), members: ids.map(memberProfile) })

const mock: MembersApi = {
  profile: (id, signal) => mockRead(() => { if (!rawPerson(id)) throw notFound('사용자'); return memberProfile(id) }, { signal, detail: true }),
  updateProfile: (p) => mockWrite(() => {
    if (p.nickname != null) {
      if (!p.nickname.trim() || p.nickname.length > NICK_MAX) throw badRequest('INVALID_NICKNAME', `닉네임은 1~${NICK_MAX}자로 정해 주세요.`)
      if (nickTaken(p.nickname)) throw conflict('NICKNAME_TAKEN', '이미 쓰는 닉네임이에요.')
    }
    setMyProfile({
      ...(p.nickname != null ? { nickname: p.nickname } : {}), ...(p.intro !== undefined ? { intro: p.intro ?? '' } : {}),
      ...(p.answers ? { qna: p.answers.map((a) => ({ qid: a.questionId, a: a.answer })) } : {}),
      ...(p.campusFloorId ? { campus: p.campusFloorId.split('|')[0], floor: Number(p.campusFloorId.split('|')[1]) } : {}),
    })
    return memberProfile(ME_ID)
  }),
  nicknameAvailable: (nickname, signal) => mockRead(() => ({ available: !nickTaken(nickname) }), { signal }),
  updateMole: (look) => mockWrite(() => {
    const ids = [look.head, look.face, look.neck, look.hand].filter((x): x is string => !!x)
    if (ids.length > MAX_WORN || ids.some((id) => !itemOf(id))) throw badRequest('INVALID_ITEM', '고를 수 없는 꾸미기예요.')
    setMyWorn(ids)
    return moleOf(ids)
  }),
  updateInterests: (items) => mockWrite(() => {
    if (items.length < 3 || items.length > MAX_PICK) throw badRequest('INTEREST_COUNT', `관심사는 3~${MAX_PICK}개 골라 주세요.`)
    setMyInterests(items.map((x) => subOf(x.interestId)?.name_ko ?? x.interestId))
  }),
  interestCategories: (signal) => mockRead(() => CATEGORIES.map((c) => ({
    id: c.id, name: c.name, interests: c.tags.map((t) => ({ id: t.id, categoryId: c.id, name: t.name, memberCount: t.count })),
  })), { signal }),
  introQuestions: (signal) => mockRead(() => QUESTIONS.map((q) => ({ id: q.id, type: q.kind === 'tmi' ? 'TMI' : 'INTEREST', interestCategoryId: q.category ?? null, content: q.text })), { signal }),
  blocked: (signal) => mockRead(() => accountStore.get().blocked.map((b) => ({ ...memberProfile(b.id), id: b.id, nickname: b.nickname, status: 'ACTIVE' as const, blockedAt: b.blockedAt })), { signal, empty: () => [] }),
  block: (memberId) => mockWrite(() => { const u = rawPerson(memberId); blockUser({ id: memberId, nickname: u?.nickname ?? '두더지' }) }),
  unblock: (memberId) => mockWrite(() => unblockUser(memberId)),
  withdraw: (reason) => mockWrite(() => withdrawAccount(reason)),
  recommendSetting: (signal) => mockRead(recSetting, { signal }),
  updateRecommendSetting: (s) => mockWrite(() => {
    const cur = getRecommendSettings()
    setRecommendSettings({
      ...cur, interests: s.interestIds.map((id) => INTEREST_SUBS.find((x) => x.id === id)?.name_ko ?? id), question: s.questionIds[0] ?? null,
      sameQuestionFirst: s.useSameQuestion, sameCampus: s.sameCampus, sameGen: s.sameGeneration, sameFloor: s.sameFloor,
    })
    return recSetting()
  }),
  todayRecommendation: (signal) => mockRead(() => { const p = todaysPicks(); if (!p) throw notFound('오늘의 추천'); return daily(p) }, { signal }),
  drawRecommendation: () => mockWrite(() => { if (todaysPicks()) throw conflict('ALREADY_DRAWN', '오늘은 이미 추천을 받았어요.'); return daily(drawRecommendations()) }),
}

export const members: MembersApi = API_MODE === 'real' ? real : mock
