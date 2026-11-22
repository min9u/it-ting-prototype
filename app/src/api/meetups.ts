/**
 * 모임 (F7). 계약: docs/backend/api-draft.md "모임"
 * 목 구현은 data/meetupStore.ts 를 가짜 서버로 씀 (목록 거르기·정렬·페이지도 여기서 = 서버가 할 일)
 */
import { API_MODE } from './config'
import { http } from './client'
import { conflict, emptyPage, forbidden, mockRead, mockWrite, notFound, paginate } from './mock/server'
import { meetupCard, meetupDetail, memberProfile } from './mock/serialize'
import { ME_ID } from '../data/mock'
import { meetupCategoryOf } from '../data/meetupCategory'
import {
  accept, apply, applicantsOf, canQuit, canReapply, cancelMeetup, confirmedOf, deleteMeetup, findMeetup, getMeetupState, kick, leftOf,
  myOf, quit, recruitOf, reject, report, startMs, toggleAlert, toggleWish, withdraw, type MeetupX,
  PLATFORMS, canEdit, createMeetup, updateMeetup, type Draft,
} from '../data/meetupStore'
import { msToWall, parseIso, seoulParts, seoulYmd, toIso } from '../lib/time'
import type { ApplicantDto, Id, MeetupCardDto, MeetupDetailDto, MeetupListQuery, MeetupWriteRequest, PageDto, ReportReason } from './types'

export type MyMeetupTab = 'UPCOMING' | 'PENDING' | 'HOSTING' | 'LIKED' | 'PAST'

const real = {
  /** GET /meetups — 모임 탐색 (번호 페이지) */
  list: (q: MeetupListQuery, signal?: AbortSignal) => http.get<PageDto<MeetupCardDto>>('/meetups', { ...q, categories: q.categories }, signal),
  /** GET /meetups/{id} */
  get: (id: Id, signal?: AbortSignal) => http.get<MeetupDetailDto>(`/meetups/${id}`, undefined, signal),
  /** POST /meetups/{id}/applications — 참여 신청 (409 MEETUP_FULL · ALREADY_APPLIED · REAPPLY_BLOCKED · RECRUIT_CLOSED) */
  apply: (id: Id, message: string | null) => http.post<MeetupDetailDto>(`/meetups/${id}/applications`, { message }),
  /** DELETE /meetups/{id}/applications/me — 신청 취소 (확정 전) */
  withdraw: (id: Id) => http.delete<MeetupDetailDto>(`/meetups/${id}/applications/me`),
  /** POST /meetups/{id}/leave — 참여 취소 (확정 후, 시작 24시간 전까지. 409 LEAVE_TOO_LATE) */
  quit: (id: Id) => http.post<MeetupDetailDto>(`/meetups/${id}/leave`),
  /** PUT·DELETE /meetups/{id}/like — 찜 (멱등) */
  setLike: (id: Id, on: boolean) => (on ? http.put<void>(`/meetups/${id}/like`) : http.delete<void>(`/meetups/${id}/like`)),
  /** PUT /meetups/{id}/like/vacancy-alert — 빈자리 알림 */
  setVacancyAlert: (id: Id, on: boolean) => http.put<void>(`/meetups/${id}/like/vacancy-alert`, { on }),
  /** POST /reports (targetType MEETUP) — 신고는 api/reports 로도 보낼 수 있음 */
  report: (id: Id, reason: ReportReason, detail: string | null) => http.post<void>('/reports', { targetType: 'MEETUP', targetId: id, reason, detail }),
  /** GET /me/meetups?tab= — 내 모임 탭 */
  mine: (tab: MyMeetupTab, signal?: AbortSignal) => http.get<MeetupCardDto[]>('/me/meetups', { tab }, signal),
  /** GET /meetups/{id}/applications — 신청 관리 (주최자) */
  applicants: (id: Id, signal?: AbortSignal) => http.get<ApplicantDto[]>(`/meetups/${id}/applications`, { status: 'PENDING' }, signal),
  approve: (id: Id, applicationId: Id) => http.post<void>(`/meetups/${id}/applications/${applicationId}/approve`),
  reject: (id: Id, applicationId: Id) => http.post<void>(`/meetups/${id}/applications/${applicationId}/reject`),
  kick: (id: Id, memberId: Id) => http.delete<void>(`/meetups/${id}/members/${memberId}`),
  /** POST /meetups/{id}/cancel — 확정자가 있으면 취소(기록 남음), DELETE /meetups/{id} — 확정자 0명이면 삭제 */
  cancel: (id: Id) => http.post<void>(`/meetups/${id}/cancel`),
  remove: (id: Id) => http.delete<void>(`/meetups/${id}`),
  /** POST /meetups — 만들기 (응답: 만든 모임 상세) */
  create: (req: MeetupWriteRequest) => http.post<MeetupDetailDto>('/meetups', req),
  /** PUT /meetups/{id} — 수정 (시작 12시간 전까지, 409 EDIT_TOO_LATE) */
  update: (id: Id, req: MeetupWriteRequest) => http.put<MeetupDetailDto>(`/meetups/${id}`, req),
}
export type MeetupsApi = typeof real

/* ===== 목 서버 ===== */
const SORTS: Record<NonNullable<MeetupListQuery['sort']>, (a: MeetupX, b: MeetupX) => number> = {
  STARTS_AT: (a, b) => startMs(a) - startMs(b),
  NEWEST: (a, b) => b.seq - a.seq,
  POPULAR: (a, b) => b.likes - a.likes || startMs(a) - startMs(b),
  MEMBERS: (a, b) => confirmedOf(b) - confirmedOf(a) || startMs(a) - startMs(b),
}
const detailOrThrow = (id: Id) => { if (!findMeetup(id)) throw notFound('모임'); return meetupDetail(id) }

const mock: MeetupsApi = {
  list: (q, signal) => mockRead(() => {
    const s = getMeetupState()
    let l = s.list.filter((m) => recruitOf(m, s) !== 'past' && recruitOf(m, s) !== 'cancelled')
    const k = q.q?.trim()
    if (k) l = l.filter((m) => m.title.includes(k) || m.intro.includes(k))
    if (q.categories?.length) l = l.filter((m) => q.categories!.includes(meetupCategoryOf(m.category)?.code ?? ''))
    if (q.from) l = l.filter((m) => m.date >= q.from!)
    if (q.to) l = l.filter((m) => m.date <= q.to!)
    if (q.mode) l = l.filter((m) => (q.mode === 'ONLINE' ? m.mode === '온라인' : m.mode === '오프라인'))
    l.sort(SORTS[q.sort ?? 'STARTS_AT'])
    // 모집 완료는 맨 뒤 (명세 F7 리스트 5)
    const closed = (m: MeetupX) => recruitOf(m, s) === 'closed'
    l = [...l.filter((m) => !closed(m)), ...l.filter(closed)]
    const page = paginate(l, q.page, q.size ?? 6)
    return { ...page, items: page.items.map((m) => meetupCard(m, s)) }
  }, { signal, empty: () => emptyPage(q.size ?? 6) }),
  get: (id, signal) => mockRead(() => detailOrThrow(id), { signal, detail: true }),
  apply: (id, message) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw notFound('모임')
    if (!canReapply(myOf(id))) throw conflict('REAPPLY_BLOCKED', '이 모임에는 다시 신청할 수 없어요.')
    if (recruitOf(m) !== 'open' || leftOf(m) <= 0) throw conflict('MEETUP_FULL', '정원이 다 찼어요.')
    apply(id, message ?? '')
    return meetupDetail(id)
  }),
  withdraw: (id) => mockWrite(() => { if (myOf(id)?.st !== 'pending') throw conflict('NOT_PENDING', '확인을 기다리는 신청이 없어요.'); withdraw(id); return detailOrThrow(id) }),
  quit: (id) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw notFound('모임')
    if (!canQuit(m)) throw conflict('LEAVE_TOO_LATE', '시작 24시간 전부터는 참여를 취소할 수 없어요.')
    quit(id)
    return meetupDetail(id)
  }),
  setLike: (id, on) => mockWrite(() => { if (getMeetupState().wish.includes(id) !== on) toggleWish(id) }),
  setVacancyAlert: (id, on) => mockWrite(() => { if (getMeetupState().alerts.includes(id) !== on) toggleAlert(id) }),
  report: (id) => mockWrite(() => { if (getMeetupState().reported.includes(id)) throw conflict('ALREADY_REPORTED', '이미 신고한 모임이에요.'); report(id) }),
  mine: (tab, signal) => mockRead(() => {
    const s = getMeetupState()
    const st = (m: MeetupX) => myOf(m.id, s)?.st
    const live = (m: MeetupX) => recruitOf(m, s) !== 'past' && !m.cancelled
    const pick: Record<MyMeetupTab, (m: MeetupX) => boolean> = {
      UPCOMING: (m) => live(m) && (st(m) === 'joined' || st(m) === 'host'),
      PENDING: (m) => live(m) && (st(m) === 'pending' || st(m) === 'rejected'),
      HOSTING: (m) => live(m) && st(m) === 'host',
      LIKED: (m) => live(m) && s.wish.includes(m.id),
      PAST: (m) => !live(m) && (st(m) === 'joined' || st(m) === 'host'),
    }
    return s.list.filter(pick[tab]).sort((a, b) => startMs(a) - startMs(b)).map((m) => meetupCard(m, s))
  }, { signal, empty: () => [] }),
  applicants: (id, signal) => mockRead(() => {
    const m = findMeetup(id)
    if (!m) throw notFound('모임')
    if (m.hostId !== ME_ID) throw forbidden('주최자만 볼 수 있어요.')
    return applicantsOf(id).map((a) => ({ applicationId: `${id}:${a.userId}`, member: memberProfile(a.userId), message: a.msg || null, createdAt: toIso(a.at) }))
  }, { signal, empty: () => [] }),
  approve: (id, applicationId) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw notFound('모임')
    if (leftOf(m) <= 0) throw conflict('MEETUP_FULL', '정원이 다 찼어요.')
    accept(id, applicationId.split(':')[1])
  }),
  reject: (id, applicationId) => mockWrite(() => reject(id, applicationId.split(':')[1])),
  kick: (id, memberId) => mockWrite(() => kick(id, memberId)),
  cancel: (id) => mockWrite(() => cancelMeetup(id)),
  remove: (id) => mockWrite(() => deleteMeetup(id)),
  create: (req) => mockWrite(() => meetupDetail(createMeetup(draftOfRequest(req)))),
  update: (id, req) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw notFound('모임')
    if (!canEdit(m)) throw conflict('EDIT_TOO_LATE', '시작 12시간 전부터는 고칠 수 없어요.')
    updateMeetup(id, draftOfRequest(req))
    return meetupDetail(id)
  }),
}

/** 요청 본문 → 모임 저장소 양식 값 (목 서버 안에서만) */
function draftOfRequest(r: MeetupWriteRequest): Draft {
  const start = parseIso(r.startsAt)
  const end = r.endsAt ? parseIso(r.endsAt) : null
  const hm = (t: number) => { const { h, mi } = seoulParts(t); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}` }
  const known = (PLATFORMS as readonly string[]).includes(r.platform ?? '')
  return {
    cap: r.capacity, prep: r.supplies ?? '', askMsg: r.acceptsMessage, ymd: seoulYmd(start), start: hm(start), end: end == null ? '' : hm(end),
    deadline: r.recruitDeadlineAt ? msToWall(parseIso(r.recruitDeadlineAt)) : '', mode: r.mode === 'ONLINE' ? '온라인' : '오프라인',
    place: r.place ?? '', placeDetail: r.placeDetail ?? '',
    platform: r.mode === 'ONLINE' ? (known ? r.platform! : '기타') : 'Zoom', platformEtc: known ? '' : r.platform ?? r.place ?? '', link: r.joinUrl ?? '',
    title: r.title, intro: r.description, category: meetupCategoryOf(r.category)?.name ?? r.category, tags: r.tags,
  }
}

export const meetups: MeetupsApi = API_MODE === 'real' ? real : mock
