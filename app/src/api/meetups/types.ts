/**
 * 07 모임 DTO. 명세: docs/backend/team-spec/api/07-meetup.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 모임 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'
import type { MemberProfileDto, MemberSummaryDto } from '../common/legacy'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string
/** 초안의 날짜 "YYYY-MM-DD". 명세는 DateString */
type IsoDate = string

/** meetup.mode */
export type MeetupMode = 'OFFLINE' | 'ONLINE'
/** meetup_application.status (프론트 MyState: pending · withdrawn · rejected(+auto) · joined · quit · kicked) */
export type ApplicationStatus = 'PENDING' | 'CANCELED' | 'REJECTED' | 'EXPIRED' | 'APPROVED' | 'LEFT' | 'KICKED'
/** 서버가 계산해서 주는 모집 상태 (meetup 에 칼럼 없음 → erd-gaps) */
export type RecruitStatus = 'OPEN' | 'CLOSED' | 'ENDED' | 'CANCELED'

/* ===== 모임 ===== */
export interface MeetupCardDto {
  id: LegacyId
  title: string
  /** 모임 카테고리 코드 HOBBY_CULTURE · MEAL_CAFE · STUDY_PROJECT · ETC · GAME · SPORTS (명세 07, 관심사와 관계없음) */
  category: string
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  recruitDeadlineAt: IsoDateTime | null
  mode: MeetupMode
  /** 오프라인: 장소. 온라인은 null (모임에는 플랫폼 이름을 두지 않음 — 명세 07) */
  place: string | null
  capacity: number
  /** 주최자 포함 확정 인원 */
  confirmedCount: number
  likeCount: number
  /** 내가 찜함 */
  liked: boolean
  recruitStatus: RecruitStatus
  host: MemberSummaryDto
  createdAt: IsoDateTime
  /** 카드 팻말 글자 (ERD 에 없음 → erd-gaps. 없으면 프론트가 제목 앞 8자) */
  sign: string | null
  /** 짧은 지역 "성수동" (ERD 에 없음 → erd-gaps. 없으면 프론트가 place 앞 두 낱말) */
  area: string | null
}
export interface MyApplicationDto {
  id: LegacyId
  status: ApplicationStatus
  /** VARCHAR (화면 100자) */
  message: string | null
  createdAt: IsoDateTime
  statusChangedAt: IsoDateTime
}
export interface MeetupDetailDto extends MeetupCardDto {
  description: string | null
  supplies: string | null
  acceptsMessage: boolean
  placeDetail: string | null
  /** 참여 확정자·주최자에게만 값, 그 밖은 null */
  joinUrl: string | null
  /** 참여 확정자 (주최자 제외) */
  members: MemberSummaryDto[]
  /** 내 신청 (없으면 null). 주최자면 null 이고 isHost=true */
  myApplication: MyApplicationDto | null
  isHost: boolean
  /** 찜 + 빈자리 알림 (meetup_like.vacancy_alert) */
  vacancyAlert: boolean
  reportedByMe: boolean
}
export interface MeetupListQuery {
  q?: string
  /** 모임 카테고리 코드 여러 개 (명세 07 리스트 3) */
  categories?: string[]
  /** 시작일 범위 (YYYY-MM-DD, 서울) */
  from?: IsoDate
  to?: IsoDate
  mode?: MeetupMode
  sort?: 'STARTS_AT' | 'NEWEST' | 'POPULAR' | 'MEMBERS'
  page?: number
  size?: number
}
export interface MeetupWriteRequest {
  title: string
  /** 모임 카테고리 코드 (필수, 하나) */
  category: string
  description: string
  capacity: number
  supplies: string | null
  acceptsMessage: boolean
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  recruitDeadlineAt: IsoDateTime | null
  mode: MeetupMode
  place: string | null
  placeDetail: string | null
  joinUrl: string | null
}
export interface ApplicantDto {
  applicationId: LegacyId
  member: MemberProfileDto
  message: string | null
  createdAt: IsoDateTime
}



/** 내 모임 탭 (초안) */
export type MyMeetupTab = 'UPCOMING' | 'PENDING' | 'HOSTING' | 'LIKED' | 'PAST'
