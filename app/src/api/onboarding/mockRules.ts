/**
 * 목 서버가 온보딩 확정(POST /me/onboarding/complete)과 내 정보 저장(PATCH /me/profile)에서 같이 쓰는 검사.
 * 실제 서버의 "서버가 하는 일" 순서와 같다: 모양(400 INVALID_INPUT + fields 모두) → 관심사 404 → 질문 404 → 닉네임 409
 * (burrow/mock.ts 도 이 파일을 쓴다. 두 영역 모두 온보딩 · 내 땅굴 작업자 몫)
 */
import { MAX_PICK, subOf } from '../../data/interests'
import { QUESTIONS, type Question } from '../../data/questions'
import { NICKNAME_CHARS, RULES } from '../../lib/validation'
import { conflict, invalidInput, notFound } from '../mock/server'
import { interestCodeOfSeed } from '../mock/seedIds'
import { toAppId } from '../common/ids'
import type { FieldError, Id, MoleDto } from '../common/types'
import { MOLE_CODE, itemIdOfCode } from '../common/moleCodes'
import type { AnswerRequest } from './types'

const MIN_PICK = 3

/** 닉네임 모양 (1 ~ 12자). 앞뒤 공백 처리는 구현 단계로 넘겼으므로 목은 잘라서 셈 */
export function nicknameError(nickname: unknown): string | null {
  if (typeof nickname !== 'string' || !nickname.trim()) return '닉네임을 입력해야 합니다.'
  // 명세 03 "닉네임 규칙"(KAN-44): 앞뒤 공백을 지운 뒤 한글 · 영어 · 숫자로 1 ~ 12자
  const n = nickname.trim()
  if ([...n].length > RULES.nickname.max) return `${RULES.nickname.max}자 이하로 써야 합니다.`
  if (!NICKNAME_CHARS.test(n)) return '한글, 영어, 숫자만 쓸 수 있습니다.'
  return null
}

/** 두더지 네 부위 모양 */
export function moleErrors(mole: unknown, prefix: string): FieldError[] {
  if (!mole || typeof mole !== 'object') return [{ field: prefix || 'mole', message: '두더지 네 부위를 모두 보내야 합니다.' }]
  const m = mole as Partial<MoleDto>
  const out: FieldError[] = []
  for (const k of ['head', 'face', 'neck', 'hand'] as const) {
    const f = prefix ? `${prefix}.${k}` : k
    if (!(k in m)) out.push({ field: f, message: '빠졌습니다.' })
    else if (m[k] != null && (typeof m[k] !== 'string' || !MOLE_CODE.test(m[k] as string))) out.push({ field: f, message: '영어 대문자 · 숫자 · 밑줄 30자 이하로 써야 합니다.' })
  }
  return out
}

/** 관심사 개수 · 겹침 */
export function interestIdsError(ids: unknown): string | null {
  if (!Array.isArray(ids) || ids.length < MIN_PICK || ids.length > MAX_PICK) return `${MIN_PICK}개 이상 ${MAX_PICK}개 이하로 골라야 합니다.`
  if (new Set(ids).size !== ids.length) return '같은 관심사를 두 번 넣을 수 없습니다.'
  return null
}

/** 답변 3개 · 질문 겹침 · 답변 길이 */
export function answersErrors(answers: unknown): FieldError[] {
  if (!Array.isArray(answers) || answers.length !== 3) return [{ field: 'answers', message: '질문과 답변을 정확히 3개 보내야 합니다.' }]
  const out: FieldError[] = []
  const qids = (answers as AnswerRequest[]).map((a) => a?.introQuestionId)
  if (new Set(qids).size !== qids.length) out.push({ field: 'answers', message: '세 질문이 서로 달라야 합니다.' })
  ;(answers as AnswerRequest[]).forEach((a, i) => {
    const t = typeof a?.answer === 'string' ? a.answer.trim() : ''
    // 이모지도 한 자로 센다 (명세 03, DB CHAR_LENGTH 와 같은 기준 → 코드 포인트 수)
    const len = [...t].length
    if (len < RULES.answer.min || len > RULES.answer.max) out.push({ field: `answers[${i}].answer`, message: `${RULES.answer.min}자 이상 ${RULES.answer.max}자 이하로 써야 합니다.` })
  })
  return out
}

/** 모양 오류가 하나라도 있으면 400 INVALID_INPUT (fields 에 모두) */
export function throwIfInvalid(fields: FieldError[]) {
  // 명세 03: fields 는 field 이름 순
  if (fields.length) throw invalidInput([...fields].sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : 0)))
}

/** interestIds(처음 값 id, api/mock/seedIds) → 앱 관심사 이름 (없는 관심사면 404 INTEREST_NOT_FOUND) */
export function interestNamesOf(ids: Id[]): string[] {
  return ids.map((id) => {
    const s = subOf(interestCodeOfSeed(id) ?? '')
    if (!s) throw notFound('INTEREST', '관심사를 찾을 수 없습니다.')
    return s.name_ko
  })
}

/** introQuestionId(목 번호) → 목 질문 (없는 질문이면 404 INTRO_QUESTION_NOT_FOUND) */
export function questionsOf(answers: AnswerRequest[]): Question[] {
  return answers.map((a) => {
    const q = QUESTIONS.find((x) => x.id === toAppId(a.introQuestionId))
    if (!q) throw notFound('INTRO_QUESTION', '질문을 찾을 수 없습니다.')
    return q
  })
}

/** 닉네임이 다른 사람 것과 겹치면 409 NICKNAME_DUPLICATED */
export function throwIfNicknameTaken(taken: boolean) {
  if (taken) throw conflict('NICKNAME_DUPLICATED', '이미 사용 중인 닉네임입니다.')
}

/** 응답 mole → 입은 아이템 (목 저장소에 넣을 값) */
export const wornFromMole = (m: MoleDto) => [m.head, m.face, m.neck, m.hand].map(itemIdOfCode).filter((x): x is string => !!x)
