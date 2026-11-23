/**
 * 팀 명세 dev 35d107a 반영 (2026-11-23): 닉네임 규칙(KAN-44) · 답변 글자 수(이모지 한 자) · fields 이름 순 · 게시판 이름
 */
import { describe, expect, it } from 'vitest'
import { answersErrors, nicknameError, throwIfInvalid } from '../api/onboarding/mockRules'
import { nicknameCharsMessage } from '../lib/validation'
import { NOTICE_KINDS } from '../data/notifications'
import { isApiError } from '../api/client'

describe('닉네임 규칙: 앞뒤 공백을 지운 뒤 한글 · 영어 · 숫자로 1 ~ 12자', () => {
  it('한글 · 영어 · 숫자는 통과, 앞뒤 공백은 지움', () => {
    expect(nicknameError('  두더지Mole7  ')).toBeNull()
    expect(nicknameCharsMessage('  두더지Mole7  ')).toBeNull()
  })
  it('공백 · 기호 · 이모지는 안 됨', () => {
    for (const n of ['두 더지', 'mole_1', '두더지!', '두더지🐹']) {
      expect(nicknameError(n)).not.toBeNull()
      expect(nicknameCharsMessage(n)).toBe('한글, 영어, 숫자만 쓸 수 있어요')
    }
  })
  it('13자는 안 됨', () => { expect(nicknameError('가'.repeat(13))).not.toBeNull() })
})

describe('답변 길이: 이모지도 한 자로 셈', () => {
  const a = (answer: string, id = 1) => ({ introQuestionId: id, answer })
  it('이모지 10개 = 10자 (통과)', () => {
    expect(answersErrors([a('🐹'.repeat(10), 1), a('가'.repeat(10), 2), a('나'.repeat(10), 3)])).toEqual([])
  })
  it('이모지 51개 = 51자 (실패)', () => {
    expect(answersErrors([a('🐹'.repeat(51), 1), a('가'.repeat(10), 2), a('나'.repeat(10), 3)]).map((f) => f.field)).toEqual(['answers[0].answer'])
  })
})

describe('INVALID_INPUT 의 fields 는 field 이름 순', () => {
  it('정렬해서 던짐', () => {
    try { throwIfInvalid([{ field: 'nickname', message: 'x' }, { field: 'answers', message: 'y' }]); expect.unreachable() } catch (e) {
      expect(isApiError(e) && e.fields?.map((f) => f.field)).toEqual(['answers', 'nickname'])
    }
  })
})

describe('화면 이름은 게시판 (알림 탭 · 알림 설정 종류)', () => {
  it('알림 종류에 커뮤니티 대신 게시판', () => {
    expect(NOTICE_KINDS).toEqual(['모임', '채팅', '게시판', '땅굴', '공지'])
  })
})
