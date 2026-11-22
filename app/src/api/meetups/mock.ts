/**
 * 07 모임 — 목 서버. data/meetupStore.ts 를 가짜 DB 로 씀 (목록 거르기·정렬·페이지도 여기서 = 서버가 할 일)
 * 위쪽 "직렬화"는 저장소 값 → DTO (실제 서버가 DB 행을 DTO 로 바꾸는 자리)
 */
import { conflict, emptyPage, forbidden, mockRead, mockWrite, notFound, paginate } from '../mock/server'
import { memberProfile, memberSummary } from '../common/mockPeople'
import { ME_ID } from '../../data/mock'
import { meetupCategoryOf } from '../../data/meetupCategory'
import {
  accept, apply, applicantsOf, canQuit, canReapply, cancelMeetup, confirmedOf, deleteMeetup, findMeetup, getMeetupState, kick, leftOf,
  myOf, quit, recruitOf, reject, report, startMs, toggleAlert, toggleWish, withdraw, type MeetupX,
  canEdit, createMeetup, updateMeetup, type Draft, type MeetupState, isoMs, membersOf, parseHour,
} from '../../data/meetupStore'
import { msToWall, parseIso, seoulParts, seoulYmd, toIso } from '../../lib/time'
import type { MeetupsApi } from './real'
import type { ApplicationStatus, MeetupCardDto, MeetupDetailDto, MeetupListQuery, MeetupWriteRequest, MyMeetupTab, RecruitStatus } from './types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const meetupNotFound = () => notFound('MEETUP', '모임을 찾을 수 없습니다.')

/* ===== 직렬화 (저장소 → DTO) ===== */
const RECRUIT: Record<string, RecruitStatus> = { open: 'OPEN', closed: 'CLOSED', past: 'ENDED', cancelled: 'CANCELED' }
/** '다음 날 오전 11:00' 이나 시작보다 이른 끝 시각은 다음 날 */
function endMs(m: MeetupX): number | null {
  if (!m.end) return null
  const h = parseHour(m.end)
  const next = /다음\s*날/.test(m.end) || h < parseHour(m.start)
  return startMs({ ...m, start: m.end }) + (next ? DAY : 0)
}
export function meetupCard(m: MeetupX, s: MeetupState = getMeetupState()): MeetupCardDto {
  return {
    id: m.id, title: m.title, category: meetupCategoryOf(m.category)?.code ?? m.category,
    startsAt: toIso(startMs(m)), endsAt: endMs(m) == null ? null : toIso(endMs(m)!),
    recruitDeadlineAt: m.deadline ? toIso(isoMs(m.deadline)) : null,
    mode: m.mode === '온라인' ? 'ONLINE' : 'OFFLINE', place: m.place || null,
    capacity: m.capacity, confirmedCount: confirmedOf(m, s), likeCount: m.likes, liked: s.wish.includes(m.id),
    recruitStatus: RECRUIT[recruitOf(m, s)], host: memberSummary(m.hostId),
    // 등록 순서(seq)를 등록 시각으로 (최신등록순)
    createdAt: toIso(Date.UTC(2026, 9, 1) + m.seq * HOUR),
    // ERD 에 없는 화면 값 (erd-gaps "모임 카드")
    area: m.area || null, sign: m.sign ?? null,
  }
}
const APP: Record<string, ApplicationStatus> = { pending: 'PENDING', withdrawn: 'CANCELED', joined: 'APPROVED', quit: 'LEFT', kicked: 'KICKED' }
export function meetupDetail(id: string, s: MeetupState = getMeetupState()): MeetupDetailDto {
  const m = findMeetup(id, s)!
  const mine = myOf(id, s)
  const isHost = m.hostId === ME_ID
  const member = isHost || mine?.st === 'joined'
  return {
    ...meetupCard(m, s),
    description: m.intro || null, supplies: m.prep ?? null, acceptsMessage: m.askMsg, placeDetail: m.placeDetail ?? null,
    joinUrl: member ? m.link ?? null : null,
    members: membersOf(id, s).map(memberSummary),
    myApplication: !mine || mine.st === 'host' ? null : {
      id: `app-${id}`, status: mine.st === 'rejected' ? (mine.auto ? 'EXPIRED' : 'REJECTED') : APP[mine.st],
      message: mine.note ?? null, createdAt: toIso(mine.at ?? Date.now()), statusChangedAt: toIso(mine.at ?? Date.now()),
    },
    isHost, vacancyAlert: s.alerts.includes(id), reportedByMe: s.reported.includes(id),
  }
}

/* ===== 목 서버 ===== */
const SORTS: Record<NonNullable<MeetupListQuery['sort']>, (a: MeetupX, b: MeetupX) => number> = {
  STARTS_AT: (a, b) => startMs(a) - startMs(b),
  NEWEST: (a, b) => b.seq - a.seq,
  POPULAR: (a, b) => b.likes - a.likes || startMs(a) - startMs(b),
  MEMBERS: (a, b) => confirmedOf(b) - confirmedOf(a) || startMs(a) - startMs(b),
}
const detailOrThrow = (id: string) => { if (!findMeetup(id)) throw meetupNotFound(); return meetupDetail(id) }

export const mock: MeetupsApi = {
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
  get: (id, signal) => mockRead(() => detailOrThrow(id), { signal, detail: 'MEETUP' }),
  apply: (id, message) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw meetupNotFound()
    if (!canReapply(myOf(id))) throw conflict('REAPPLY_BLOCKED', '이 모임에는 다시 신청할 수 없어요.')
    if (recruitOf(m) !== 'open' || leftOf(m) <= 0) throw conflict('MEETUP_FULL', '정원이 다 찼어요.')
    apply(id, message ?? '')
    return meetupDetail(id)
  }),
  withdraw: (id) => mockWrite(() => { if (myOf(id)?.st !== 'pending') throw conflict('NOT_PENDING', '확인을 기다리는 신청이 없어요.'); withdraw(id); return detailOrThrow(id) }),
  quit: (id) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw meetupNotFound()
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
    if (!m) throw meetupNotFound()
    if (m.hostId !== ME_ID) throw forbidden('주최자만 볼 수 있어요.')
    return applicantsOf(id).map((a) => ({ applicationId: `${id}:${a.userId}`, member: memberProfile(a.userId), message: a.msg || null, createdAt: toIso(a.at) }))
  }, { signal, empty: () => [] }),
  approve: (id, applicationId) => mockWrite(() => {
    const m = findMeetup(id)
    if (!m) throw meetupNotFound()
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
    if (!m) throw meetupNotFound()
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
  return {
    cap: r.capacity, prep: r.supplies ?? '', askMsg: r.acceptsMessage, ymd: seoulYmd(start), start: hm(start), end: end == null ? '' : hm(end),
    deadline: r.recruitDeadlineAt ? msToWall(parseIso(r.recruitDeadlineAt)) : '', mode: r.mode === 'ONLINE' ? '온라인' : '오프라인',
    place: r.place ?? '', placeDetail: r.placeDetail ?? '',
    link: r.joinUrl ?? '',
    title: r.title, intro: r.description, category: meetupCategoryOf(r.category)?.name ?? r.category,
  }
}
