/**
 * lib/format.ts · lib/store.ts noticeTime — 시간·날짜 표기
 * 근거: 00 공통 8 시간 표기, 04 내 땅굴 방명록 전체 보기 2 (자동 삭제 없음, 서로 다른 3명 신고하면 가려짐, 최신순)
 *
 * 주의: 시간 표기는 지금 네 곳에 따로 있음 (lib/format timeAgo, lib/store noticeTime, data/chat ago, data/boardStore ago).
 * "날짜 통일" 작업이 하나로 합치면 이 파일의 timeAgo 기대값도 그 규칙으로 바꿀 것 → 아래 it.todo
 */
import { describe, expect, it } from 'vitest'
import { GUESTBOOK_HIDE_REPORTS, cx, dateLabel, dateParts, isGuestbookHidden, timeAgo, visibleGuestbook } from '../lib/format'
import { noticeTime } from '../lib/store'
import type { GuestbookEntry } from '../data/types'

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
const NOW = new Date(2026, 10, 16, 15, 0).getTime() // 2026-11-16 (월) 15:00 서울
const iso = (ms: number) => new Date(ms).toISOString()

describe('timeAgo (00 공통 8 · lib/format)', () => {
  it('1분 안은 "방금"', () => {
    expect(timeAgo(iso(NOW), NOW)).toBe('방금')
    expect(timeAgo(iso(NOW - 59_000), NOW)).toBe('방금')
  })
  it('1시간 안은 N분 전, 하루 안은 N시간 전, 그 뒤는 N일 전', () => {
    expect(timeAgo(iso(NOW - 3 * MIN), NOW)).toBe('3분 전')
    expect(timeAgo(iso(NOW - 59 * MIN), NOW)).toBe('59분 전')
    expect(timeAgo(iso(NOW - 2 * HOUR), NOW)).toBe('2시간 전')
    expect(timeAgo(iso(NOW - 3 * DAY), NOW)).toBe('3일 전')
  })
  it('미래 시각은 음수가 아니라 "방금" (서버·브라우저 시계 차이)', () => {
    expect(timeAgo(iso(NOW + 5 * MIN), NOW)).toBe('방금')
  })
  it.todo('00 공통 8 의 "어제"·7일 넘으면 날짜 — 시간 표기 4곳을 하나로 합칠 때 같이 (날짜 통일 작업)')
})

describe('noticeTime (00 공통 8 · lib/store, 알림·방명록)', () => {
  it('방금 전 · N분 전 · N시간 전 · 어제 · N일 전 · 7일 넘으면 M월 D일', () => {
    expect(noticeTime(NOW - 10_000, NOW)).toBe('방금 전')
    expect(noticeTime(NOW - 10 * MIN, NOW)).toBe('10분 전')
    expect(noticeTime(NOW - 5 * HOUR, NOW)).toBe('5시간 전')
    expect(noticeTime(NOW - 30 * HOUR, NOW)).toBe('어제')
    expect(noticeTime(NOW - 6 * DAY, NOW)).toBe('6일 전')
    expect(noticeTime(NOW - 8 * DAY, NOW)).toBe('11월 8일')
  })
})

describe('visibleGuestbook (04 방명록 전체 보기 2: 자동 삭제 없음, 서로 다른 3명 신고하면 가려짐, 최신순)', () => {
  const entry = (id: string, ago: number, reporters?: string[]): GuestbookEntry => ({ id, authorId: 'yerin', text: id, createdAt: iso(NOW - ago), reporters })
  it('오래된 글도 지워지지 않음 (예전의 7일 자동 삭제는 없어짐)', () => {
    const list = [entry('year', 365 * DAY), entry('b', 8 * DAY), entry('a', HOUR)]
    expect(visibleGuestbook(list).map((g) => g.id)).toEqual(['a', 'b', 'year'])
  })
  it('신고한 서로 다른 사람이 3명이면 가려져 목록(= 글 수)에서 빠짐, 2명까지는 보임', () => {
    expect(GUESTBOOK_HIDE_REPORTS).toBe(3)
    const list = [entry('two', HOUR, ['a', 'b']), entry('three', 2 * HOUR, ['a', 'b', 'c']), entry('none', 3 * HOUR)]
    expect(visibleGuestbook(list).map((g) => g.id)).toEqual(['two', 'none'])
    expect(isGuestbookHidden(list[1])).toBe(true)
  })
  it('같은 사람이 여러 번 신고해도 한 명으로 셈', () => {
    expect(isGuestbookHidden(entry('x', HOUR, ['a', 'a', 'a']))).toBe(false)
    expect(isGuestbookHidden(entry('y', HOUR, ['a', 'a', 'b', 'c']))).toBe(true)
  })
  it('원본 배열을 바꾸지 않고 최신순', () => {
    const list = [entry('b', 2 * DAY), entry('a', HOUR)]
    expect(visibleGuestbook(list).map((g) => g.id)).toEqual(['a', 'b'])
    expect(list.map((g) => g.id)).toEqual(['b', 'a'])
  })
})

describe('dateParts · dateLabel (모임 날짜 "11월 8일 (일)")', () => {
  it('요일을 붙임', () => {
    expect(dateParts('2026-11-08')).toEqual({ y: 2026, m: 11, d: 8, w: '일' })
    expect(dateLabel('2026-11-16')).toBe('11월 16일 (월)')
    expect(dateLabel('2026-12-31')).toBe('12월 31일 (목)')
  })
})

describe('cx', () => {
  it('거짓 값은 빼고 공백으로 이음', () => {
    expect(cx('a', false, null, undefined, 'b', '')).toBe('a b')
  })
})
