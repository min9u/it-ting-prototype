/**
 * F8-B4 글쓰기 모임 연결 규칙 (팀 명세 08 · api 08 "글에 연결하는 모임")
 * 모임 홍보 = 필수·내가 연 모집 중 / 모임 후기 = 필수·내가 열었거나 참여 확정된 지난 모임만 / 자유 = 선택·열었거나 확정된 모임(지난 것 가능, 취소 불가)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Board from '../data/boardStore'
import type * as Store from '../data/meetupStore'
import { ME_ID } from '../data/mock'

let B: typeof Board, S: typeof Store
beforeEach(async () => { vi.resetModules(); S = await import('../data/meetupStore'); B = await import('../data/boardStore') })
const ids = (l: Store.MeetupX[]) => l.map((m) => m.id)

describe('모임 홍보', () => {
  it('내가 연 모임 가운데 모집 중인 것만', () => {
    const l = B.linkableMeetups('모임 홍보')
    expect(l.length).toBeGreaterThan(0)
    for (const m of l) { expect(m.hostId, m.id).toBe(ME_ID); expect(S.recruitOf(m), m.id).toBe('open') }
  })
  it('내가 참여만 한 모임 · 지난 모임 · 취소된 모임 · 정원이 찬 모임은 안 나옴', () => {
    const l = ids(B.linkableMeetups('모임 홍보'))
    for (const m of S.getMeetupState().list.filter((x) => x.hostId !== ME_ID)) expect(l, m.id).not.toContain(m.id)
    const open = B.linkableMeetups('모임 홍보')[0].id
    S.cancelMeetup(open)
    expect(ids(B.linkableMeetups('모임 홍보'))).not.toContain(open)
  })
})

describe('모임 후기', () => {
  it('내가 열었거나 참여 확정된 지난 모임만 (예정 모임은 안 됨)', () => {
    const l = B.linkableMeetups('모임 후기')
    expect(l.length).toBeGreaterThan(0)
    for (const m of l) {
      expect(S.recruitOf(m), m.id).toBe('past')
      expect(['host', 'joined'], m.id).toContain(S.myOf(m.id)?.st)
    }
    for (const m of S.getMeetupState().list.filter((x) => !S.isPast(x))) expect(ids(l), m.id).not.toContain(m.id)
  })
  it('취소된 모임은 안 됨', () => {
    const joinedUpcoming = S.getMeetupState().list.find((m) => S.myOf(m.id)?.st === 'joined' && !S.isPast(m))!.id
    S.cancelMeetup(joinedUpcoming)
    expect(ids(B.linkableMeetups('모임 후기'))).not.toContain(joinedUpcoming)
  })
  it('내가 안 간 지난 모임(내가 연 것도 참여 확정도 아님)은 안 됨', () => {
    // 목 데이터의 지난 모임은 모두 내가 간 것이라, 참여 기록을 지워서 "안 간 지난 모임"을 만듦
    const past = S.getMeetupState().list.find((m) => S.isPast(m) && S.myOf(m.id)?.st === 'joined')!.id
    expect(ids(B.linkableMeetups('모임 후기'))).toContain(past)
    S.quit(past)
    expect(ids(B.linkableMeetups('모임 후기'))).not.toContain(past)
  })
  it('그런 모임이 없으면 후기 글을 쓸 수 없음: 연결이 필수라서 목록이 비면 쓸 수 없는 상태', () => {
    const empty = { ...S.getMeetupState(), list: [], my: {}, members: {} }
    expect(B.linkableMeetups('모임 후기', empty)).toEqual([])
    expect(B.needsMeetup('모임 후기')).toBe(true)
  })
})

describe('자유', () => {
  it('내가 열었거나 참여 확정된 모임: 지난 것도 됨, 취소된 모임은 안 됨', () => {
    const l = B.linkableMeetups('자유')
    expect(l.some((m) => S.isPast(m))).toBe(true)
    expect(l.some((m) => !S.isPast(m))).toBe(true)
    for (const m of l) { expect(['host', 'joined'], m.id).toContain(S.myOf(m.id)?.st); expect(m.cancelled, m.id).toBeFalsy() }
  })
  it('신청 대기 · 참여 취소 · 내보내짐 · 미승인 모임은 안 나옴', () => {
    const l = ids(B.linkableMeetups('자유'))
    for (const m of S.getMeetupState().list.filter((x) => ['pending', 'rejected', 'quit', 'kicked', 'withdrawn'].includes(S.myOf(x.id)?.st ?? ''))) expect(l, m.id).not.toContain(m.id)
    const joined = S.mineGroups().upcoming.find((m) => S.myOf(m.id)?.st === 'joined')!.id
    expect(l).toContain(joined)
    S.quit(joined) // 참여 취소 → 더는 연결 못 함
    expect(ids(B.linkableMeetups('자유'))).not.toContain(joined)
  })
  it('모임 연결은 선택: 자유 · 카테고리를 아직 안 골랐을 때는 필수가 아님', () => {
    expect(B.needsMeetup('자유')).toBe(false)
    expect(B.needsMeetup(null)).toBe(false)
    expect(B.needsMeetup('모임 홍보')).toBe(true)
    expect(ids(B.linkableMeetups(null))).toEqual(ids(B.linkableMeetups('자유')))
  })
})
