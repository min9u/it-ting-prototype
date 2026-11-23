/**
 * 07 모임 DTO — 명세 그대로 (docs/backend/team-spec/api/07-meetup.md, 사본 커밋 04ea897).
 * id 는 숫자(Id), 시각은 UTC "…Z"(UtcInstant), 날짜만은 "YYYY-MM-DD"(DateString), enum 은 대문자, 값이 없으면 null.
 * 앱 모양(문자열 id · 서울 시각 · MeetupX)으로는 ./mappers.ts 가 바꾼다.
 */
import type { DateString, Id, ItemsDto, PageDto, UserDisplayDto, UtcInstant } from '../common/types'

/* ===== enum ===== */
/** 카테고리 6개 (명세 "카테고리"). 이름 · 색은 프론트가 코드마다 가짐 → data/meetupCategory.ts */
export type MeetupCategoryCode = 'HOBBY' | 'FOOD' | 'STUDY' | 'ETC' | 'GAME' | 'EXERCISE'
export type MeetupMode = 'OFFLINE' | 'ONLINE'
/** 모집 상태 (서버가 계산). 위에서부터 먼저 맞는 값: CANCELED > PAST > CLOSED > OPEN */
export type RecruitStatus = 'OPEN' | 'CLOSED' | 'PAST' | 'CANCELED'
/** 내 상태 (서버가 계산, 명세 "내 상태") */
export type MeetupMyStatus = 'HOST' | 'NONE' | 'PENDING' | 'REJECTED' | 'CONFIRMED' | 'CANCELED' | 'KICKED' | 'MEETUP_CANCELED'
/** 목록 정렬 (기본 STARTS_SOON) */
export type MeetupSort = 'STARTS_SOON' | 'NEWEST' | 'POPULAR' | 'MOST_JOINED'
/** 한 페이지 모임 수: 6 · 12 · 24 */
export type MeetupPageSize = 6 | 12 | 24
/** 내 모임 탭 */
export type MyMeetupTab = 'UPCOMING' | 'PENDING' | 'HOSTING' | 'LIKED' | 'PAST'
/** 캘린더 보기 (기본 MINE) */
export type MeetupCalendarScope = 'MINE' | 'ALL'
/** 신청 관리 목록의 신청 상태 */
export type MeetupApplicationStatus = 'PENDING' | 'CONFIRMED'

/* ===== 모임 카드 (리스트 · 내 모임 · 캘린더가 함께 쓰는 모양) ===== */
export interface MeetupCardDto {
  id: Id
  title: string
  category: MeetupCategoryCode
  startsAt: UtcInstant
  /** 정하지 않은 모임은 null */
  endsAt: UtcInstant | null
  mode: MeetupMode
  /** 오프라인 장소. 온라인은 null */
  place: string | null
  /** 정원 (주최자 포함) */
  capacity: number
  /** 확정 인원 (주최자 포함) */
  confirmedCount: number
  recruitStatus: RecruitStatus
}

/* ===== GET /meetups ===== */
export interface MeetupSearchQuery {
  /** 모임 이름 · 소개 글에서 찾음. 50자 이하 */
  keyword?: string
  /** 쉼표로 이어 보냄 */
  categories?: MeetupCategoryCode[]
  /** 한국 시간 날짜. 이 날부터 시작하는 모임 */
  dateFrom?: DateString
  /** 한국 시간 날짜. 이 날까지 시작하는 모임 (dateFrom 보다 앞설 수 없음) */
  dateTo?: DateString
  mode?: MeetupMode
  sort?: MeetupSort
  /** 1부터 */
  page?: number
  size?: MeetupPageSize
}
export type MeetupPageDto = PageDto<MeetupCardDto>

/* ===== POST /meetups · PATCH /meetups/{meetupId} ===== */
export interface MeetupCreateRequest {
  /** 1 ~ 30자, 공백만은 안 됨 */
  title: string
  category: MeetupCategoryCode
  /** 1,000자 이하. 안 썼으면 null */
  description: string | null
  /** 주최자 포함 2 ~ 50 */
  capacity: number
  /** 100자 이하. 안 썼으면 null */
  supplies: string | null
  /** 신청할 때 주최자에게 남길 말을 받을지 ("받을게요" = true) */
  isMessageEnabled: boolean
  /** 지금보다 뒤 */
  startsAt: UtcInstant
  /** startsAt 보다 뒤. 정하지 않았으면 null */
  endsAt: UtcInstant | null
  /** 지금보다 뒤이고 startsAt 보다 늦을 수 없음. null 이면 시작할 때까지 신청을 받음 */
  recruitDeadlineAt: UtcInstant | null
  mode: MeetupMode
  /** OFFLINE 이면 1 ~ 100자, ONLINE 이면 null */
  place: string | null
  /** 100자 이하. ONLINE 이거나 안 썼으면 null */
  placeDetail: string | null
  /** http(s):// 로 시작, 500자 이하. OFFLINE 이거나 안 썼으면 null */
  joinUrl: string | null
}
/** 201. 생성 완료 팝업은 보낸 값으로 그리고 "모임 보러 가기"는 meetupId 상세로 */
export interface MeetupCreateResponse { meetupId: Id; chatRoomId: Id }
/** 값을 모두 보낸다 (바꾸지 않은 값도). 모집 마감 시각은 만들 때만 정하므로 없음. 응답 data 는 null */
export type MeetupUpdateRequest = Omit<MeetupCreateRequest, 'recruitDeadlineAt'>

/* ===== GET /meetups/{meetupId} ===== */
export interface MeetupParticipantDto {
  user: UserDisplayDto
  isHost: boolean
  isMe: boolean
  /** 나와 겹치는 관심사가 하나라도 있는지 (나 자신은 false) */
  hasSharedInterest: boolean
}
export interface MeetupDetailDto {
  id: Id
  title: string
  category: MeetupCategoryCode
  description: string | null
  supplies: string | null
  /** false 면 "주최자에게 남길 말" 칸을 숨김 */
  isMessageEnabled: boolean
  startsAt: UtcInstant
  endsAt: UtcInstant | null
  /** null 이면 마감 안내를 보여 주지 않음 */
  recruitDeadlineAt: UtcInstant | null
  mode: MeetupMode
  place: string | null
  placeDetail: string | null
  /** 주최자 · 참여 확정자에게만. 그 밖은 null */
  joinUrl: string | null
  capacity: number
  confirmedCount: number
  recruitStatus: RecruitStatus
  host: UserDisplayDto
  /** 좌석에 앉는 사람: 주최자가 맨 앞, 그다음 확정된 순서 */
  participants: MeetupParticipantDto[]
  /** 나와 관심사가 겹치는 참여자 수 (나는 세지 않음) */
  sharedInterestParticipantCount: number
  isLiked: boolean
  /** 찜하지 않았으면 false */
  hasVacancyAlert: boolean
  myStatus: MeetupMyStatus
  /** 버튼을 켤지는 아래 값으로만 정한다 (프론트가 시각을 다시 계산하지 않음) */
  canApply: boolean
  canCancelParticipation: boolean
  canEdit: boolean
  canCancel: boolean
  canDelete: boolean
  /** 내가 그 대화방에 들어가 있을 때만. 아니면 null (→ 모임 대화 미리보기를 가림) */
  chatRoomId: Id | null
}

/* ===== PUT · DELETE /like, /vacancy-alert ===== */
export interface MeetupLikeDto { isLiked: boolean }
export interface MeetupVacancyAlertDto { hasVacancyAlert: boolean }

/* ===== POST /meetups/{meetupId}/applications ===== */
export interface MeetupApplyRequest {
  /** 100자 이하. null · 빈 문자열이면 남기지 않음. 남길 말을 받지 않는 모임이면 서버가 버림 */
  message: string | null
}
/** 201 */
export interface MeetupApplyResponse { meetupApplicationId: Id }

/* ===== GET /meetups/{meetupId}/applications (주최자) ===== */
export interface MeetupApplicationItemDto {
  /** 신청 id (수락 · 거절 · 내보내기에 씀) */
  id: Id
  status: MeetupApplicationStatus
  user: UserDisplayDto
  /** 그 사람과 내가 함께 고른 관심사 수 */
  sharedInterestCount: number
  message: string | null
}
export interface MeetupApplicationsDto {
  meetupId: Id
  title: string
  capacity: number
  confirmedCount: number
  pendingCount: number
  /** false 면 수락 · 거절 · 내보내기를 모두 끔 (취소됐거나 시작한 모임) */
  canManage: boolean
  /** PENDING 먼저, 그다음 CONFIRMED. 주최자는 없음 */
  items: MeetupApplicationItemDto[]
}

/* ===== GET /me/meetups ===== */
export interface MyMeetupItemDto extends MeetupCardDto {
  myStatus: MeetupMyStatus
  isLiked: boolean
  hasVacancyAlert: boolean
  /** 내가 처리할 신청 수 (주최자가 아니면 0) */
  pendingCount: number
  canEdit: boolean
  chatRoomId: Id | null
  /** chatRoomId 가 null 이면 0 */
  unreadCount: number
}
export type MyMeetupsDto = ItemsDto<MyMeetupItemDto>

/* ===== GET /me/meetups/summary ===== */
export interface MyMeetupSummaryItemDto extends MeetupCardDto {
  /** HOST · CONFIRMED · PENDING 가운데 하나 */
  myStatus: Extract<MeetupMyStatus, 'HOST' | 'CONFIRMED' | 'PENDING'>
}
export interface MyMeetupSummaryDto {
  counts: { upcoming: number; pending: number; hosting: number; liked: number; past: number }
  /** 시작 전 · 취소 안 된 HOST · CONFIRMED · PENDING 모임, 가까운 것부터 5개까지 */
  upcomingItems: MyMeetupSummaryItemDto[]
}

/* ===== GET /meetup-calendar ===== */
export interface MeetupCalendarQuery {
  year: number
  /** 1 ~ 12 */
  month: number
  scope?: MeetupCalendarScope
}
export interface MeetupCalendarItemDto extends MeetupCardDto {
  myStatus: MeetupMyStatus
  chatRoomId: Id | null
}
export interface MeetupCalendarDto {
  year: number
  month: number
  /** 그 달의 내 모임 수 (scope 와 상관없이) */
  summary: { confirmed: number; pending: number; hosting: number }
  /** 한국 시간으로 그 달에 시작하는 모임 (취소 · 삭제 제외, 지난 모임 포함), 이른 것부터 */
  items: MeetupCalendarItemDto[]
}
