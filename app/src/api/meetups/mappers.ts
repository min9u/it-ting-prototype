/**
 * 07 모임 DTO → 앱 모양 (data/meetupStore 의 MeetupX · Mine). 화면은 이 결과만 쓴다.
 * 시각은 lib/time (UTC → 서울), id 는 common toAppId, 사람은 common toPerson
 */
import { toAppId, toPerson } from '../common'
import type { MeetupState, MeetupX, Mine, Recruit } from '../../data/meetupStore'
import { meetupCategoryOf } from '../../data/meetupCategory'
import { msToWall, parseIso, seoulParts, seoulYmd } from '../../lib/time'
import type { ApplicationStatus, MeetupCardDto, MeetupDetailDto, RecruitStatus } from './types'

const ms = (iso: string | null | undefined) => (iso ? parseIso(iso) : undefined)
const MODE = { OFFLINE: '오프라인', ONLINE: '온라인' } as const
const RECRUIT: Record<RecruitStatus, Recruit> = { OPEN: 'open', CLOSED: 'closed', ENDED: 'past', CANCELED: 'cancelled' }
/** ms → '오후 2:00' (모임 양식 값과 같은 모양) */
function hm(t: number) {
  const { h, mi } = seoulParts(t)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`
}

/** 카드에 필요한 것 = 모임 + 서버가 계산한 값 (확정 인원·모집 상태·찜) */
export interface MeetupCardVM {
  meetup: MeetupX
  /** 주최자 포함 확정 인원 */
  confirmed: number
  recruit: Recruit
  liked: boolean
}
export function toMeetup(d: MeetupCardDto): MeetupX {
  const start = parseIso(d.startsAt)
  const end = ms(d.endsAt)
  const date = seoulYmd(start)
  const place = d.place ?? ''
  return {
    id: toAppId(d.id), title: d.title, category: meetupCategoryOf(d.category)?.name ?? d.category, date, start: hm(start),
    end: end == null ? '' : `${seoulYmd(end) !== date ? '다음 날 ' : ''}${hm(end)}`,
    area: d.mode === 'ONLINE' ? '온라인' : d.area ?? (place.split(/\s+/).slice(0, 2).join(' ')),
    place, mode: MODE[d.mode], capacity: d.capacity,
    // 카드 응답에는 참여자 목록이 없음 → 인원은 MeetupCardVM.confirmed 를 씀
    memberIds: [], hostId: toPerson(d.host).id, intro: '',
    sign: d.sign ?? d.title.slice(0, 8), cancelled: d.recruitStatus === 'CANCELED' || undefined,
    askMsg: true, deadline: d.recruitDeadlineAt ? msToWall(parseIso(d.recruitDeadlineAt)) : undefined,
    likes: d.likeCount, seq: Math.round(parseIso(d.createdAt) / 1000),
  }
}
export const toMeetupCard = (d: MeetupCardDto): MeetupCardVM => ({ meetup: toMeetup(d), confirmed: d.confirmedCount, recruit: RECRUIT[d.recruitStatus], liked: d.liked })

/** 상세 = 모임 + 내 신청 + 확정자 + 찜·알림·신고 */
export interface MeetupDetailVM {
  meetup: MeetupX
  my?: Mine
  /** 확정자 id (주최자 제외, 확정됐으면 나 포함) */
  members: string[]
  liked: boolean
  alert: boolean
  reported: boolean
}
const MY: Record<ApplicationStatus, Mine['st']> = { PENDING: 'pending', CANCELED: 'withdrawn', REJECTED: 'rejected', EXPIRED: 'rejected', APPROVED: 'joined', LEFT: 'quit', KICKED: 'kicked' }
export function toMeetupDetail(d: MeetupDetailDto): MeetupDetailVM {
  const meetup: MeetupX = {
    ...toMeetup(d), intro: d.description ?? '', prep: d.supplies ?? undefined, askMsg: d.acceptsMessage,
    placeDetail: d.placeDetail ?? undefined, link: d.joinUrl ?? undefined,
  }
  const a = d.myApplication
  const my: Mine | undefined = d.isHost ? { st: 'host' } : a ? { st: MY[a.status], note: a.message ?? undefined, at: parseIso(a.createdAt), auto: a.status === 'EXPIRED' || undefined } : undefined
  const members = d.members.map((x) => toPerson(x).id)
  meetup.memberIds = [meetup.hostId, ...members]
  return { meetup, my, members, liked: d.liked, alert: d.vacancyAlert, reported: d.reportedByMe }
}
/**
 * 상세 하나로 모임 저장소와 같은 모양을 만듦 → data/meetupStore 의 계산 함수(recruitOf·myOf·leftOf…)를 그대로 씀.
 * (서버가 준 값으로만 계산하므로 실제 모드에서도 같은 화면)
 */
export function toMeetupState(vm: MeetupDetailVM): MeetupState {
  const id = vm.meetup.id
  return {
    list: [vm.meetup], my: vm.my ? { [id]: vm.my } : {}, members: { [id]: vm.members }, wish: vm.liked ? [id] : [],
    alerts: vm.alert ? [id] : [], applicants: {}, reported: vm.reported ? [id] : [], draft: null,
  }
}
