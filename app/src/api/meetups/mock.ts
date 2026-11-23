/**
 * 07 모임 — 목 서버. data/meetupStore.ts 를 가짜 DB 로 써서 명세(api/07-meetup.md)와 같은 응답 · 같은 실패 code 를 낸다.
 * 서버가 계산하는 값(모집 상태 · 내 상태 · can* · 확정 인원 · 탭 나누기 · 정렬 · 페이지)도 여기서 계산한다.
 * 시각 기준은 목 데이터의 지금(meetupStore NOW = TODAY 정오).
 */
import { conflict, emptyPage, forbidden, invalidInput, items, mockRead, mockWrite, notFound, paginate } from '../mock/server'
import { toAppId, toDtoId } from '../common/ids'
import { interestTags, userDisplay } from '../common/mockPeople'
import { ME_ID } from '../../data/mock'
import { meetupCategoryOf } from '../../data/meetupCategory'
import { getChatState, groupRoomId, leaveRoom, roomOf } from '../../data/chat'
import {
  NOW, accept, apply, applicantsOf, cancelMeetup, confirmedOf, createMeetup, deadlinePassed, deleteMeetup, findMeetup, getMeetupState, isPast, isoMs, kick,
  hostDecidesMine, leftOf, membersOf, myOf, parseHour, quit, receiveApplication, recruitClosedByTime, recruitOf, reject, setAlert, setWish, startMs, updateMeetup, withdraw,
  type Draft, type MeetupState, type MeetupX,
} from '../../data/meetupStore'
import { msToWall, parseIso, seoulParts, seoulYmd, toIso } from '../../lib/time'
import { notifyMockUser } from '../notifications/mock'
import { MEETUP_LIMITS } from './errors'
import { pushMockNotification } from '../notifications'
import type { MeetupsApi } from './real'
import type {
  MeetupApplicationItemDto, MeetupCardDto, MeetupCategoryCode, MeetupCreateRequest, MeetupDetailDto, MeetupMyStatus, MeetupSort,
  MyMeetupItemDto, MyMeetupTab, RecruitStatus,
} from './types'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * 서버가 하는 일 (명세 09 MEETUP_VACANCY_OPENED): 정원이 차 있던 모임에 자리가 나면 그 모임에 빈자리 알림을 켠 사람에게 알림.
 * 자리가 나는 길 셋(참여 취소 · 내보내기 · 정원 늘림)이 write 를 이걸로 감쌈. 취소 · 지난 · 모집 마감 시각이 지난 모임은 "모집 중"이 아니라 만들지 않음
 */
function openingSeat(id: string, write: () => void) {
  const before = findMeetup(id)
  const wasFull = !!before && leftOf(before) <= 0
  write()
  const m = findMeetup(id)
  if (!wasFull || !m || leftOf(m) <= 0 || m.cancelled || isPast(m) || deadlinePassed(m)) return
  if (getMeetupState().alerts.includes(m.id)) pushMockNotification('MEETUP_VACANCY_OPENED', { targetId: m.id })
}
const meetupNotFound = () => notFound('MEETUP', '모임을 찾을 수 없습니다.')
const applicationNotFound = () => notFound('MEETUP_APPLICATION', '신청을 찾을 수 없습니다.')
const notHost = () => forbidden('주최자만 할 수 있습니다.')

/* ===== 계산 (서버가 응답을 만들 때 하는 일) ===== */
const RECRUIT: Record<string, RecruitStatus> = { open: 'OPEN', closed: 'CLOSED', past: 'PAST', cancelled: 'CANCELED' }
const MY: Record<string, MeetupMyStatus> = {
  host: 'HOST', withdrawn: 'NONE', pending: 'PENDING', rejected: 'REJECTED', joined: 'CONFIRMED', quit: 'CANCELED', kicked: 'KICKED', mcancel: 'MEETUP_CANCELED',
}
export const myStatusOf = (id: string, s: MeetupState = getMeetupState()): MeetupMyStatus => MY[myOf(id, s)?.st ?? ''] ?? 'NONE'

/** '다음 날 오전 11:00' 이나 시작보다 이른 끝 시각은 다음 날 */
function endMs(m: MeetupX): number | null {
  if (!m.end) return null
  const h = parseHour(m.end)
  const next = /다음\s*날/.test(m.end) || h < parseHour(m.start)
  return startMs({ ...m, start: m.end }) + (next ? DAY : 0)
}
/** 주최자 · 참여 확정자이고 대화방에서 나가지 않았으면 모임 대화방 id */
function chatRoomOf(id: string, my: MeetupMyStatus): number | null {
  if (my !== 'HOST' && my !== 'CONFIRMED') return null
  const room = groupRoomId(id)
  return getChatState().leftGroups.includes(room) ? null : toDtoId(room)
}
const unreadOf = (id: string, chat: number | null) => (chat == null ? 0 : roomOf(groupRoomId(id))?.unread ?? 0)
const started = (m: MeetupX) => isPast(m)
/** 주최자를 뺀 참여 확정자 수 */
const guestsOf = (m: MeetupX, s: MeetupState) => membersOf(m.id, s).length
/** 처리할 신청 (모집 마감 시각이 지났거나 취소된 모임의 대기는 미승인으로 봄) */
const pendingApps = (m: MeetupX, s: MeetupState) => (m.cancelled || recruitClosedByTime(m) ? [] : applicantsOf(m.id, s))

function flags(m: MeetupX, s: MeetupState, my: MeetupMyStatus) {
  const host = my === 'HOST'
  const toStart = startMs(m) - NOW
  return {
    canApply: my === 'NONE' && recruitOf(m, s) === 'open',
    canCancelParticipation: my === 'CONFIRMED' && !m.cancelled && toStart >= DAY,
    canEdit: host && !m.cancelled && toStart >= 12 * HOUR,
    canCancel: host && !m.cancelled && !started(m) && guestsOf(m, s) >= 1,
    canDelete: host && !started(m) && guestsOf(m, s) === 0,
  }
}

/* ===== 직렬화 (저장소 → DTO) ===== */
/** 모임 카드 (리스트 · 내 모임 · 캘린더 · 커뮤니티 글의 모임 카드가 함께 씀) */
export function meetupCard(m: MeetupX, s: MeetupState = getMeetupState()): MeetupCardDto {
  const end = endMs(m)
  return {
    id: toDtoId(m.id), title: m.title, category: (meetupCategoryOf(m.category)?.code ?? 'ETC') as MeetupCategoryCode,
    startsAt: toIso(startMs(m)), endsAt: end == null ? null : toIso(end),
    mode: m.mode === '온라인' ? 'ONLINE' : 'OFFLINE', place: m.mode === '온라인' ? null : m.place || null,
    capacity: m.capacity, confirmedCount: confirmedOf(m, s), recruitStatus: RECRUIT[recruitOf(m, s)],
  }
}
const sharedCount = (uid: string) => (uid === ME_ID ? 0 : interestTags(uid).filter((t) => t.isShared).length)

export function meetupDetail(id: string, s: MeetupState = getMeetupState()): MeetupDetailDto {
  const m = findMeetup(id, s)!
  const my = myStatusOf(id, s)
  const member = my === 'HOST' || my === 'CONFIRMED'
  const seats = [m.hostId, ...membersOf(id, s)]
  const participants = seats.map((u) => ({ user: userDisplay(u), isHost: u === m.hostId, isMe: u === ME_ID, hasSharedInterest: sharedCount(u) > 0 }))
  return {
    ...meetupCard(m, s),
    description: m.intro || null, supplies: m.prep || null, isMessageEnabled: m.askMsg,
    recruitDeadlineAt: m.deadline ? toIso(isoMs(m.deadline)) : null,
    placeDetail: m.mode === '온라인' ? null : m.placeDetail || null,
    joinUrl: member && m.mode === '온라인' ? m.link || null : null,
    host: userDisplay(m.hostId),
    participants,
    sharedInterestParticipantCount: participants.filter((p) => p.hasSharedInterest).length,
    isLiked: s.wish.includes(id), hasVacancyAlert: s.wish.includes(id) && s.alerts.includes(id),
    myStatus: my, ...flags(m, s, my), chatRoomId: chatRoomOf(id, my),
  }
}
function myItem(m: MeetupX, s: MeetupState): MyMeetupItemDto {
  const my = myStatusOf(m.id, s)
  const chat = chatRoomOf(m.id, my)
  return {
    ...meetupCard(m, s), myStatus: my, isLiked: s.wish.includes(m.id), hasVacancyAlert: s.wish.includes(m.id) && s.alerts.includes(m.id),
    pendingCount: my === 'HOST' ? pendingApps(m, s).length : 0, canEdit: flags(m, s, my).canEdit, chatRoomId: chat, unreadCount: unreadOf(m.id, chat),
  }
}

/* ===== 내 모임 탭 (명세 GET /me/meetups "주는 방식") ===== */
const byStart = (a: MeetupX, b: MeetupX) => startMs(a) - startMs(b)
function tabList(tab: MyMeetupTab, s: MeetupState): MeetupX[] {
  const st = (m: MeetupX) => myStatusOf(m.id, s)
  const live = (m: MeetupX) => !started(m) && !m.cancelled
  switch (tab) {
    case 'UPCOMING': return s.list.filter((m) => live(m) && ['HOST', 'CONFIRMED'].includes(st(m))).sort(byStart)
    case 'PENDING': return s.list.filter((m) => live(m) && ['PENDING', 'REJECTED'].includes(st(m))).sort(byStart)
    case 'HOSTING': return s.list.filter((m) => live(m) && st(m) === 'HOST').sort(byStart)
    case 'LIKED': {
      const closed = (m: MeetupX) => Number(recruitOf(m, s) === 'closed')
      return s.list.filter((m) => live(m) && s.wish.includes(m.id)).sort((a, b) => closed(a) - closed(b) || byStart(a, b))
    }
    case 'PAST': return s.list.filter((m) => !live(m) && ['HOST', 'CONFIRMED'].includes(st(m))).sort((a, b) => byStart(b, a))
  }
}
const TABS: MyMeetupTab[] = ['UPCOMING', 'PENDING', 'HOSTING', 'LIKED', 'PAST']

/* ===== 목록 정렬 (모집 완료는 어느 정렬이든 뒤, 같으면 시작이 이른 것 → id 가 큰 것) ===== */
const SORTS: Record<MeetupSort, (a: MeetupX, b: MeetupX, s: MeetupState) => number> = {
  STARTS_SOON: (a, b) => startMs(a) - startMs(b),
  NEWEST: (a, b) => b.seq - a.seq,
  POPULAR: (a, b) => b.likes - a.likes,
  MOST_JOINED: (a, b, s) => confirmedOf(b, s) - confirmedOf(a, s),
}
const SIZES = [6, 12, 24]
const YMD = /^\d{4}-\d{2}-\d{2}$/

/* ===== 입력 검사 (POST · PATCH 의 400 INVALID_INPUT) ===== */
const CODES = new Set(['HOBBY', 'FOOD', 'STUDY', 'ETC', 'GAME', 'EXERCISE'])
function checkWrite(r: Partial<MeetupCreateRequest>, o: { create: boolean; minCapacity: number; deadlineMs: number | null }) {
  const f: Record<string, string> = {}
  const L = MEETUP_LIMITS
  const title = r.title?.trim() ?? ''
  if (!title || title.length > L.title) f.title = `모임 이름은 1 ~ ${L.title}자여야 합니다.`
  if (!r.category || !CODES.has(r.category)) f.category = '카테고리를 골라 주세요.'
  if (r.description != null && r.description.length > L.description) f.description = `소개는 ${L.description}자 이하여야 합니다.`
  if (r.supplies != null && r.supplies.length > L.supplies) f.supplies = `준비물은 ${L.supplies}자 이하여야 합니다.`
  if (typeof r.capacity !== 'number' || !Number.isInteger(r.capacity) || r.capacity < L.capacityMin || r.capacity > L.capacityMax) f.capacity = `정원은 ${L.capacityMin} ~ ${L.capacityMax}명이어야 합니다.`
  else if (r.capacity < o.minCapacity) f.capacity = `정원은 지금의 확정 인원(${o.minCapacity}명)보다 적을 수 없습니다.`
  if (typeof r.isMessageEnabled !== 'boolean') f.isMessageEnabled = '남길 말을 받을지 골라 주세요.'
  const start = r.startsAt ? parseIso(r.startsAt) : NaN
  if (!Number.isFinite(start)) f.startsAt = '시작 시각을 정해 주세요.'
  else if (start <= NOW) f.startsAt = '시작 시각은 지금보다 뒤여야 합니다.'
  else if (o.deadlineMs != null && start < o.deadlineMs) f.startsAt = '시작 시각은 모집 마감 시각보다 앞설 수 없습니다.'
  if (r.endsAt != null && Number.isFinite(start) && parseIso(r.endsAt) <= start) f.endsAt = '끝나는 시각은 시작 시각보다 뒤여야 합니다.'
  if (o.create && r.recruitDeadlineAt != null) {
    const dl = parseIso(r.recruitDeadlineAt)
    if (dl <= NOW) f.recruitDeadlineAt = '모집 마감 시각은 지금보다 뒤여야 합니다.'
    else if (Number.isFinite(start) && dl > start) f.recruitDeadlineAt = '모집 마감 시각은 시작 시각보다 늦을 수 없습니다.'
  }
  if (r.mode !== 'OFFLINE' && r.mode !== 'ONLINE') f.mode = '만나는 방식을 골라 주세요.'
  if (r.mode === 'OFFLINE') {
    const place = r.place?.trim() ?? ''
    if (!place || place.length > L.place) f.place = `장소는 1 ~ ${L.place}자여야 합니다.`
    if (r.placeDetail != null && r.placeDetail.length > L.placeDetail) f.placeDetail = `상세 주소는 ${L.placeDetail}자 이하여야 합니다.`
  }
  if (r.mode === 'ONLINE' && r.joinUrl != null && (!/^https?:\/\//.test(r.joinUrl) || r.joinUrl.length > L.joinUrl)) f.joinUrl = `접속 링크는 http:// 나 https:// 로 시작하고 ${L.joinUrl}자 이하여야 합니다.`
  if (Object.keys(f).length) throw invalidInput(f, '입력값을 확인해 주세요.')
}
/** PATCH 는 값을 모두 보내야 함 (하나라도 빠지면 400) */
const PATCH_KEYS = ['title', 'category', 'description', 'capacity', 'supplies', 'isMessageEnabled', 'startsAt', 'endsAt', 'mode', 'place', 'placeDetail', 'joinUrl'] as const

/** 요청 본문 → 모임 저장소 양식 값 (목 서버 안에서만) */
function draftOfRequest(r: Omit<MeetupCreateRequest, 'recruitDeadlineAt'> & { recruitDeadlineAt?: string | null }): Draft {
  const start = parseIso(r.startsAt)
  const end = r.endsAt ? parseIso(r.endsAt) : null
  const hm = (t: number) => { const { h, mi } = seoulParts(t); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}` }
  return {
    cap: r.capacity, prep: r.supplies ?? '', askMsg: r.isMessageEnabled, ymd: seoulYmd(start), start: hm(start),
    end: end == null ? '' : `${seoulYmd(end) !== seoulYmd(start) ? '다음 날 ' : ''}${hm(end)}`,
    deadline: r.recruitDeadlineAt ? msToWall(parseIso(r.recruitDeadlineAt)) : '', mode: r.mode === 'ONLINE' ? '온라인' : '오프라인',
    place: r.mode === 'ONLINE' ? '' : r.place ?? '', placeDetail: r.placeDetail ?? '', link: r.mode === 'ONLINE' ? r.joinUrl ?? '' : '',
    title: r.title, intro: r.description ?? '', category: meetupCategoryOf(r.category)?.name ?? r.category,
  }
}

/** 신청 id(앱 '모임id:사람id') → [모임 id, 사람 id] */
function appParts(applicationId: number): [string, string] | null {
  const key = toAppId(applicationId)
  const i = key.indexOf(':')
  return i > 0 ? [key.slice(0, i), key.slice(i + 1)] : null
}
/** 신청 · 확정자 → 신청 관리 줄 */
function appItem(meetupId: string, uid: string, status: 'PENDING' | 'CONFIRMED', message: string | null): MeetupApplicationItemDto {
  return { id: toDtoId(`${meetupId}:${uid}`), status, user: userDisplay(uid), sharedInterestCount: sharedCount(uid), message }
}
/** 주최자가 처리하는 신청 찾기 (없는 신청 · 삭제된 모임 404, 주최자가 아니면 403) */
function hostApp(applicationId: number) {
  const p = appParts(applicationId)
  const m = p && findMeetup(p[0])
  if (!p || !m) throw applicationNotFound()
  if (m.hostId !== ME_ID) throw notHost()
  return { m, uid: p[1], s: getMeetupState() }
}
function hostMeetup(id: number) {
  const m = findMeetup(toAppId(id))
  if (!m) throw meetupNotFound()
  if (m.hostId !== ME_ID) throw notHost()
  return m
}
const meetupOr404 = (id: number) => { const m = findMeetup(toAppId(id)); if (!m) throw meetupNotFound(); return m }

/* ===== 목 서버 ===== */
export const mock: MeetupsApi = {
  list: (q, signal) => mockRead(() => {
    const size = q.size ?? 6
    const bad: Record<string, string> = {}
    if (!SIZES.includes(size)) bad.size = '6, 12, 24 가운데 하나여야 합니다.'
    if ((q.keyword?.length ?? 0) > MEETUP_LIMITS.keyword) bad.keyword = `검색어는 ${MEETUP_LIMITS.keyword}자 이하여야 합니다.`
    if (q.dateFrom && !YMD.test(q.dateFrom)) bad.dateFrom = '날짜 형식이 올바르지 않습니다.'
    if (q.dateTo && !YMD.test(q.dateTo)) bad.dateTo = '날짜 형식이 올바르지 않습니다.'
    if (q.dateFrom && q.dateTo && q.dateTo < q.dateFrom) bad.dateTo = '끝 날짜는 시작 날짜보다 앞설 수 없습니다.'
    if (Object.keys(bad).length) throw invalidInput(bad)
    const s = getMeetupState()
    // 삭제 · 취소 · 시작한 모임은 주지 않음 → OPEN · CLOSED 만
    let l = s.list.filter((m) => !m.cancelled && !started(m))
    const k = q.keyword?.trim().toLowerCase()
    if (k) l = l.filter((m) => m.title.toLowerCase().includes(k) || m.intro.toLowerCase().includes(k))
    if (q.categories?.length) l = l.filter((m) => q.categories!.includes(meetupCategoryOf(m.category)?.code as MeetupCategoryCode))
    if (q.dateFrom) l = l.filter((m) => m.date >= q.dateFrom!)
    if (q.dateTo) l = l.filter((m) => m.date <= q.dateTo!)
    if (q.mode) l = l.filter((m) => (q.mode === 'ONLINE') === (m.mode === '온라인'))
    const sort = SORTS[q.sort ?? 'STARTS_SOON']
    const closed = (m: MeetupX) => Number(recruitOf(m, s) === 'closed')
    l.sort((a, b) => closed(a) - closed(b) || sort(a, b, s) || startMs(a) - startMs(b) || b.seq - a.seq)
    const page = paginate(l, q.page, size)
    return { ...page, items: page.items.map((m) => meetupCard(m, s)) }
  }, { signal, empty: () => emptyPage(q.size ?? 6) }),

  create: (req) => mockWrite(() => {
    checkWrite(req, { create: true, minCapacity: 2, deadlineMs: null })
    const id = createMeetup(draftOfRequest(req))
    // 모임 대화방은 함께 만들어짐 (목: 채팅 저장소가 모임 저장소를 보고 대화방을 엶 → data/chat syncGroupRooms)
    return { meetupId: toDtoId(id), chatRoomId: toDtoId(groupRoomId(id)) }
  }),

  get: (id, signal) => mockRead(() => { meetupOr404(id); return meetupDetail(toAppId(id)) }, { signal, detail: 'MEETUP' }),

  update: (id, req) => mockWrite(() => {
    const m = hostMeetup(id)
    if (m.cancelled || startMs(m) - NOW < 12 * HOUR) throw conflict('MEETUP_EDIT_NOT_ALLOWED', '시작 12시간 전부터는 모임을 수정할 수 없습니다.')
    const missing = PATCH_KEYS.filter((k) => !(k in (req as object)))
    if (missing.length) throw invalidInput(Object.fromEntries(missing.map((k) => [k, '값을 보내야 합니다.'])))
    checkWrite(req, { create: false, minCapacity: confirmedOf(m), deadlineMs: m.deadline ? isoMs(m.deadline) : null })
    openingSeat(m.id, () => updateMeetup(m.id, draftOfRequest(req)))
    return null
  }),

  cancel: (id) => mockWrite(() => {
    const m = hostMeetup(id)
    if (m.cancelled) return null
    if (started(m) || guestsOf(m, getMeetupState()) === 0) throw conflict('MEETUP_CANCEL_NOT_ALLOWED', '시작한 모임이거나 참여 확정자가 없는 모임입니다.')
    cancelMeetup(m.id)
    return null
  }),

  remove: (id) => mockWrite(() => {
    const m = hostMeetup(id)
    if (started(m) || guestsOf(m, getMeetupState()) > 0) throw conflict('MEETUP_DELETE_NOT_ALLOWED', '시작한 모임이거나 참여 확정자가 있는 모임입니다.')
    deleteMeetup(m.id)
    return null
  }),

  like: (id) => mockWrite(() => { const m = meetupOr404(id); setWish(m.id, true); return { isLiked: true } }),
  unlike: (id) => mockWrite(() => { const key = toAppId(id); if (findMeetup(key)) setWish(key, false); return { isLiked: false } }),
  enableVacancyAlert: (id) => mockWrite(() => {
    const m = meetupOr404(id)
    if (!getMeetupState().wish.includes(m.id)) throw conflict('MEETUP_NOT_LIKED', '찜하지 않은 모임입니다.')
    setAlert(m.id, true)
    return { hasVacancyAlert: true }
  }),
  disableVacancyAlert: (id) => mockWrite(() => { const key = toAppId(id); if (findMeetup(key)) setAlert(key, false); return { hasVacancyAlert: false } }),

  apply: (id, req) => mockWrite(() => {
    if (req.message != null && req.message.length > MEETUP_LIMITS.message) throw invalidInput({ message: `남길 말은 ${MEETUP_LIMITS.message}자 이하여야 합니다.` })
    const m = meetupOr404(id)
    if (m.hostId === ME_ID) throw forbidden('내가 주최한 모임에는 신청할 수 없습니다.', 'OWN_MEETUP_NOT_ALLOWED')
    const my = myStatusOf(m.id)
    if (my === 'PENDING' || my === 'CONFIRMED') throw conflict('MEETUP_ALREADY_APPLIED', '이미 신청한 모임입니다.')
    if (my !== 'NONE') throw conflict('MEETUP_REAPPLY_NOT_ALLOWED', '다시 신청할 수 없는 모임입니다.')
    if (recruitOf(m) !== 'open') throw conflict('MEETUP_NOT_RECRUITING', '지금은 신청을 받지 않는 모임입니다.')
    apply(m.id, m.askMsg ? req.message ?? '' : '')
    return { meetupApplicationId: toDtoId(`${m.id}:${ME_ID}`) }
  }),

  applications: (id, signal) => mockRead(() => {
    const m = hostMeetup(id)
    const s = getMeetupState()
    const pend = [...pendingApps(m, s)].sort((a, b) => a.at - b.at).map((a) => appItem(m.id, a.userId, 'PENDING', a.msg || null))
    const conf = membersOf(m.id, s).map((u) => appItem(m.id, u, 'CONFIRMED', null))
    return {
      meetupId: toDtoId(m.id), title: m.title, capacity: m.capacity, confirmedCount: confirmedOf(m, s), pendingCount: pend.length,
      canManage: !m.cancelled && !started(m), items: [...pend, ...conf],
    }
  }, { signal, detail: 'MEETUP' }),

  withdrawApplication: (id) => mockWrite(() => {
    const m = meetupOr404(id)
    const my = myStatusOf(m.id)
    if (getMeetupState().my[m.id]?.st === 'withdrawn') return null
    if (my === 'CONFIRMED') throw conflict('MEETUP_APPLICATION_ALREADY_CONFIRMED', '이미 참여가 확정된 신청입니다.')
    if (my !== 'PENDING') throw applicationNotFound()
    withdraw(m.id)
    return null
  }),

  cancelParticipation: (id) => mockWrite(() => {
    const m = meetupOr404(id)
    const my = myStatusOf(m.id)
    if (my === 'CANCELED') return null
    if (my !== 'CONFIRMED') throw applicationNotFound()
    if (m.cancelled || startMs(m) - NOW < DAY) throw conflict('MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED', '시작 24시간 전부터는 참여를 취소할 수 없습니다.')
    openingSeat(m.id, () => quit(m.id))
    // 서버가 함께 하는 일: 모임 대화방에서 나를 뺌 (목: 채팅 저장소)
    leaveRoom(groupRoomId(m.id))
    return null
  }),

  accept: (applicationId) => mockWrite(() => {
    const { m, uid, s } = hostApp(applicationId)
    if (membersOf(m.id, s).includes(uid)) return null
    if (!pendingApps(m, s).some((a) => a.userId === uid)) throw applicationNotFound()
    if (confirmedOf(m, s) >= m.capacity) throw conflict('MEETUP_FULL', '정원이 차서 수락할 수 없습니다.')
    accept(m.id, uid)
    return null
  }),

  reject: (applicationId) => mockWrite(() => {
    const { m, uid, s } = hostApp(applicationId)
    if (s.appLog[`${m.id}:${uid}`] === 'REJECTED') return null
    if (!pendingApps(m, s).some((a) => a.userId === uid)) throw applicationNotFound()
    reject(m.id, uid)
    return null
  }),

  kick: (applicationId) => mockWrite(() => {
    const { m, uid, s } = hostApp(applicationId)
    if (s.appLog[`${m.id}:${uid}`] === 'KICKED') return null
    if (!membersOf(m.id, s).includes(uid)) throw applicationNotFound()
    if (m.cancelled || started(m)) throw conflict('MEETUP_KICK_NOT_ALLOWED', '취소된 모임이거나 시작한 모임입니다.')
    openingSeat(m.id, () => kick(m.id, uid))
    return null
  }),

  mine: (tab, signal) => mockRead(() => {
    if (!TABS.includes(tab)) throw invalidInput({ tab: '탭 값이 올바르지 않습니다.' })
    const s = getMeetupState()
    return items(tabList(tab, s).map((m) => myItem(m, s)))
  }, { signal, empty: () => items([]) }),

  summary: (signal) => mockRead(() => {
    const s = getMeetupState()
    const n = (t: MyMeetupTab) => tabList(t, s).length
    const upcoming = s.list
      .filter((m) => !started(m) && !m.cancelled && ['HOST', 'CONFIRMED', 'PENDING'].includes(myStatusOf(m.id, s)))
      .sort(byStart).slice(0, 5)
      .map((m) => ({ ...meetupCard(m, s), myStatus: myStatusOf(m.id, s) as 'HOST' | 'CONFIRMED' | 'PENDING' }))
    return { counts: { upcoming: n('UPCOMING'), pending: n('PENDING'), hosting: n('HOSTING'), liked: n('LIKED'), past: n('PAST') }, upcomingItems: upcoming }
  }, { signal, empty: () => ({ counts: { upcoming: 0, pending: 0, hosting: 0, liked: 0, past: 0 }, upcomingItems: [] }) }),

  calendar: (q, signal) => mockRead(() => {
    if (!Number.isInteger(q.year) || !Number.isInteger(q.month) || q.month < 1 || q.month > 12) throw invalidInput({ month: '달은 1 ~ 12 여야 합니다.' })
    if (q.scope && q.scope !== 'MINE' && q.scope !== 'ALL') throw invalidInput({ scope: 'MINE, ALL 가운데 하나여야 합니다.' })
    const s = getMeetupState()
    const prefix = `${q.year}-${String(q.month).padStart(2, '0')}-`
    const month = s.list.filter((m) => !m.cancelled && m.date.startsWith(prefix)).sort(byStart)
    const mineOnly = (q.scope ?? 'MINE') === 'MINE'
    const st = (m: MeetupX) => myStatusOf(m.id, s)
    const count = (k: MeetupMyStatus) => month.filter((m) => st(m) === k).length
    const shown = mineOnly ? month.filter((m) => ['HOST', 'CONFIRMED', 'PENDING'].includes(st(m))) : month
    return {
      year: q.year, month: q.month, summary: { confirmed: count('CONFIRMED'), pending: count('PENDING'), hosting: count('HOST') },
      items: shown.map((m) => ({ ...meetupCard(m, s), myStatus: st(m), chatRoomId: chatRoomOf(m.id, st(m)) })),
    }
  }, { signal }),
}

/**
 * 다른 사람이 하는 일 흉내 (목에서 로그인한 계정은 나 하나라, 알림을 만드는 "남의 행동"은 이것으로만 일어남).
 * 서버처럼 저장소를 바꾸고, 받는 사람이 나면 알림을 만든다 (명세 09 "알림의 종류"). 개발 서버 콘솔: __digulMock.meetups
 * 내가 한 일(신청 · 수락 · 취소 …)의 알림은 받는 사람이 남이라 목에서는 만들지 않는다
 */
export const mockMeetupActors = {
  /** userId 가 모임에 참여 신청 → 주최자에게 MEETUP_APPLICATION_RECEIVED. meetupId 를 빼면 내가 연 모집 중 모임 하나 */
  apply(userId = 'seobeok', meetupId?: string, msg = '같이 하고 싶어요!') {
    const s = getMeetupState()
    const m = meetupId ? findMeetup(meetupId) : s.list.find((x) => x.hostId === ME_ID && recruitOf(x, s) === 'open')
    if (!m || m.hostId === userId || recruitOf(m) !== 'open' || !receiveApplication(m.id, userId, msg)) return null
    notifyMockUser(m.hostId, 'MEETUP_APPLICATION_RECEIVED', { actorId: userId, targetId: m.id })
    return m.id
  },
  /** 주최자가 내 신청을 수락(MEETUP_APPLICATION_ACCEPTED, actor 주최자) · 거절(MEETUP_APPLICATION_REJECTED, actor 없음) */
  decide(meetupId: string, accept = true) {
    const m = findMeetup(meetupId)
    if (!m || !hostDecidesMine(meetupId, accept)) return false
    notifyMockUser(ME_ID, accept ? 'MEETUP_APPLICATION_ACCEPTED' : 'MEETUP_APPLICATION_REJECTED', { actorId: accept ? m.hostId : null, targetId: m.id })
    return true
  },
}
