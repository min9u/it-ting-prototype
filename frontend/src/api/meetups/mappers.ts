/**
 * 07 모임 DTO ↔ 앱 모양. 화면은 이 결과만 쓴다.
 * - 모임 하나는 앱 모양 MeetupX(data/meetupStore 타입: 서울 날짜 · '오후 2:00' 시각 · 카테고리 이름)로 바꿔 카드 · 표지판 컴포넌트를 그대로 씀
 * - 서버가 계산한 값(확정 인원 · 모집 상태 · 내 상태 · can*)은 그대로 들고 다닌다 (프론트가 시각을 다시 계산하지 않음)
 * - id 는 common toAppId · toDtoId, 시각은 lib/time (UTC ↔ 서울), 사람은 common toPersonFromDisplay
 */
import { toAppId, toAppIdOrNull, toPersonFromDisplay, type Person } from '../common'
import { END_DAY_PREFIX, type Draft, type MeetupX, type Recruit } from '../../data/meetupStore'
import { meetupCategoryOf } from '../../data/meetupCategory'
import { msToWall, parseIso, seoulMs, seoulParts, seoulYmd, toIso, wallToMs, ymdDiff } from '../../lib/time'
import type {
  MeetupApplicationsDto, MeetupCalendarDto, MeetupCardDto, MeetupCategoryCode, MeetupCreateRequest, MeetupDetailDto, MeetupMyStatus,
  MeetupUpdateRequest, MyMeetupItemDto, MyMeetupSummaryDto, RecruitStatus,
} from './types'

const MODE = { OFFLINE: '오프라인', ONLINE: '온라인' } as const
const RECRUIT: Record<RecruitStatus, Recruit> = { OPEN: 'open', CLOSED: 'closed', PAST: 'past', CANCELED: 'cancelled' }
export const toRecruit = (r: RecruitStatus): Recruit => RECRUIT[r] ?? 'open'
/** ms → '오후 2:00' (모임 양식 값과 같은 모양) */
function hm(t: number) {
  const { h, mi } = seoulParts(t)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`
}
/** 장소 앞 두 낱말 = 카드의 짧은 지역 (명세에 지역 칸이 없어 프론트가 만듦) */
const areaOf = (place: string) => place.trim().split(/\s+/).slice(0, 2).join(' ')

/* ===== 모임 카드 ===== */
/** 카드에 필요한 것 = 모임 + 서버가 계산한 값 (확정 인원 · 모집 상태 · 찜). 커뮤니티 글의 모임 카드도 이 모양을 씀 */
export interface MeetupCardVM {
  meetup: MeetupX
  /** 주최자 포함 확정 인원 */
  confirmed: number
  recruit: Recruit
  /** 카드 응답에 찜이 없는 곳(리스트 · 캘린더)은 false */
  liked: boolean
}
export function toMeetup(d: MeetupCardDto): MeetupX {
  const start = parseIso(d.startsAt)
  const end = d.endsAt ? parseIso(d.endsAt) : null
  const date = seoulYmd(start)
  const endYmd = end == null ? null : seoulYmd(end)
  // 다른 날 끝나면 날짜를 앞에 붙임: 바로 다음 날은 '다음 날', 그 뒤는 'M월 D일' (명세 07: 기간 제한 없음). 실제 날짜는 endYmd 로 따로 들고 감
  const endDay = endYmd == null || endYmd === date ? '' : ymdDiff(date, endYmd) === 1 ? '다음 날 ' : `${+endYmd.slice(5, 7)}월 ${+endYmd.slice(8, 10)}일 `
  const place = d.place ?? ''
  return {
    id: toAppId(d.id), title: d.title, category: meetupCategoryOf(d.category)?.name ?? d.category, date, start: hm(start),
    end: end == null ? '' : `${endDay}${hm(end)}`, endYmd: endYmd && endYmd !== date ? endYmd : undefined,
    area: d.mode === 'ONLINE' ? '온라인' : areaOf(place), place, mode: MODE[d.mode] ?? '오프라인', capacity: d.capacity,
    // 카드 응답에는 참여자 · 주최자가 없음 → 인원은 MeetupCardVM.confirmed 를 씀
    memberIds: [], hostId: '', intro: '',
    sign: d.title.slice(0, 8), cancelled: d.recruitStatus === 'CANCELED' || undefined,
    askMsg: true, likes: 0, seq: 0,
  }
}
export const toMeetupCard = (d: MeetupCardDto & { isLiked?: boolean }): MeetupCardVM => ({
  meetup: toMeetup(d), confirmed: d.confirmedCount, recruit: toRecruit(d.recruitStatus), liked: !!d.isLiked,
})

/* ===== 내 모임 · 요약 · 캘린더 ===== */
export interface MyMeetupVM extends MeetupCardVM {
  my: MeetupMyStatus
  /** 빈자리 알림을 켰는지 */
  alert: boolean
  /** 내가 처리할 신청 수 (주최자가 아니면 0) */
  pendingCount: number
  canEdit: boolean
  /** 모임 대화방 앱 id (들어가 있을 때만) */
  chatRoomId: string | null
  unread: number
}
export const toMyMeetup = (d: MyMeetupItemDto): MyMeetupVM => ({
  ...toMeetupCard(d), my: d.myStatus, alert: d.hasVacancyAlert, pendingCount: d.pendingCount, canEdit: d.canEdit,
  chatRoomId: toAppIdOrNull(d.chatRoomId), unread: d.unreadCount,
})
export interface MyMeetupSummaryVM {
  counts: MyMeetupSummaryDto['counts']
  /** 가까운 내 모임 (HOST · CONFIRMED · PENDING) 5개까지 */
  upcoming: (MeetupCardVM & { my: MeetupMyStatus })[]
}
export const toMySummary = (d: MyMeetupSummaryDto): MyMeetupSummaryVM => ({
  counts: d.counts, upcoming: d.upcomingItems.map((x) => ({ ...toMeetupCard(x), my: x.myStatus })),
})
export interface MeetupCalendarVM {
  year: number
  month: number
  summary: MeetupCalendarDto['summary']
  items: (MeetupCardVM & { my: MeetupMyStatus; chatRoomId: string | null })[]
}
export const toCalendar = (d: MeetupCalendarDto): MeetupCalendarVM => ({
  year: d.year, month: d.month, summary: d.summary,
  items: d.items.map((x) => ({ ...toMeetupCard(x), my: x.myStatus, chatRoomId: toAppIdOrNull(x.chatRoomId) })),
})

/* ===== 상세 ===== */
export interface MeetupSeat { person: Person; isHost: boolean; isMe: boolean; shared: boolean }
export interface MeetupDetailVM {
  meetup: MeetupX
  confirmed: number
  recruit: Recruit
  host: Person
  /** 좌석: 주최자가 맨 앞, 그다음 확정된 순서 (나 포함) */
  seats: MeetupSeat[]
  /** 나와 관심사가 겹치는 참여자 수 */
  sharedCount: number
  liked: boolean
  alert: boolean
  my: MeetupMyStatus
  /** 버튼을 켤지 (서버 계산) */
  can: { apply: boolean; cancelParticipation: boolean; edit: boolean; cancel: boolean; delete: boolean }
  /** 모임 대화방 앱 id. null 이면 모임 대화 미리보기를 가림 */
  chatRoomId: string | null
  /** 모집 마감 (서울 'YYYY-MM-DDTHH:mm'), 없으면 null → 마감 안내를 안 보여 줌 */
  deadline: string | null
}
export function toMeetupDetail(d: MeetupDetailDto): MeetupDetailVM {
  const host = toPersonFromDisplay(d.host)
  const seats = d.participants.map((p) => ({ person: toPersonFromDisplay(p.user), isHost: p.isHost, isMe: p.isMe, shared: p.hasSharedInterest }))
  const deadline = d.recruitDeadlineAt ? msToWall(parseIso(d.recruitDeadlineAt)) : null
  const meetup: MeetupX = {
    ...toMeetup(d), hostId: host.id, memberIds: seats.map((x) => x.person.id), intro: d.description ?? '', prep: d.supplies ?? undefined,
    askMsg: d.isMessageEnabled, placeDetail: d.placeDetail ?? undefined, link: d.joinUrl ?? undefined, deadline: deadline ?? undefined,
  }
  return {
    meetup, confirmed: d.confirmedCount, recruit: toRecruit(d.recruitStatus), host, seats, sharedCount: d.sharedInterestParticipantCount,
    liked: d.isLiked, alert: d.hasVacancyAlert, my: d.myStatus,
    can: { apply: d.canApply, cancelParticipation: d.canCancelParticipation, edit: d.canEdit, cancel: d.canCancel, delete: d.canDelete },
    chatRoomId: toAppIdOrNull(d.chatRoomId), deadline,
  }
}

/* ===== 신청 관리 ===== */
export interface MeetupApplicationVM {
  /** 신청 앱 id (수락 · 거절 · 내보내기에 그대로 넘김) */
  id: string
  person: Person
  shared: number
  message: string | null
}
export interface MeetupApplicationsVM {
  meetupId: string
  title: string
  capacity: number
  confirmed: number
  pendingCount: number
  canManage: boolean
  pending: MeetupApplicationVM[]
  confirmedList: MeetupApplicationVM[]
}
export function toApplications(d: MeetupApplicationsDto): MeetupApplicationsVM {
  const row = (x: MeetupApplicationsDto['items'][number]): MeetupApplicationVM => ({ id: toAppId(x.id), person: toPersonFromDisplay(x.user), shared: x.sharedInterestCount, message: x.message })
  return {
    meetupId: toAppId(d.meetupId), title: d.title, capacity: d.capacity, confirmed: d.confirmedCount, pendingCount: d.pendingCount, canManage: d.canManage,
    pending: d.items.filter((x) => x.status === 'PENDING').map(row), confirmedList: d.items.filter((x) => x.status === 'CONFIRMED').map(row),
  }
}

/* ===== 만들기 · 수정 양식 → 요청 본문 ===== */
/** '오후 2:00' + '2026-11-08' → UTC ms (서울 기준) */
export function formMs(ymd: string, t: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const r = /(오전|오후)\s*(\d+):(\d+)/.exec(t)
  const h = r ? (+r[2] % 12) + (r[1] === '오후' ? 12 : 0) : 0
  return seoulMs(y, m, d, h, r ? +r[3] : 0)
}
const orNull = (v: string) => (v.trim() ? v.trim() : null)
/** 만들기 양식 → POST /meetups 본문 */
export function toCreateRequest(f: Draft): MeetupCreateRequest {
  const start = formMs(f.ymd, f.start)
  // 끝나는 시간: 다른 날 끝나는 값(서버에서 받은 '다음 날 …' · 'M월 D일 …')은 받아 둔 날짜(endYmd) 그대로, 같은 날 값이 시작보다 앞이면 다음 날
  const dayed = END_DAY_PREFIX.test(f.end)
  const endT = f.end.replace(END_DAY_PREFIX, '')
  let end = !f.end ? null : dayed && f.endYmd ? formMs(f.endYmd, endT) : formMs(f.ymd, endT)
  if (end != null && !(dayed && f.endYmd) && (end <= start || dayed)) end += 24 * 3_600_000
  const offline = f.mode === '오프라인'
  return {
    title: f.title.trim(), category: (meetupCategoryOf(f.category)?.code ?? 'ETC') as MeetupCategoryCode, description: orNull(f.intro),
    capacity: f.cap, supplies: orNull(f.prep), isMessageEnabled: f.askMsg,
    startsAt: toIso(start), endsAt: end == null ? null : toIso(end), recruitDeadlineAt: f.deadline ? toIso(wallToMs(f.deadline)) : null,
    mode: offline ? 'OFFLINE' : 'ONLINE', place: offline ? orNull(f.place) : null, placeDetail: offline ? orNull(f.placeDetail) : null,
    joinUrl: offline ? null : orNull(f.link),
  }
}
/** 수정 양식 → PATCH 본문 (값을 모두 담음, 모집 마감은 없음) */
export function toUpdateRequest(f: Draft): MeetupUpdateRequest {
  const { recruitDeadlineAt: _, ...rest } = toCreateRequest(f)
  return rest
}
