/**
 * "확인부터" 항목 정리 (docs/f6-f10-gaps-2026-11-21.md 2026-11-22)
 * F6-B5 모임 나가기 버튼 규칙 · F7-B3 정원 늘리면 다시 모집 중 + 빈자리 알림 · F8-B5 글에 나온 모임 카드 · F8-B6 가려진 글 작성자
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Store from '../data/meetupStore'
import type * as Chat from '../data/chat'
import type * as Notif from '../data/notifications'
import type * as Board from '../data/boardStore'
import type * as Ser from '../api/mock/serialize'
import { ME_ID } from '../data/mock'

let S: typeof Store, C: typeof Chat, N: typeof Notif, B: typeof Board, Z: typeof Ser
beforeEach(async () => {
  vi.resetModules()
  S = await import('../data/meetupStore'); C = await import('../data/chat'); N = await import('../data/notifications')
  B = await import('../data/boardStore'); Z = await import('../api/mock/serialize')
})

describe('F6-B5 모임 나가기 (명세 06 모임 정보 4)', () => {
  it('주최자는 끝나거나 취소되기 전까지 못 나감(버튼 안 보임), 끝나면 대화방만 나감', () => {
    const r = C.roomOf('g-m3')! // 내가 연 모임
    expect(C.canQuitMeetup(r).ok).toBe(false)
    expect(C.canQuitMeetup(r).why).toContain('주최자')
    S.cancelMeetup('m3')
    expect(C.canQuitMeetup(C.roomOf('g-m3')!).ok).toBe(true) // 취소된 뒤에는 주최자도 대화방만 나감
  })
  it('시작 24시간 안 ~ 시작 전은 나갈 수 없음(버튼은 꺼진 채 보임: why 있음), 24시간 전까지는 나감', () => {
    const ok = S.getMeetupState().list.find((m) => m.hostId !== ME_ID && S.myOf(m.id)?.st === 'joined' && !S.isPast(m) && S.canQuit(m))!
    expect(C.canQuitMeetup(C.roomOf(C.groupRoomId(ok.id))!)).toEqual({ ok: true })
    const soon = S.getMeetupState().list.find((m) => m.hostId !== ME_ID && S.myOf(m.id)?.st === 'joined' && !S.isPast(m) && !S.canQuit(m))
    if (soon) { const x = C.canQuitMeetup(C.roomOf(C.groupRoomId(soon.id))!); expect(x.ok).toBe(false); expect(x.why).toBeTruthy() }
  })
})

describe('F7-B3 정원 늘림 · 빈자리 알림 (명세 07 만들기 정원 · 찜한 모임 5)', () => {
  /** 내가 연 모임을 정원이 찬 상태로 만듦 */
  function full() {
    const m = S.getMeetupState().list.find((x) => x.hostId === ME_ID && S.recruitOf(x) === 'open')!
    const d = { ...S.draftOf(m), cap: S.confirmedOf(m) }
    S.updateMeetup(m.id, d)
    expect(S.recruitOf(S.findMeetup(m.id)!)).toBe('closed')
    return m.id
  }
  const vacancyN = () => N.noticeStore.get().list.filter((n) => n.type === '빈자리 생김').length
  it('정원을 늘려 자리가 나면 다시 모집 중', () => {
    const id = full()
    S.updateMeetup(id, { ...S.draftOf(S.findMeetup(id)!), cap: S.findMeetup(id)!.capacity + 2 })
    expect(S.recruitOf(S.findMeetup(id)!)).toBe('open')
  })
  it('빈자리 알림을 켠 모임이면 정원을 늘릴 때 알림이 옴, 안 켰으면 안 옴', () => {
    const a = full()
    const n0 = vacancyN()
    S.updateMeetup(a, { ...S.draftOf(S.findMeetup(a)!), cap: S.findMeetup(a)!.capacity + 1 })
    expect(vacancyN()).toBe(n0) // 알림을 안 켬
    const b = full()
    S.toggleAlert(b)
    S.updateMeetup(b, { ...S.draftOf(S.findMeetup(b)!), cap: S.findMeetup(b)!.capacity + 1 })
    expect(vacancyN()).toBe(n0 + 1)
    const n = N.noticeStore.get().list[0]
    expect(n).toMatchObject({ kind: '모임', type: '빈자리 생김', to: `/meetups/${b}` })
  })
  it('참여 확정자가 나가거나 내보내져도 자리가 나면 알림 (모집 완료였을 때만)', () => {
    const id = full()
    S.toggleAlert(id)
    S.kick(id, S.membersOf(id)[0])
    expect(vacancyN()).toBe(N.noticeStore.get().list.filter((n) => n.type === '빈자리 생김').length)
    const before = vacancyN()
    S.kick(id, S.membersOf(id)[0] ?? 'nobody') // 이미 자리가 있는 상태 → 알림 없음
    expect(vacancyN()).toBe(before)
    expect(before).toBeGreaterThan(0)
  })
  it('이미 시작했거나 취소된 모임은 알리지 않음', () => {
    const id = full(); S.toggleAlert(id); S.cancelMeetup(id)
    const n0 = vacancyN()
    S.updateMeetup(id, { ...S.draftOf(S.findMeetup(id)!), cap: 10 })
    expect(vacancyN()).toBe(n0)
  })
})

describe('F8-B5 글에 나온 모임 카드', () => {
  const linked = () => B.getPosts().find((p) => p.meetupId && S.findMeetup(p.meetupId))!
  it('모임이 모집 완료 · 취소돼도 카드는 남고 지금 상태를 보임', () => {
    const p = linked()
    expect(Z.postDetail(p, null, null).meetup).not.toBeNull()
    S.cancelMeetup(p.meetupId!)
    expect(Z.postDetail(p, null, null).meetup?.recruitStatus).toBe('CANCELED')
  })
  it('모임이 삭제되면 카드를 안 보여줌', () => {
    const p = linked()
    S.deleteMeetup(p.meetupId!)
    expect(Z.postDetail(p, null, null).meetup).toBeNull()
  })
})

describe('F8-B6 가려진 글', () => {
  it('작성자는 가려진 글을 열어 보고(POST_HIDDEN 아님) 수정은 못 함, 남의 가려진 글은 403', async () => {
    const { api } = await import('../api')
    const mine = B.getPosts().find((p) => p.status === 'hidden' && p.authorId === ME_ID)!
    const other = B.getPosts().find((p) => p.status === 'hidden' && p.authorId !== ME_ID)!
    expect((await api.board.get(mine.id)).status).toBe('HIDDEN')
    await expect(api.board.get(other.id)).rejects.toMatchObject({ code: 'POST_HIDDEN' })
  })
})
