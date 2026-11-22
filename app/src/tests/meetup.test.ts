/**
 * 모임 규칙 (data/meetupStore.ts)
 * 근거: 02 F7 + docs/meetup-spec-review.md 결정 M1~M17, docs/spec-f7.md
 * - M2 정원에 주최자 포함 · M5 수정 12시간 / 참여 취소 24시간 / 취소는 시작 전까지
 * - M7 처리 안 된 신청은 마감 시각에 자동 미승인 (마감이 없으면 시작될 때. 정원이 차도 기다리던 신청은 남음 — 백엔드 명세 07)
 * - M8 스스로 신청 취소한 경우만 다시 신청 · M14 시작 시각이 지나면 바로 지난 모임 · M15 태그 최대 3개
 * 시간 기준: 목 데이터의 오늘(TODAY = 2026-11-03) 정오 = NOW
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Store from '../data/meetupStore'
import { ME_ID, TODAY } from '../data/mock'

let S: typeof Store
beforeEach(async () => {
  vi.resetModules() // 저장소(모듈 변수)를 테스트마다 처음 상태로
  S = await import('../data/meetupStore')
})

/** 시험용 모임. date·start 로 NOW 와의 거리를 정함 */
function mk(over: Partial<Store.MeetupX> = {}): Store.MeetupX {
  return {
    id: 't1', title: '시험 모임', category: '취미/문화', date: '2026-11-10', start: '오후 2:00', end: '오후 4:00', area: '역삼', place: '역삼',
    mode: '오프라인', capacity: 6, memberIds: [], hostId: 'kim', intro: '', askMsg: true, likes: 0, seq: 1, ...over,
  }
}
function st(over: Partial<Store.MeetupX> = {}, members: string[] = [], my?: Store.Mine) {
  const m = mk(over)
  const s = { ...S.getMeetupState(), list: [m], members: { [m.id]: members }, my: my ? { [m.id]: my } : {} }
  return { m, s }
}

describe('시간 (목 데이터 NOW = TODAY 정오)', () => {
  it('NOW 는 2026-11-03 12:00', () => {
    expect(TODAY).toBe('2026-11-03')
    expect(new Date(S.NOW).getHours()).toBe(12)
  })
  it('parseHour: 오전 12시 = 0시, 오후 12:10 = 12시 10분, 오후 2:00 = 14시', () => {
    expect(S.parseHour('오전 12:00')).toBe(0)
    expect(S.parseHour('오후 12:10')).toBeCloseTo(12 + 10 / 60)
    expect(S.parseHour('오후 2:00')).toBe(14)
    expect(S.parseHour('다음 날 오전 11:00')).toBe(11)
  })
  it('D-day: 11/6 모임이 D-3 (Figma 내 모임), 오늘 D-DAY, 지난 날 D+N', () => {
    expect(S.ddayOf('2026-11-06')).toBe('D-3')
    expect(S.ddayOf(TODAY)).toBe('D-DAY')
    expect(S.ddayOf('2026-11-01')).toBe('D+2')
  })
  it('표기: 마감 "11월 8일 오전 10시", 시간 "오후 2시" · "오후 12시 10분"', () => {
    expect(S.deadlineLabel('2026-11-08T10:00')).toBe('11월 8일 오전 10시')
    expect(S.deadlineLabel('2026-11-13T23:59')).toBe('11월 13일 오후 11시 59분')
    expect(S.deadlineLabel('2026-11-13T12:00')).toBe('11월 13일 오후 12시')
    expect(S.hourLabel('오후 2:00')).toBe('오후 2시')
    expect(S.hourLabel('오후 12:10')).toBe('오후 12시 10분')
  })
})

describe('정원 · 모집 상태 (M2 · M14 · 상세 1)', () => {
  it('M2 확정 인원 = 주최자 1 + 참여 확정자, 남은 자리 = 정원 − 확정', () => {
    const { m, s } = st({ capacity: 6 }, ['a', 'b'])
    expect(S.confirmedOf(m, s)).toBe(3)
    expect(S.leftOf(m, s)).toBe(3)
  })
  it('M2 만들자마자 1명 확정 (주최자)', () => {
    const { m, s } = st({ capacity: 2 }, [])
    expect(S.confirmedOf(m, s)).toBe(1)
    expect(S.leftOf(m, s)).toBe(1)
  })
  it('정원이 차면 모집 완료', () => {
    const { m, s } = st({ capacity: 3 }, ['a', 'b'])
    expect(S.recruitOf(m, s)).toBe('closed')
  })
  it('모집 마감 시각이 지나면 자리가 남아도 모집 완료', () => {
    const { m, s } = st({ deadline: '2026-11-03T11:59' }, [])
    expect(S.recruitOf(m, s)).toBe('closed')
    expect(S.recruitOf(st({ deadline: '2026-11-03T12:01' }).m, s)).toBe('open')
  })
  it('M14 시작 시각이 지나면 그날이라도 바로 지난 모임', () => {
    expect(S.recruitOf(...pair(st({ date: TODAY, start: '오전 11:59' }))) ).toBe('past')
    expect(S.recruitOf(...pair(st({ date: TODAY, start: '오후 12:01' }))) ).toBe('open')
  })
  it('취소된 모임은 지났어도 "취소됨"이 먼저', () => {
    expect(S.recruitOf(...pair(st({ date: '2026-10-01', cancelled: true })))).toBe('cancelled')
  })
  it('처음 데이터: 취소(p4) · 지난(p1) · 모집 완료(x3)', () => {
    const s = S.getMeetupState()
    expect(S.recruitOf(S.findMeetup('p4')!, s)).toBe('cancelled')
    expect(S.recruitOf(S.findMeetup('p1')!, s)).toBe('past')
    expect(S.recruitOf(S.findMeetup('x3')!, s)).toBe('closed')
  })
  it('처음 데이터: 모든 모임의 확정 인원이 정원을 넘지 않음', () => {
    const s = S.getMeetupState()
    for (const m of s.list) expect(S.confirmedOf(m, s), m.id).toBeLessThanOrEqual(m.capacity)
  })
})
type State = ReturnType<typeof Store.getMeetupState>
function pair(x: { m: Store.MeetupX; s: State }): [Store.MeetupX, State] { return [x.m, x.s] }

describe('신청 기록 (M7 자동 미승인 · M8 다시 신청)', () => {
  const pending: Store.Mine = { st: 'pending', at: 0 }
  it('M7 마감 일시가 지나면 처리 안 된 신청은 자동 미승인', () => {
    const { s } = st({ deadline: '2026-11-02T18:00' }, [], pending)
    expect(S.myOf('t1', s)).toMatchObject({ st: 'rejected', auto: true })
  })
  it('정원이 차도 마감 전이면 신청 대기 유지 (명세 07: 자리가 나면 주최자가 수락할 수 있음)', () => {
    const { s } = st({ capacity: 2 }, ['a'], pending)
    expect(S.myOf('t1', s)?.st).toBe('pending')
  })
  it('M7 마감 일시가 없으면 모임이 시작될 때 자동 미승인', () => {
    const { s } = st({ date: TODAY, start: '오전 9:00' }, [], pending)
    expect(S.myOf('t1', s)?.st).toBe('rejected')
  })
  it('M7 마감 일시가 남았으면 정원이 차도 신청 대기 유지 (마감 시각에 처리)', () => {
    const { s } = st({ capacity: 2, deadline: '2026-11-05T18:00' }, ['a'], pending)
    expect(S.myOf('t1', s)?.st).toBe('pending')
  })
  it('M8 다시 신청: 기록이 없거나 스스로 신청 취소한 경우만', () => {
    expect(S.canReapply(undefined)).toBe(true)
    expect(S.canReapply({ st: 'withdrawn' })).toBe(true)
    for (const x of ['pending', 'rejected', 'joined', 'quit', 'kicked', 'host'] as const) expect(S.canReapply({ st: x }), x).toBe(false)
  })
})

describe('시간 제한 (M5)', () => {
  // NOW = 11/03 12:00. 11/04 12:00 = 정확히 24시간 뒤
  it('참여 취소는 시작 24시간 전까지 (24시간 정각은 가능)', () => {
    expect(S.canQuit(mk({ date: '2026-11-04', start: '오후 12:00' }))).toBe(true)
    expect(S.canQuit(mk({ date: '2026-11-04', start: '오전 11:59' }))).toBe(false)
  })
  it('주최자는 참여 취소(모임 나가기)가 없음', () => {
    expect(S.canQuit(mk({ hostId: ME_ID, date: '2026-12-01' }))).toBe(false)
  })
  it('수정은 시작 12시간 전까지', () => {
    expect(S.canEdit(mk({ date: TODAY, start: '오후 11:59' }))).toBe(false)
    expect(S.canEdit(mk({ date: '2026-11-04', start: '오전 12:00' }))).toBe(true)
  })
  it('취소는 시작 전까지 언제든, 이미 취소·지난 모임은 안 됨', () => {
    expect(S.canCancel(mk({ date: TODAY, start: '오후 12:30' }))).toBe(true)
    expect(S.canCancel(mk({ date: TODAY, start: '오전 11:00' }))).toBe(false)
    expect(S.canCancel(mk({ cancelled: true }))).toBe(false)
  })
  it('채팅 "모임 나가기"와 같은 규칙을 씀 (data/chat.ts canQuitMeetup → canQuit)', async () => {
    const chat = await import('../data/chat')
    const room = chat.roomOf('g-m3')!
    expect(chat.canQuitMeetup(room)).toEqual({ ok: false, why: '주최자는 모임을 나갈 수 없어요' })
  })
})

describe('동작 (저장소)', () => {
  it('신청 → 신청 대기, 신청 취소 → 다시 신청 가능 (M8)', () => {
    S.apply('m6', '  안녕하세요  ')
    expect(S.myOf('m6')).toMatchObject({ st: 'pending', note: '안녕하세요' })
    S.withdraw('m6')
    expect(S.canReapply(S.myOf('m6'))).toBe(true)
    S.apply('m6', '')
    expect(S.myOf('m6')?.st).toBe('pending')
  })
  it('참여 확정 후 참여 취소 → 확정자에서 빠지고 다시 신청 불가 (M8)', () => {
    expect(S.membersOf('m1')).toContain(ME_ID)
    S.quit('m1')
    expect(S.membersOf('m1')).not.toContain(ME_ID)
    S.apply('m1', '다시')
    expect(S.myOf('m1')?.st).toBe('quit')
  })
  it('수락은 남은 자리가 있을 때만 (신청 관리 3: 정원이 차면 수락 꺼짐)', () => {
    const m = S.findMeetup('m3')!
    // 정원보다 많은 사람을 수락해도 정원에서 멈춤
    const applicants = [...S.applicantsOf('m3').map((a) => a.userId), 'u1', 'u2', 'u3', 'u4']
    expect(S.confirmedOf(m) + applicants.length).toBeGreaterThan(m.capacity)
    applicants.forEach((u) => S.accept('m3', u))
    expect(S.confirmedOf(S.findMeetup('m3')!)).toBe(m.capacity)
  })
  it('거절은 신청자 목록에서만 빠짐, 내보내기는 확정자에서 빠짐 (자리가 다시 열림)', () => {
    const [first] = S.applicantsOf('m3')
    S.reject('m3', first.userId)
    expect(S.applicantsOf('m3').some((a) => a.userId === first.userId)).toBe(false)
    expect(S.membersOf('m3')).not.toContain(first.userId)
    const before = S.leftOf(S.findMeetup('m3')!)
    const kicked = S.membersOf('m3')[0]
    S.kick('m3', kicked)
    expect(S.leftOf(S.findMeetup('m3')!)).toBe(before + 1)
  })
  it('만들기: 주최자 = 나, 확정 1명, 태그 최대 3개 (M15), 온라인은 플랫폼 이름', () => {
    const d: Store.Draft = {
      cap: 6, prep: '', askMsg: true, ymd: '2026-11-20', start: '오후 7:00', end: '', deadline: '',
      mode: '온라인', place: '', placeDetail: '', link: ' https://discord.gg/x ',
      title: '  새 모임  ', intro: '', category: '취미/문화',
    }
    const id = S.createMeetup(d)
    const m = S.findMeetup(id)!
    expect(m.hostId).toBe(ME_ID)
    expect(m.title).toBe('새 모임')
    expect('tags' in m).toBe(false) // 모임 관심사 태그 없음 (명세 07)
    expect(m.place).toBe('') // 온라인은 장소·플랫폼 이름 없이 접속 링크만 (명세 07)
    expect('platform' in m).toBe(false)
    expect(m.link).toBe('https://discord.gg/x')
    expect('campus' in m).toBe(false) // 모임에는 캠퍼스가 없음 (명세 07)
    expect(S.confirmedOf(m)).toBe(1)
    expect(S.myOf(id)?.st).toBe('host')
    expect(S.draftOf(m)).toMatchObject({ mode: '온라인', link: 'https://discord.gg/x' })
  })
  it('취소하면 기록이 남고(취소됨) 신청 대기는 비움, 삭제하면 목록·내 기록·찜에서 사라짐', () => {
    S.cancelMeetup('m3')
    expect(S.recruitOf(S.findMeetup('m3')!)).toBe('cancelled')
    expect(S.applicantsOf('m3')).toEqual([])
    S.toggleWish('m6')
    S.deleteMeetup('m6')
    expect(S.findMeetup('m6')).toBeUndefined()
    expect(S.getMeetupState().wish).not.toContain('m6')
  })
  it('찜하면 찜 수 +1, 다시 누르면 −1 (인기순 정렬 기준)', () => {
    const before = S.findMeetup('m6')!.likes
    S.toggleWish('m6')
    expect(S.findMeetup('m6')!.likes).toBe(before + 1)
    S.toggleWish('m6')
    expect(S.findMeetup('m6')!.likes).toBe(before)
  })
  it('모임 신고는 이번 범위가 아님 (명세 README "이번 범위에 없는 것") → 저장소에 신고 기록이 없음', () => {
    expect('report' in S).toBe(false)
    expect('reported' in S.getMeetupState()).toBe(false)
  })
  it('찜을 풀면 빈자리 알림도 함께 꺼짐 (명세: meetup_like 줄을 지움)', () => {
    S.setWish('m6', true); S.setAlert('m6', true)
    S.setWish('m6', false)
    expect(S.getMeetupState().alerts).not.toContain('m6')
  })
  it('신청 대기 중 모임이 취소되면 "모임 취소로 마감" (MEETUP_CANCELED)', () => {
    S.cancelMeetup('m2')
    expect(S.myOf('m2')?.st).toBe('mcancel')
    expect(S.canReapply(S.myOf('m2'))).toBe(false)
  })
})

describe('내 모임 분류 (내 모임 5탭)', () => {
  it('다가오는 · 신청 대기 · 내가 연 · 찜 · 지난 모임이 서로의 규칙대로', () => {
    const g = S.mineGroups()
    for (const m of [...g.upcoming, ...g.pending, ...g.hosting, ...g.wished]) {
      expect(S.isPast(m), m.id).toBe(false)
      expect(m.cancelled, m.id).toBeFalsy()
    }
    for (const m of g.past) expect(S.isPast(m) || m.cancelled, m.id).toBe(true)
    for (const m of g.hosting) expect(m.hostId).toBe(ME_ID)
    // 다가오는 일정은 날짜순
    const t = g.upcoming.map(S.startMs)
    expect([...t].sort((a, b) => a - b)).toEqual(t)
    // 찜한 모임: 모집 완료는 뒤로
    const closedIdx = g.wished.map((m) => S.recruitOf(m) === 'closed')
    expect([...closedIdx].sort((a, b) => Number(a) - Number(b))).toEqual(closedIdx)
  })
})

describe('모임에는 캠퍼스가 없음 (명세 07)', () => {
  it('저장소·양식 값(Draft)에 캠퍼스가 없고, 오프라인 장소 줄도 캠퍼스를 붙이지 않음', () => {
    expect('CAMPUSES' in S).toBe(false)
    expect('MY_CAMPUS' in S).toBe(false)
    const m = S.getMeetupState().list.find((x) => x.mode === '오프라인')!
    expect(S.placeLine(m)).toBe(`${m.area} · 오프라인`)
    expect(S.draftOf(m)).not.toHaveProperty('campus')
    expect(m).not.toHaveProperty('campus')
  })
})

describe('모임에는 플랫폼 이름이 없음 (명세 07 만들기 3, M16 은 명세로 뒤집힘)', () => {
  it('저장소·양식 값에 플랫폼이 없고, 온라인 장소 줄은 "온라인" 하나', () => {
    expect('PLATFORMS' in S).toBe(false)
    for (const m of S.getMeetupState().list.filter((x) => x.mode === '온라인')) {
      expect(m).not.toHaveProperty('platform')
      expect(m.place, m.id).toBe('')
      expect(S.placeLine(m)).toBe('온라인')
      expect(S.draftOf(m)).not.toHaveProperty('platform')
    }
  })
})
