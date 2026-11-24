/**
 * 07 모임 API v1 (docs/backend/team-spec/api/07-meetup.md) — 목 서버가 명세 모양 · 규칙 · 에러 code 대로 답하는지, 매퍼 · 쓰기 본문
 * 시간 기준: 목 데이터의 지금 = 2026-11-03 12:00 (서울). 저장소는 테스트마다 처음 상태로 (vi.resetModules)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MockMod from '../api/meetups/mock'
import type * as Ids from '../api/common/ids'
import type * as Mappers from '../api/meetups/mappers'
import type * as Store from '../data/meetupStore'
import { ENDPOINTS } from '../api/meetups/real'
import { isUtcInstant } from '../lib/time'

let api: typeof MockMod.mock
let ids: typeof Ids
let map: typeof Mappers
let S: typeof Store
const n = (appId: string) => ids.toDtoId(appId)
const app = (meetupId: string, userId: string) => n(`${meetupId}:${userId}`)
/** 실패한 호출의 code */
const codeOf = async (p: Promise<unknown>) => p.then(() => 'OK', (e: { code?: string }) => e.code ?? String(e))

beforeEach(async () => {
  sessionStorage.setItem('digul.api.knobs', 'fast') // 목 서버 지연 없이
  vi.resetModules()
  api = (await import('../api/meetups/mock')).mock
  ids = await import('../api/common/ids')
  map = await import('../api/meetups/mappers')
  S = await import('../data/meetupStore')
})

describe('완성도', () => {
  it('ENDPOINTS 20개 = 명세 07 의 API 모두', () => {
    expect(ENDPOINTS).toHaveLength(20)
    expect(new Set(ENDPOINTS).size).toBe(20)
  })
})

describe('GET /meetups', () => {
  it('지난 · 취소된 모임은 주지 않고(OPEN · CLOSED 만), 모집 완료는 어느 정렬이든 뒤', async () => {
    for (const sort of ['STARTS_SOON', 'NEWEST', 'POPULAR', 'MOST_JOINED'] as const) {
      const r = await api.list({ sort, size: 24 })
      const st = r.items.map((x) => x.recruitStatus)
      expect(st.every((x) => x === 'OPEN' || x === 'CLOSED'), sort).toBe(true)
      expect(st.indexOf('CLOSED') === -1 || st.slice(st.indexOf('CLOSED')).every((x) => x === 'CLOSED'), sort).toBe(true)
    }
  })
  it('카드 모양: 숫자 id · UTC 시각 · 대문자 enum · 온라인 place null', async () => {
    const r = await api.list({ size: 24 })
    for (const c of r.items) {
      expect(typeof c.id).toBe('number')
      expect(isUtcInstant(c.startsAt)).toBe(true)
      expect(['HOBBY', 'FOOD', 'STUDY', 'ETC', 'GAME', 'EXERCISE']).toContain(c.category)
      if (c.mode === 'ONLINE') expect(c.place).toBeNull()
      expect(Object.keys(c).sort()).toEqual(['capacity', 'category', 'confirmedCount', 'endsAt', 'id', 'mode', 'place', 'recruitStatus', 'startsAt', 'title'])
    }
  })
  it('가까운 날짜순(기본), 페이지 { page, size, totalItems, totalPages }', async () => {
    const r = await api.list({})
    expect(r).toMatchObject({ page: 1, size: 6 })
    expect(r.totalPages).toBe(Math.ceil(r.totalItems / 6))
    const open = r.items.filter((x) => x.recruitStatus === 'OPEN').map((x) => x.startsAt)
    expect([...open].sort()).toEqual(open)
  })
  it('검색어는 이름 · 소개에서, 카테고리 · 방식 · 날짜(서울 날짜)는 함께 적용', async () => {
    expect((await api.list({ keyword: '독서', size: 24 })).items.map((x) => x.title)).toContain('주말의 작은 독서 모임')
    const g = await api.list({ categories: ['GAME', 'EXERCISE'], size: 24 })
    expect(g.items.length).toBeGreaterThan(0)
    for (const c of g.items) expect(['GAME', 'EXERCISE']).toContain(c.category)
    for (const c of (await api.list({ mode: 'ONLINE', size: 24 })).items) expect(c.mode).toBe('ONLINE')
    const d = await api.list({ dateFrom: '2026-11-08', dateTo: '2026-11-08', size: 24 })
    expect(d.items.map((x) => map.toMeetup(x).date)).toEqual(d.items.map(() => '2026-11-08'))
  })
  it('정해진 값 밖이면 400 INVALID_INPUT (size=10, dateTo < dateFrom)', async () => {
    expect(await codeOf(api.list({ size: 10 as never }))).toBe('INVALID_INPUT')
    expect(await codeOf(api.list({ dateFrom: '2026-11-10', dateTo: '2026-11-09' }))).toBe('INVALID_INPUT')
  })
})

describe('GET /meetups/{meetupId} — 내 상태 · can*', () => {
  it('미신청(m6): canApply, 좌석은 주최자부터, 대화방 없음', async () => {
    const d = await api.get(n('m6'))
    expect(d).toMatchObject({ myStatus: 'NONE', canApply: true, canCancelParticipation: false, canEdit: false, chatRoomId: null, joinUrl: null })
    expect(d.participants[0].isHost).toBe(true)
    expect(d.confirmedCount).toBe(d.participants.length)
  })
  it('참여 확정(m1): 대화방 id, 24시간 전이라 참여 취소 가능, 나도 좌석에', async () => {
    const d = await api.get(n('m1'))
    expect(d).toMatchObject({ myStatus: 'CONFIRMED', canApply: false, canCancelParticipation: true })
    expect(ids.toAppId(d.chatRoomId!)).toBe('g-m1')
    expect(d.participants.some((p) => p.isMe)).toBe(true)
  })
  it('주최자: 확정자가 있으면 canCancel(m3), 없으면 canDelete(x4)', async () => {
    expect(await api.get(n('m3'))).toMatchObject({ myStatus: 'HOST', canEdit: true, canCancel: true, canDelete: false })
    expect(await api.get(n('x4'))).toMatchObject({ myStatus: 'HOST', canCancel: false, canDelete: true })
  })
  it('지난(p1) · 취소(p4) · 모집 완료(x3) 모집 상태', async () => {
    expect((await api.get(n('p1'))).recruitStatus).toBe('PAST')
    expect((await api.get(n('p4'))).recruitStatus).toBe('CANCELED')
    expect(await api.get(n('x3'))).toMatchObject({ recruitStatus: 'CLOSED', canApply: false })
  })
  it('온라인 접속 링크는 주최자 · 확정자에게만', async () => {
    expect((await api.get(n('m5'))).joinUrl).toBeNull() // 찜만 한 사람
  })
  it('없는 모임은 404 MEETUP_NOT_FOUND', async () => {
    expect(await codeOf(api.get(n('nope')))).toBe('MEETUP_NOT_FOUND')
  })
})

describe('신청 · 신청 취소 · 참여 취소', () => {
  it('신청 → PENDING, 다시 신청은 MEETUP_ALREADY_APPLIED, 신청 취소 → NONE → 다시 신청 가능', async () => {
    const r = await api.apply(n('m6'), { message: '안녕하세요' })
    expect(typeof r.meetupApplicationId).toBe('number')
    expect((await api.get(n('m6'))).myStatus).toBe('PENDING')
    expect(await codeOf(api.apply(n('m6'), { message: null }))).toBe('MEETUP_ALREADY_APPLIED')
    await api.withdrawApplication(n('m6'))
    expect(await api.get(n('m6'))).toMatchObject({ myStatus: 'NONE', canApply: true })
    expect(await codeOf(api.withdrawApplication(n('m6')))).toBe('OK') // 이미 취소 → 성공
  })
  it('내 모임에 신청하면 403 OWN_MEETUP_NOT_ALLOWED, 모집 완료면 MEETUP_NOT_RECRUITING, 남길 말 100자 넘으면 INVALID_INPUT', async () => {
    expect(await codeOf(api.apply(n('m3'), { message: null }))).toBe('OWN_MEETUP_NOT_ALLOWED')
    expect(await codeOf(api.apply(n('x3'), { message: null }))).toBe('MEETUP_NOT_RECRUITING')
    expect(await codeOf(api.apply(n('m6'), { message: 'a'.repeat(101) }))).toBe('INVALID_INPUT')
  })
  it('참여 취소 → CANCELED (다시 신청 불가: MEETUP_REAPPLY_NOT_ALLOWED), 확정 전이면 MEETUP_APPLICATION_NOT_FOUND', async () => {
    expect(await codeOf(api.cancelParticipation(n('m2')))).toBe('MEETUP_APPLICATION_NOT_FOUND')
    await api.cancelParticipation(n('m1'))
    expect(await api.get(n('m1'))).toMatchObject({ myStatus: 'CANCELED', chatRoomId: null })
    expect(await codeOf(api.apply(n('m1'), { message: null }))).toBe('MEETUP_REAPPLY_NOT_ALLOWED')
    expect(await codeOf(api.cancelParticipation(n('m1')))).toBe('OK') // 같은 버튼 두 번
  })
  it('시작 24시간 전이 지나면 409 MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED', async () => {
    S.getMeetupState().my.m9 = { st: 'joined' }
    S.getMeetupState().list.find((m) => m.id === 'm9')!.date = '2026-11-04'
    S.getMeetupState().list.find((m) => m.id === 'm9')!.start = '오전 9:00'
    expect((await api.get(n('m9'))).canCancelParticipation).toBe(false)
    expect(await codeOf(api.cancelParticipation(n('m9')))).toBe('MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED')
  })
  it('신청 취소를 눌렀는데 이미 수락됨 → 409 MEETUP_APPLICATION_ALREADY_CONFIRMED', async () => {
    expect(await codeOf(api.withdrawApplication(n('m1')))).toBe('MEETUP_APPLICATION_ALREADY_CONFIRMED')
  })
})

describe('찜 · 빈자리 알림', () => {
  it('찜하지 않은 모임에 알림을 켜면 409 MEETUP_NOT_LIKED, 찜을 풀면 알림도 꺼짐', async () => {
    expect(await codeOf(api.enableVacancyAlert(n('m6')))).toBe('MEETUP_NOT_LIKED')
    expect(await api.like(n('m6'))).toEqual({ isLiked: true })
    expect(await api.enableVacancyAlert(n('m6'))).toEqual({ hasVacancyAlert: true })
    expect(await api.get(n('m6'))).toMatchObject({ isLiked: true, hasVacancyAlert: true })
    expect(await api.unlike(n('m6'))).toEqual({ isLiked: false })
    await api.like(n('m6'))
    expect((await api.get(n('m6'))).hasVacancyAlert).toBe(false) // 다시 찜하면 알림은 꺼진 채
  })
  it('찜 · 찜 풀기 · 알림 끄기는 같은 값이면 그대로 성공', async () => {
    await api.like(n('m6')); await api.like(n('m6'))
    expect(S.getMeetupState().wish.filter((x) => x === 'm6')).toHaveLength(1)
    expect(await codeOf(api.unlike(n('m9')))).toBe('OK')
    expect(await codeOf(api.disableVacancyAlert(n('m9')))).toBe('OK')
  })
})

describe('신청 관리 (주최자)', () => {
  it('PENDING 먼저 · CONFIRMED 뒤, 주최자는 없음, 남의 모임은 403', async () => {
    const r = await api.applications(n('m3'))
    const st = r.items.map((x) => x.status)
    expect(st.slice(0, r.pendingCount).every((x) => x === 'PENDING')).toBe(true)
    expect(st.slice(r.pendingCount).every((x) => x === 'CONFIRMED')).toBe(true)
    expect(r.items.every((x) => ids.toAppId(x.user.id) !== 'me')).toBe(true)
    expect(r.canManage).toBe(true)
    expect(await codeOf(api.applications(n('m1')))).toBe('FORBIDDEN')
  })
  it('수락 → 확정, 정원이 차면 409 MEETUP_FULL, 거절 · 내보내기는 두 번 눌러도 성공', async () => {
    await api.accept(app('m3', 'yerin'))
    expect(S.membersOf('m3')).toContain('yerin')
    expect(await codeOf(api.accept(app('m3', 'yerin')))).toBe('OK')
    S.getMeetupState().list.find((m) => m.id === 'm3')!.capacity = 4
    expect(await codeOf(api.accept(app('m3', 'yejin')))).toBe('MEETUP_FULL')
    await api.reject(app('m3', 'yejin'))
    expect(await codeOf(api.reject(app('m3', 'yejin')))).toBe('OK')
    expect(await codeOf(api.accept(app('m3', 'yejin')))).toBe('MEETUP_APPLICATION_NOT_FOUND')
    await api.kick(app('m3', 'yerin'))
    expect(await codeOf(api.kick(app('m3', 'yerin')))).toBe('OK')
    expect(await codeOf(api.kick(app('m3', 'nobody')))).toBe('MEETUP_APPLICATION_NOT_FOUND')
  })
})

describe('만들기 · 수정 · 취소 · 삭제', () => {
  const form = (): Store.Draft => ({
    cap: 6, prep: '', askMsg: false, ymd: '2026-11-20', start: '오후 7:00', end: '오후 9:00', deadline: '2026-11-19T18:00',
    mode: '오프라인', place: '역삼역 3번 출구', placeDetail: '', link: '', title: '새 모임', intro: '', category: '운동',
  })
  it('양식 → 본문: UTC 시각 · 카테고리 코드 · 빈 칸은 null', () => {
    const r = map.toCreateRequest(form())
    expect(r).toMatchObject({
      title: '새 모임', category: 'EXERCISE', description: null, supplies: null, isMessageEnabled: false,
      startsAt: '2026-11-20T10:00:00Z', endsAt: '2026-11-20T12:00:00Z', recruitDeadlineAt: '2026-11-19T09:00:00Z',
      mode: 'OFFLINE', place: '역삼역 3번 출구', placeDetail: null, joinUrl: null,
    })
    expect('recruitDeadlineAt' in map.toUpdateRequest(form())).toBe(false)
  })
  it('POST /meetups → { meetupId, chatRoomId }, 만든 모임은 확정 1명 · OPEN · 주최자', async () => {
    const r = await api.create(map.toCreateRequest(form()))
    const d = await api.get(r.meetupId)
    expect(d).toMatchObject({ confirmedCount: 1, recruitStatus: 'OPEN', myStatus: 'HOST', isMessageEnabled: false, canDelete: true })
    expect(ids.toAppId(r.chatRoomId)).toBe(`g-${ids.toAppId(r.meetupId)}`)
  })
  it('입력 오류는 400 INVALID_INPUT + fields (끝 < 시작, 오프라인 장소 없음)', async () => {
    const bad = { ...map.toCreateRequest(form()), endsAt: '2026-11-20T09:00:00Z', place: null }
    const e = await api.create(bad).catch((x) => x)
    expect(e.code).toBe('INVALID_INPUT')
    expect(e.fields.map((f: { field: string }) => f.field).sort()).toEqual(['endsAt', 'place'])
  })
  it('PATCH: 정원은 확정 인원보다 적을 수 없음(400), 시작 12시간 전이 지나면 409 MEETUP_EDIT_NOT_ALLOWED', async () => {
    const body = map.toUpdateRequest(S.draftOf(S.findMeetup('m3')!))
    expect(await codeOf(api.update(n('m3'), { ...body, capacity: 2 }))).toBe('INVALID_INPUT')
    expect(await api.update(n('m3'), { ...body, title: '바뀐 이름' })).toBeNull()
    expect((await api.get(n('m3'))).title).toBe('바뀐 이름')
    S.getMeetupState().list.find((m) => m.id === 'm3')!.date = '2026-11-03'
    S.getMeetupState().list.find((m) => m.id === 'm3')!.start = '오후 11:00'
    expect(await codeOf(api.update(n('m3'), body))).toBe('MEETUP_EDIT_NOT_ALLOWED')
    expect(await codeOf(api.update(n('m1'), body))).toBe('FORBIDDEN')
  })
  it('취소는 확정자가 있을 때만(없으면 409 MEETUP_CANCEL_NOT_ALLOWED), 삭제는 확정자가 없을 때만(있으면 409 MEETUP_DELETE_NOT_ALLOWED)', async () => {
    expect(await codeOf(api.cancel(n('x4')))).toBe('MEETUP_CANCEL_NOT_ALLOWED')
    expect(await codeOf(api.remove(n('m3')))).toBe('MEETUP_DELETE_NOT_ALLOWED')
    await api.cancel(n('m3'))
    expect((await api.get(n('m3'))).recruitStatus).toBe('CANCELED')
    expect(await codeOf(api.cancel(n('m3')))).toBe('OK') // 이미 취소 → 성공
    await api.remove(n('x4'))
    expect(await codeOf(api.get(n('x4')))).toBe('MEETUP_NOT_FOUND')
  })
})

describe('내 모임 · 요약 · 캘린더', () => {
  it('탭: UPCOMING = HOST · CONFIRMED, PENDING = PENDING · REJECTED, PAST = 시작했거나 취소된 HOST · CONFIRMED', async () => {
    const up = (await api.mine('UPCOMING')).items
    expect(up.every((x) => ['HOST', 'CONFIRMED'].includes(x.myStatus) && x.recruitStatus !== 'PAST' && x.recruitStatus !== 'CANCELED')).toBe(true)
    expect(up.map((x) => x.startsAt)).toEqual([...up.map((x) => x.startsAt)].sort())
    const pend = (await api.mine('PENDING')).items
    expect(pend.every((x) => ['PENDING', 'REJECTED'].includes(x.myStatus))).toBe(true)
    const past = (await api.mine('PAST')).items
    expect(past.map((x) => ids.toAppId(x.id))).toEqual(expect.arrayContaining(['p1', 'p4']))
    expect(past.find((x) => ids.toAppId(x.id) === 'p4')!.recruitStatus).toBe('CANCELED')
    const host = (await api.mine('HOSTING')).items.find((x) => ids.toAppId(x.id) === 'm3')!
    expect(host.pendingCount).toBe(3)
    expect(await codeOf(api.mine('NOPE' as never))).toBe('INVALID_INPUT')
  })
  it('찜 탭: 모집 완료를 뒤로, 지난 모임은 빠짐', async () => {
    const liked = (await api.mine('LIKED')).items
    const st = liked.map((x) => x.recruitStatus)
    expect(st.every((x) => x === 'OPEN' || x === 'CLOSED')).toBe(true)
    expect(st.indexOf('CLOSED') === -1 || st.slice(st.indexOf('CLOSED')).every((x) => x === 'CLOSED')).toBe(true)
  })
  it('요약: 탭 개수 = 탭 목록 길이, 가까운 내 모임 5개까지(HOST · CONFIRMED · PENDING)', async () => {
    const s = await api.summary()
    for (const [k, tab] of [['upcoming', 'UPCOMING'], ['pending', 'PENDING'], ['hosting', 'HOSTING'], ['liked', 'LIKED'], ['past', 'PAST']] as const) {
      expect(s.counts[k], k).toBe((await api.mine(tab)).items.length)
    }
    expect(s.upcomingItems.length).toBeLessThanOrEqual(5)
    expect(s.upcomingItems.every((x) => ['HOST', 'CONFIRMED', 'PENDING'].includes(x.myStatus))).toBe(true)
  })
  it('캘린더: 그 달(서울 날짜)의 모임, 취소 제외 · 지난 모임 포함, MINE 은 내 모임만, 요약은 보기와 상관없음', async () => {
    const mine = await api.calendar({ year: 2026, month: 11, scope: 'MINE' })
    const all = await api.calendar({ year: 2026, month: 11, scope: 'ALL' })
    expect(mine.summary).toEqual(all.summary)
    expect(all.items.length).toBeGreaterThan(mine.items.length)
    expect(mine.items.every((x) => ['HOST', 'CONFIRMED', 'PENDING'].includes(x.myStatus))).toBe(true)
    expect(all.items.some((x) => x.recruitStatus === 'CANCELED')).toBe(false)
    expect(all.items.every((x) => map.toMeetup(x).date.startsWith('2026-11-'))).toBe(true)
    expect(await codeOf(api.calendar({ year: 2026, month: 13 }))).toBe('INVALID_INPUT')
  })
})

describe('매퍼', () => {
  it('상세 → 앱: 모집 상태 · 내 상태 · can · 대화방 앱 id · 마감(서울)', async () => {
    const vm = map.toMeetupDetail(await api.get(n('m1')))
    expect(vm).toMatchObject({ recruit: 'open', my: 'CONFIRMED', chatRoomId: 'g-m1', deadline: '2026-11-08T10:00' })
    expect(vm.meetup).toMatchObject({ id: 'm1', date: '2026-11-08', start: '오후 2:00', end: '오후 4:00', category: '취미/문화' })
    expect(vm.seats[0].isHost).toBe(true)
  })
  it('신청 관리 → 앱: 신청 앱 id 는 "모임:사람"', async () => {
    const vm = map.toApplications(await api.applications(n('m3')))
    expect(vm.pending.map((x) => x.id)).toContain('m3:yerin')
    expect(vm.confirmedList.length).toBe(2)
  })
})

describe('화면은 모임 API 로만 읽고 씀', () => {
  it('screens/meetups 는 모임 저장소(data/meetupStore)에서 타입 · 표기 함수만 가져옴 (상태 · 쓰기 함수 없음)', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string; readdirSync(p: string): string[] }
    const ALLOWED = new Set(['type MeetupX', 'type Draft', 'ddayOf', 'daysLeft', 'hourLabel', 'placeLine', 'parseHour', 'deadlineLabel', 'draftOf', 'startMs', 'TODAY', 'endNotAfterStart', 'deadlineAfterStart', 'NOW'])  // TODAY: 화면의 "오늘"(실제 모드는 진짜 오늘, 목 모드는 목 데이터의 오늘)
    for (const f of fs.readdirSync('src/screens/meetups').filter((x) => x.endsWith('.tsx'))) {
      const src = fs.readFileSync(`src/screens/meetups/${f}`, 'utf8')
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'..\/..\/data\/meetupStore'/g)) {
        for (const name of m[1].split(',').map((x) => x.trim()).filter(Boolean)) expect(ALLOWED.has(name), `${f}: ${name}`).toBe(true)
      }
    }
  })
})

describe('모임 끝나는 시간 검사 (endNotAfterStart)', () => {
  it('같은 날: 시작보다 앞이거나 같으면 막음 / 뒤면 통과', async () => {
    const { endNotAfterStart } = await import('../data/meetupStore')
    expect(endNotAfterStart('오후 2:00', '오후 1:00')).toBe(true)
    expect(endNotAfterStart('오후 2:00', '오후 2:00')).toBe(true)
    expect(endNotAfterStart('오후 2:00', '오후 4:00')).toBe(false)
    expect(endNotAfterStart('오후 2:00', '')).toBe(false)
  })
  it("다음 날 끝나는 모임('다음 날 오전 8:00')은 시작보다 뒤로 봄 → 수정 화면에서 다른 항목을 저장할 수 있음 (PR #37 Codex 리뷰 P1, 명세 07)", async () => {
    const { endNotAfterStart } = await import('../data/meetupStore')
    expect(endNotAfterStart('오후 11:00', '다음 날 오전 8:00')).toBe(false)
    const { toUpdateRequest } = await import('../api/meetups/mappers')
    const { draftOf } = await import('../data/meetupStore')
    const req = toUpdateRequest(draftOf({ id: 'x', title: '밤샘 코딩', category: '스터디/프로젝트', date: '2026-12-01', start: '오후 11:00', end: '다음 날 오전 8:00', area: '', place: '', mode: '온라인', capacity: 4, memberIds: [], hostId: 'h', sign: '', intro: '' } as never))
    expect(Date.parse(req.endsAt!) - Date.parse(req.startsAt)).toBe(9 * 3_600_000)
  })
})

describe('참여 취소 뒤 대화방 캐시', () => {
  it('참여를 취소하면 모임 대화방 · 메시지 · 대화 목록도 다시 받음 (명세 06 참여 취소 = 대화방에서 나감, PR #37 Codex 리뷰 P1)', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string }
    const src = fs.readFileSync('src/screens/meetups/MeetupDetail.tsx', 'utf8')
    expect(src).toMatch(/cancelParticipation\(m\.id\)[\s\S]{0,200}invalidate: \[meetupKeys\.all, chatKeys\.rooms, \.\.\.\(data\.chatRoomId \? \[chatKeys\.room\(data\.chatRoomId\), chatKeys\.messages\(data\.chatRoomId\)\]/)
  })
})

describe('모집 마감 검사 (deadlineAfterStart)', () => {
  it('마감이 시작 시각과 같으면 통과, 뒤면 막음 (명세 07: startsAt 보다 늦을 수 없다, PR #37 Codex 리뷰 P1)', async () => {
    const { deadlineAfterStart } = await import('../data/meetupStore')
    expect(deadlineAfterStart('2026-12-01T14:00', '2026-12-01', '오후 2:00')).toBe(false)
    expect(deadlineAfterStart('2026-12-01T13:30', '2026-12-01', '오후 2:00')).toBe(false)
    expect(deadlineAfterStart('2026-12-01T14:10', '2026-12-01', '오후 2:00')).toBe(true)
    expect(deadlineAfterStart('', '2026-12-01', '오후 2:00')).toBe(false)
  })
  it('마감 입력의 최솟값은 목 데이터의 정오가 아니라 지금(NOW) 기준 (PR #37 Codex 리뷰 P1)', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string }
    const src = fs.readFileSync('src/screens/meetups/MeetupNew.tsx', 'utf8')
    expect(src).toMatch(/min=\{msToWall\(NOW\)\}/)
    expect(src).not.toMatch(/T12:00`\}/)
  })
})

