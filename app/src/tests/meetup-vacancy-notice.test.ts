/**
 * 빈자리 알림 발송 (명세 09 MEETUP_VACANCY_OPENED: 정원이 차 있던 모임에 자리가 남 → 그 모임에 빈자리 알림을 켠 사람)
 * 자리가 나는 길 셋: 정원 늘림(PATCH /meetups/{id}) · 내보내기 · 참여 취소. 목 서버(api/meetups/mock)가 알림 목 서버에 알림을 만든다
 * 시간 기준: 목 데이터의 지금 = 2026-11-03 12:00 (서울). 저장소는 테스트마다 처음 상태로 (vi.resetModules)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MockMod from '../api/meetups/mock'
import type * as Ids from '../api/common/ids'
import type * as Mappers from '../api/meetups/mappers'
import type * as Store from '../data/meetupStore'
import type * as Notices from '../data/notifications'

let api: typeof MockMod.mock
let ids: typeof Ids
let map: typeof Mappers
let S: typeof Store
let N: typeof Notices
const n = (appId: string) => ids.toDtoId(appId)
const app = (meetupId: string, userId: string) => n(`${meetupId}:${userId}`)
const vacancyCount = (meetupId: string) => N.noticeStore.get().list.filter((x) => x.type === 'MEETUP_VACANCY_OPENED' && x.targetId === meetupId).length
const meetup = (id: string) => S.getMeetupState().list.find((m) => m.id === id)!
/** 정원을 확정 인원과 같게 (= 모집 완료) 하고 찜 + 빈자리 알림을 켬 */
function fillAndWatch(id: string) {
  const m = meetup(id)
  m.capacity = S.confirmedOf(m)
  S.setWish(id, true); S.setAlert(id, true)
  expect(S.recruitOf(m)).toBe('closed')
}

beforeEach(async () => {
  sessionStorage.setItem('digul.api.knobs', 'fast')
  vi.resetModules()
  api = (await import('../api/meetups/mock')).mock
  ids = await import('../api/common/ids')
  map = await import('../api/meetups/mappers')
  S = await import('../data/meetupStore')
  N = await import('../data/notifications')
})

describe('빈자리 알림 발송', () => {
  it('내보내기: 정원이 차 있던 모임(m3, 내가 연 모임)에서 한 명을 내보내면 알림 한 개', async () => {
    fillAndWatch('m3')
    const before = vacancyCount('m3')
    const guest = S.membersOf('m3')[0]
    await api.kick(app('m3', guest))
    expect(vacancyCount('m3')).toBe(before + 1)
  })

  it('정원 늘림: 모집 완료였던 모임의 정원을 늘리면 알림 한 개, 정원을 그대로 두고 다른 걸 고치면 없음', async () => {
    fillAndWatch('m3')
    const before = vacancyCount('m3')
    const body = map.toUpdateRequest(S.draftOf(meetup('m3')))
    await api.update(n('m3'), { ...body, title: '이름만 바꿈' })
    expect(vacancyCount('m3')).toBe(before)
    await api.update(n('m3'), { ...body, capacity: body.capacity + 1 })
    expect(vacancyCount('m3')).toBe(before + 1)
  })

  it('참여 취소: 내가 참여 확정한 모집 완료 모임에서 참여를 취소하면 알림 한 개', async () => {
    const m = S.getMeetupState().list.find((x) => S.myOf(x.id)?.st === 'joined' && S.canQuit(x) && !S.deadlinePassed(x))!
    expect(m).toBeTruthy()
    fillAndWatch(m.id)
    const before = vacancyCount(m.id)
    await api.cancelParticipation(n(m.id))
    expect(vacancyCount(m.id)).toBe(before + 1)
  })

  it('알림을 켜지 않았으면 만들지 않음', async () => {
    const m = meetup('m3')
    m.capacity = S.confirmedOf(m)
    const before = vacancyCount('m3')
    await api.kick(app('m3', S.membersOf('m3')[0]))
    expect(vacancyCount('m3')).toBe(before)
  })

  it('정원이 차 있지 않았으면 만들지 않음 (자리가 이미 있던 모임)', async () => {
    S.setWish('m3', true); S.setAlert('m3', true)
    expect(S.leftOf(meetup('m3'))).toBeGreaterThan(0)
    const before = vacancyCount('m3')
    await api.kick(app('m3', S.membersOf('m3')[0]))
    expect(vacancyCount('m3')).toBe(before)
  })

  it('모집 마감 시각이 지난 모임은 자리가 나도 모집 중이 아니라서 만들지 않음', async () => {
    fillAndWatch('m3')
    meetup('m3').deadline = '2026-11-03T09:00:00+09:00' // 지금(11-03 12:00)보다 앞
    expect(S.deadlinePassed(meetup('m3'))).toBe(true)
    const before = vacancyCount('m3')
    await api.kick(app('m3', S.membersOf('m3')[0]))
    expect(vacancyCount('m3')).toBe(before)
  })

  it('알림 설정에서 모임 소식을 꺼 두면 만들지 않음 (addNotice 규칙 그대로)', async () => {
    fillAndWatch('m3')
    N.setNoticeKind('모임', false)
    const before = vacancyCount('m3')
    await api.kick(app('m3', S.membersOf('m3')[0]))
    expect(vacancyCount('m3')).toBe(before)
  })
})
