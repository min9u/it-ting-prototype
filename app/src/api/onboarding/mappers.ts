/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) DTO → 앱 모양. 화면은 이 결과만 쓴다.
 * 관심사 id ↔ 앱 코드는 ./interestMap.ts (이름으로 잇기)
 */
import { questionOf as localQuestion, type Question } from '../../data/questions'
import { toAppId } from '../common/ids'
import { toPersonFromDisplay, type Person } from '../common/mappers'
import type { ItemsDto } from '../common/types'
import { wornOfMole } from '../common/moleCodes'
import { appInterestName, categoryCodeOfId, type InterestCatalog } from './interestMap'
import type { IntroQuestionDto, UserProfileDto } from './types'

export * from './interestMap'

/* ===== 자기소개 질문 ===== */
/** 서버 질문에 예시 답변이 없을 때 입력칸 안내 */
export const ANSWER_PLACEHOLDER = '10자 이상 50자 이하로 답해 주세요'

/**
 * GET /intro-questions → 앱 질문 (data/questions Question 모양).
 * - id: 앱 id 글자 (목 서버면 'music-1' 같은 원래 id, 실제 서버면 '5')
 * - category: 대분류 코드 (관심사 목록을 받았으면 그 표로, 아니면 목 번호를 되돌려 봄)
 * - ex(예시 답변): 서버가 주지 않음. 목 데이터에 같은 id 가 있으면 그 예시, 없으면 공통 안내
 */
export function toQuestions(dto: ItemsDto<IntroQuestionDto>, catalog?: InterestCatalog | null): Question[] {
  return dto.items.map((q) => {
    const id = toAppId(q.id)
    const local = localQuestion(id)
    const category = q.type === 'INTEREST' ? categoryCodeOfId(q.interestCategoryId, catalog) ?? undefined : undefined
    return { id, text: q.content, kind: q.type === 'TMI' ? 'tmi' : 'interest', ...(category ? { category } : {}), ex: local?.text === q.content ? local.ex : ANSWER_PLACEHOLDER }
  })
}

/* ===== 프로필 팝업 ===== */
export interface ProfileVM {
  person: Person
  /** 고른 순서(첫 번째가 대표), 앱 이름 */
  interests: string[]
  /** 나와 겹치는 관심사 (앱 이름) */
  shared: string[]
}
export function toProfile(d: UserProfileDto): ProfileVM {
  const person = toPersonFromDisplay(d.user, d.interests)
  const interests = d.interests.map((i) => appInterestName(i.name))
  // 두더지 코드는 대문자(명세) → 앱 아이템 id 로 (common/moleCodes)
  return { person: { ...person, interests, worn: wornOfMole(d.user.mole) }, interests, shared: d.interests.filter((i) => i.isShared).map((i) => appInterestName(i.name)) }
}

/* ===== 두더지 ===== */
/** toMoleDto: 입은 아이템 id 목록 → 요청 본문 mole (대문자 코드) · wornOfMole: 응답 mole → 입은 아이템 id (모르는 코드는 "없음") */
export { moleDto as toMoleDto, wornOfMole, moleCodeOf, itemIdOfCode, MOLE_CODE } from '../common/moleCodes'
