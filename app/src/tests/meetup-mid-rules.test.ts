/**
 * F7-B1 "모임 취소로 마감" · F7-B2 내 모임 · 캘린더 · 찜 규칙 (팀 명세 07 상태 표 · 내 모임 2~3 · 찜한 모임 2 · 캘린더 3·5)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Store from '../data/meetupStore'
import { ME_ID } from '../data/mock'

let S: typeof Store
beforeEach(async () => { vi.resetModules(); S = await import('../data/meetupStore') })

const pendingId = () => S.getMeetupState().list.find((m) => S.myOf(m.id)?.st === 'pending' && !S.isPast(m) && !m.cancelled)!.id

describe('F7-B1 모임 취소로 마감 (신청 기록 일곱 번째 상태)', () => {
  it('신청 대기 중에 주최자가 모임을 취소하면 "모임 취소로 마감" (미승인이 아님)', () => {
    const id = pendingId()
    S.cancelMeetup(id)
    expect(S.myOf(id)?.st).toBe('cancelClosed')
    expect(S.myOf(id)?.auto).toBeUndefined() // 자동 미승인 표시가 아님
  })
  it('다시 신청 불가', () => {
    const id = pendingId()
    S.cancelMeetup(id)
    expect(S.canReapply(S.myOf(id))).toBe(false)
    S.apply(id, '다시요')
    expect(S.myOf(id)?.st).toBe('cancelClosed')
  })
  it('내 모임에 안 나옴: 신청 대기 · 지난 모임 어디에도', () => {
    const id = pendingId()
    S.cancelMeetup(id)
    const g = S.mineGroups()
    for (const k of ['upcoming', 'pending', 'hosting', 'wished', 'past', 'active'] as const) expect(g[k].some((m) => m.id === id), k).toBe(false)
  })
  it('주최자가 처리할 신청 수에서 빠짐(신청 목록이 비워짐)', () => {
    S.cancelMeetup('m3') // 내가 주최, 신청 대기 3건
    expect(S.applicantsOf('m3')).toEqual([])
  })
  it('다른 상태는 취소돼도 그대로: 참여 확정은 지난 모임에 "취소됨", 신청 취소(withdrawn)는 그대로', () => {
    const joined = S.getMeetupState().list.find((m) => S.myOf(m.id)?.st === 'joined' && !S.isPast(m))!.id
    S.cancelMeetup(joined)
    expect(S.myOf(joined)?.st).toBe('joined')
    S.withdraw('m6')
    S.cancelMeetup('m6')
    expect(S.myOf('m6')?.st).toBe('withdrawn')
  })
  it('상세 화면은 취소된 모임 카드 (모집 상태가 취소됨)', () => {
    const id = pendingId()
    S.cancelMeetup(id)
    expect(S.recruitOf(S.findMeetup(id)!)).toBe('cancelled')
  })
})

describe('F7-B2 내 모임 · 찜 · 캘린더 규칙', () => {
  const cancelTo = (id: string) => { S.cancelMeetup(id) }
  it('내가 연 모임 · 찜한 모임에는 시작 전(취소 아님)만', () => {
    const g = S.mineGroups()
    for (const m of [...g.hosting, ...g.wished]) { expect(S.isPast(m), m.id).toBe(false); expect(m.cancelled, m.id).toBeFalsy() }
  })
  it('열었거나 확정됐던 모임은 시작하면 지난 모임으로 (시작한 것: 지난 모임에 있고 다가오는 모임에는 없음)', () => {
    const g = S.mineGroups()
    const started = S.getMeetupState().list.filter((m) => S.isPast(m) && ['joined', 'host'].includes(S.myOf(m.id)?.st ?? ''))
    expect(started.length).toBeGreaterThan(0)
    for (const m of started) { expect(g.past.some((x) => x.id === m.id), m.id).toBe(true); expect(g.upcoming.some((x) => x.id === m.id), m.id).toBe(false) }
  })
  it('열었거나 확정된 모임이 시작 전에 취소되면 바로 지난 모임에 (취소됨)', () => {
    const host = S.mineGroups().hosting[0].id
    const joined = S.mineGroups().upcoming.find((m) => S.myOf(m.id)?.st === 'joined')!.id
    cancelTo(host); cancelTo(joined)
    const g = S.mineGroups()
    for (const id of [host, joined]) {
      expect(g.past.some((m) => m.id === id), id).toBe(true)
      expect(g.upcoming.some((m) => m.id === id), id).toBe(false)
      expect(g.hosting.some((m) => m.id === id), id).toBe(false)
      expect(S.findMeetup(id)!.cancelled).toBe(true)
    }
  })
  it('찜에서는 지난 · 취소 모임이 빠짐 (찜했더라도)', () => {
    const w = S.mineGroups().wished[0].id
    cancelTo(w)
    expect(S.mineGroups().wished.some((m) => m.id === w)).toBe(false)
    expect(S.getMeetupState().wish).toContain(w) // 찜 기록 자체는 남음 (목록에서만 빠짐)
    for (const m of S.mineGroups().wished) expect(S.isPast(m)).toBe(false)
  })
  it('신청 대기 중인 모임은 신청 대기 탭에만 (다가오는 모임에 안 겹침)', () => {
    const g = S.mineGroups()
    for (const m of g.pending.filter((x) => S.myOf(x.id)?.st === 'pending')) expect(g.upcoming.some((x) => x.id === m.id), m.id).toBe(false)
  })
  it('내가 주최한 모임은 다가오는 모임에도 들어감 (확정 + 주최)', () => {
    const g = S.mineGroups()
    for (const m of g.hosting) expect(g.upcoming.some((x) => x.id === m.id), m.id).toBe(true)
  })
  it('주최자 = 나인 모임의 기록은 host', () => {
    for (const m of S.getMeetupState().list.filter((x) => x.hostId === ME_ID)) expect(S.myOf(m.id)?.st, m.id).toBe('host')
  })
})
