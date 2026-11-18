/**
 * 입력 검증 · 화면 규칙 (순수 함수)
 * - 00 공통 9 비밀번호 규칙 (F2 회원가입 2 · F10 비밀번호 변경) — data/auth.ts 와 data/account.ts 두 곳에 있어 서로 같은지도 봄
 * - F2 이메일 형식 · 재설정 링크(30분, 한 번만, 다시 보내면 이전 링크 무효)
 * - F3 1-2 닉네임 12자 · 겹침, 3-3 질문 답변 10~50자, 추천 질문 3개
 * - 두더지 꾸미기 (3D 핸드오프 v2 accessories.md v1.2): 부위마다 하나 · 최대 4개 · 같이 못 끼는 조합 · 관심사 전용 잠금 · 손 소품 숨김
 * - F9 알림 4·8: 최근 30일, 안 읽은 것 먼저 → 최신순, 종류별로 끄기
 * - F8 커뮤니티 10 인기 글(최근 7일 · 좋아요+댓글+저장 · 같으면 최신) · 신고 4(서로 다른 3명이면 가려짐, 같은 사람은 한 번)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { checkPassword, confirmMismatch, consumeResetToken, emailHasBadChar, emailValid, lastResetToken, requestReset, resetTokenValid, RESET_TTL_MS } from '../data/auth'
import { passwordChecks, passwordOk } from '../data/account'
import { ANSWER_MAX, ANSWER_MIN, QUESTIONS, answerOk, recommendedQuestions } from '../data/questions'
import { NICK_MAX, nickTaken } from '../data/myBurrow'
import { INTEREST_SUBS } from '../data/interests'
import { BLOCKED_PAIRS, MAX_WORN, MOLE_ITEMS, MOLE_PARTS, blockedBy, handVisible, itemOf, lockOf, wornByPart } from '../data/moleItems'
import { NOTICE_TTL_DAYS, visibleNotices, type AppNotice, type NoticeKind } from '../data/notifications'
import { HIDE_AT, getPost, hotPosts, reportPost, scoreOf, usePosts, type BoardPost } from '../data/boardStore'
import { USERS } from '../data/mock'

describe('비밀번호 (00 공통 9: 8자 이상, 영문·숫자·특수기호 !@#$% 각 1개 이상, 그 밖의 문자는 못 씀)', () => {
  const cases: [string, boolean][] = [
    ['digul123!', true], ['Abcdef1@', true], ['abc12!', false] /* 6자 */, ['abcdefgh', false], ['12345678!', false],
    ['abcdefg1', false], ['abcdefg!', false], ['abcd 123!', false] /* 공백 */, ['비밀번호123!a', false], ['abcd123^', false], ['', false],
  ]
  it.each(cases)('%s → %s', (pw, ok) => {
    expect(checkPassword(pw).ok).toBe(ok)
    expect(passwordOk(pw)).toBe(ok)
  })
  it('auth.ts 와 account.ts 의 "쓸 수 없는 문자" 판단이 같음', () => {
    for (const [pw] of cases) expect(checkPassword(pw).allowed, pw).toBe(passwordChecks(pw).allowed)
  })
  it('비밀번호 확인: 덜 친 동안은 기다리고, 갈라지거나 길이가 같은데 다르면 바로 오류', () => {
    expect(confirmMismatch('digul123!', '')).toBe(false)
    expect(confirmMismatch('digul123!', 'digul')).toBe(false)
    expect(confirmMismatch('digul123!', 'digux')).toBe(true)
    expect(confirmMismatch('digul123!', 'digul123?')).toBe(true)
    expect(confirmMismatch('digul123!', 'digul123!')).toBe(false)
    expect(confirmMismatch('digul123!', 'digul123!!')).toBe(true)
  })
})

describe('이메일 (F2 회원가입 1 · 로그인)', () => {
  it.each([
    ['mole@ssafy.com', true], ['a.b+c@mail.co.kr', true], ['mole@ssafy', false], ['mole.ssafy.com', false], ['mole@@ssafy.com', false], ['@ssafy.com', false],
  ])('형식 %s → %s', (v, ok) => expect(emailValid(v)).toBe(ok))
  it('공백·한글·@ 두 개는 치는 즉시 오류', () => {
    expect(emailHasBadChar('mole @ssafy.com')).toBe(true)
    expect(emailHasBadChar('두더지@ssafy.com')).toBe(true)
    expect(emailHasBadChar('a@b@c.com')).toBe(true)
    expect(emailHasBadChar('mole@ssafy.com')).toBe(false)
  })
})

describe('비밀번호 재설정 링크 (F2 비밀번호 찾기: 30분 · 한 번만 · 다시 보내면 이전 링크 무효)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 16, 10, 0)) })
  afterEach(() => { vi.useRealTimers() })
  it('30분 동안만 쓸 수 있음', () => {
    const t = requestReset('a@ssafy.com')
    expect(resetTokenValid(t)).toBe(true)
    vi.setSystemTime(Date.now() + RESET_TTL_MS + 1)
    expect(resetTokenValid(t)).toBe(false)
  })
  it('다시 보내면 이전 링크는 무효', () => {
    const t1 = requestReset('b@ssafy.com')
    const t2 = requestReset('b@ssafy.com')
    expect(resetTokenValid(t1)).toBe(false)
    expect(resetTokenValid(t2)).toBe(true)
    expect(lastResetToken('b@ssafy.com')).toBe(t2)
  })
  it('한 번 쓰면 끝', () => {
    const t = requestReset('c@ssafy.com')
    consumeResetToken(t, 'newpass1!')
    expect(resetTokenValid(t)).toBe(false)
    expect(resetTokenValid(null)).toBe(false)
  })
})

describe('온보딩 입력 (F3)', () => {
  it('1-2 닉네임 최대 12자, 겹침은 대소문자·앞뒤 공백 무시, 지금 내 닉네임은 겹침 아님', () => {
    expect(NICK_MAX).toBe(12)
    const other = USERS.kim.nickname // '김OO'
    expect(nickTaken(` ${other} `)).toBe(true)
    expect(nickTaken(other.toLowerCase())).toBe(true)
    expect(nickTaken('디굴디굴')).toBe(true) // 예약어
    expect(nickTaken(other, other)).toBe(false)
    expect(nickTaken('   ')).toBe(false)
    expect(nickTaken('아무도안쓰는이름')).toBe(false)
  })
  it('3-3 답변은 앞뒤 공백 빼고 10자 이상, 50자 이하', () => {
    expect([ANSWER_MIN, ANSWER_MAX]).toEqual([10, 50])
    expect(answerOk('가'.repeat(10))).toBe(true)
    expect(answerOk(`  ${'가'.repeat(9)}  `)).toBe(false)
    expect(answerOk('가'.repeat(50))).toBe(true)
    expect(answerOk('가'.repeat(51))).toBe(false)
  })
  it('추천 질문 3개 = 서로 다른 대분류의 관심사 질문 2개 + TMI 1개', () => {
    const music = INTEREST_SUBS.find((s) => s.category === 'music_dance')!, photo = INTEREST_SUBS.find((s) => s.category === 'photo_video')!
    const q = recommendedQuestions([music.id, photo.id])
    expect(q).toHaveLength(3)
    expect(q.slice(0, 2).map((x) => x.category)).toEqual(['music_dance', 'photo_video'])
    expect(q[2].kind).toBe('tmi')
  })
  it('대분류가 하나뿐이면 그 대분류 질문 2개 + TMI, 질문 id 는 하나씩', () => {
    const music = INTEREST_SUBS.filter((s) => s.category === 'music_dance').slice(0, 3).map((s) => s.id)
    const q = recommendedQuestions(music)
    expect(q).toHaveLength(3)
    expect(new Set(q.map((x) => x.id)).size).toBe(3)
    expect(new Set(QUESTIONS.map((x) => x.id)).size).toBe(QUESTIONS.length)
  })
})

describe('두더지 꾸미기 (3D 핸드오프 v2 accessories.md v1.2)', () => {
  it('액세서리 41개, id 하나씩, 부위 4곳 모두 1개 이상, 최대 4개 = 부위 수', () => {
    expect(MOLE_ITEMS).toHaveLength(41)
    expect(new Set(MOLE_ITEMS.map((x) => x.id)).size).toBe(41)
    for (const p of MOLE_PARTS) expect(MOLE_ITEMS.some((x) => x.part === p.part), p.part).toBe(true)
    expect(MAX_WORN).toBe(MOLE_PARTS.length)
  })
  it('부위마다 하나: 같은 부위를 두 번 끼면 나중 것', () => {
    const heads = MOLE_ITEMS.filter((x) => x.part === '머리')
    expect(wornByPart([heads[0].id, heads[1].id]).머리).toBe(heads[1].id)
  })
  it('등 리본 + 작은 캐리어는 같이 못 낌 (양쪽 모두)', () => {
    const [[a, b]] = BLOCKED_PAIRS
    expect(itemOf(a) && itemOf(b)).toBeTruthy()
    expect(blockedBy(a, [b])).toBe(b)
    expect(blockedBy(b, [a])).toBe(a)
    expect(blockedBy(a, [])).toBeNull()
  })
  it('관심사 전용: 관심사를 고르기 전(온보딩 1)은 열려 있고, 그 분야를 하나도 안 골랐으면 잠김', () => {
    const special = MOLE_ITEMS.find((x) => x.interestCat)!
    expect(lockOf(special)).toBeNull()
    const other = INTEREST_SUBS.find((s) => s.category !== special.interestCat)!
    const same = INTEREST_SUBS.find((s) => s.category === special.interestCat)!
    expect(lockOf(special, { picks: [other.id] })).toContain(special.interest!)
    expect(lockOf(special, { picks: [same.name_ko] })).toBeNull()
    const basic = MOLE_ITEMS.find((x) => !x.interestCat)!
    expect(lockOf(basic, { picks: [] })).toBeNull()
  })
  it('손 소품: 인사·커피 동작은 늘 숨김, 엉덩이 씰룩은 막대 사탕 + 니트 목도리일 때만 숨김', () => {
    expect(handVisible('mole_idle', ['prop_palette'])).toBe(true)
    expect(handVisible('mole_greet', ['prop_palette'])).toBe(false)
    expect(handVisible('mole_drink', ['prop_palette'])).toBe(false)
    expect(handVisible('mole_idle', [])).toBe(false)
    const candy = MOLE_ITEMS.find((x) => x.id.startsWith('prop_candy'))?.id
    if (candy) {
      expect(handVisible('mole_butt_wiggle', [candy, 'scarf_knit'])).toBe(false)
      expect(handVisible('mole_butt_wiggle', [candy])).toBe(true)
    }
  })
})

describe('알림 목록 (F9 알림 4·8)', () => {
  const DAY = 86_400_000, NOW = new Date(2026, 10, 16, 12, 0).getTime()
  const on: Record<NoticeKind, boolean> = { 모임: true, 채팅: true, 커뮤니티: true, 땅굴: true, 공지: true }
  const n = (id: string, ago: number, unread = false, kind: NoticeKind = '모임'): AppNotice => ({ id, kind, type: 't', title: id, sub: '', at: NOW - ago, to: '/', unread })
  it(`최근 ${NOTICE_TTL_DAYS}일만, 안 읽은 것 맨 위 → 최신순`, () => {
    const list = [n('old', 31 * DAY), n('b', 2 * DAY), n('a', 1 * DAY), n('u', 5 * DAY, true)]
    expect(visibleNotices(list, on, NOW).map((x) => x.id)).toEqual(['u', 'a', 'b'])
  })
  it('알림 설정에서 끈 종류는 안 보임 (F10 알림 설정)', () => {
    const list = [n('m', DAY, false, '모임'), n('c', DAY, false, '채팅')]
    expect(visibleNotices(list, { ...on, 채팅: false }, NOW).map((x) => x.id)).toEqual(['m'])
  })
})

describe('커뮤니티 (F8 10 인기 글 · 신고 4)', () => {
  it('인기 글: 공개 글만, 최근 7일, 점수 높은 순, 같으면 최신, 최대 5개', () => {
    const all = usePostsSnapshot()
    const hot = hotPosts(all)
    expect(hot.length).toBeLessThanOrEqual(5)
    for (const p of hot) {
      expect(p.status).toBe('public')
      expect(Date.now() - p.at).toBeLessThanOrEqual(7 * 86_400_000)
    }
    for (let i = 1; i < hot.length; i++) {
      const a = hot[i - 1], b = hot[i]
      expect(scoreOf(a) > scoreOf(b) || (scoreOf(a) === scoreOf(b) && a.at >= b.at)).toBe(true)
    }
  })
  it(`신고: 같은 사람은 한 번, 신고 수가 ${HIDE_AT}이 되면 가려짐`, () => {
    const p = usePostsSnapshot().find((x) => x.status === 'public' && !x.reportedByMe)!
    const before = p.reports
    expect(reportPost(p.id)).toBe(true)
    expect(reportPost(p.id)).toBe(false)
    const after = getPost(p.id)!
    expect(after.reports).toBe(before + 1)
    expect(after.status).toBe(before + 1 >= HIDE_AT ? 'hidden' : 'public')
  })
})
/** 글 저장소는 React 훅(usePosts)으로만 전체를 줌 → renderHook 으로 읽음 */
function usePostsSnapshot(): BoardPost[] {
  return renderHook(() => usePosts()).result.current
}
