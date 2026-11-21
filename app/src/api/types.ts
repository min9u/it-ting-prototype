/**
 * 서버 응답·요청 모양 (DTO). 백엔드 ERD(docs/backend/erd-2026-11-16.md) 테이블·칼럼을 camelCase 로 옮긴 것.
 * 계약 초안은 docs/backend/api-draft.md, ERD 와 다른 점·질문은 docs/backend/erd-gaps.md.
 *
 * 규약 (api-draft.md "공통 규약")
 * - JSON 필드는 camelCase, 성공 응답은 봉투 없이 리소스 그대로 (목록은 PageDto / CursorPageDto)
 * - ID: DB 는 BIGINT 지만 JSON 에서는 문자열 ("42"). 숫자로 와도 mappers.ts 의 toId 가 문자열로 바꿈
 * - 순간은 ISO 8601 + 오프셋 (IsoDateTime), 달력 날짜는 "YYYY-MM-DD" (Asia/Seoul)
 * - 값이 없으면 null (필드를 빼지 않음), 빈 목록은 []
 * - enum 은 대문자 스네이크. 아래 값은 프론트가 쓰는 값에서 뽑은 "후보" (ERD 에 아직 enum 값이 없음)
 *
 * 앱 안에서 쓰는 모양(data/types.ts, data/*Store.ts)과 다르면 mappers.ts 에서 바꾼다. 화면은 DTO 를 직접 쓰지 않는다.
 */

/* ===== 공통 ===== */
/** BIGINT → JSON 문자열 */
export type Id = string
/** "2026-11-16T17:40:05+09:00" */
export type IsoDateTime = string
/** "2026-11-16" */
export type IsoDate = string

/** 에러 응답 (모든 4xx·5xx 같은 모양) */
export interface ApiErrorBody {
  /** 분기용 코드: MEETUP_FULL, NOT_FOUND, UNAUTHORIZED … (api-draft.md "에러 코드") */
  code: string
  /** 사용자에게 그대로 보여 줘도 되는 한국어 문장 */
  message: string
  status?: number
  traceId?: string
  /** 입력 검사 실패(400) 때 칸마다 */
  fieldErrors?: { field: string; message: string }[]
}

/** 번호 페이지 (게시판·모임 목록: 화면이 페이지 번호를 보여 줌) */
export interface PageDto<T> {
  items: T[]
  /** 1부터 */
  page: number
  size: number
  totalItems: number
  totalPages: number
}

/** 커서 페이지 (채팅 기록·알림·방명록: 계속 쌓이고 "더 보기"·무한 스크롤) */
export interface CursorPageDto<T> {
  items: T[]
  /** 다음 요청에 ?cursor= 로 그대로 넘김. 마지막이면 null. 서버만 뜻을 아는 불투명 문자열 */
  nextCursor: string | null
}

/* ===== enum 후보 (ERD 칼럼 → 값) ===== */
/** member.role */
export type MemberRole = 'USER' | 'ADMIN'
/** member.status */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN'
/** meetup.mode */
export type MeetupMode = 'OFFLINE' | 'ONLINE'
/** meetup_application.status (프론트 MyState: pending · withdrawn · rejected(+auto) · joined · quit · kicked) */
export type ApplicationStatus = 'PENDING' | 'CANCELED' | 'REJECTED' | 'EXPIRED' | 'APPROVED' | 'LEFT' | 'KICKED'
/** 서버가 계산해서 주는 모집 상태 (meetup 에 칼럼 없음 → erd-gaps) */
export type RecruitStatus = 'OPEN' | 'CLOSED' | 'ENDED' | 'CANCELED'
/** post.category */
export type PostCategoryCode = 'MEETUP_PROMO' | 'MEETUP_REVIEW' | 'FREE'
/** post.status · comment.status */
export type ContentStatus = 'PUBLIC' | 'HIDDEN' | 'DELETED'
/** chat_room.type */
export type ChatRoomType = 'DIRECT' | 'MEETUP'
/** chat_message.type */
export type ChatMessageType = 'TEXT' | 'SYSTEM' | 'MEETUP_SHARE'
/** chat_request.status */
export type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'EXPIRED'
/** report.target_type */
export type ReportTargetType = 'POST' | 'COMMENT' | 'MEMBER' | 'GUESTBOOK' | 'MEETUP'
/** report.reason */
export type ReportReason = 'SPAM' | 'ABUSE' | 'SEXUAL' | 'ETC'
/** report.status */
export type ReportStatus = 'RECEIVED' | 'HIDDEN' | 'DISMISSED' | 'SANCTIONED'
/** notification 의 큰 분류 (알림 탭·알림 설정 notification_setting.*_on 과 같음) */
export type NotificationCategory = 'MEETUP' | 'CHAT' | 'COMMUNITY' | 'BURROW' | 'NOTICE'
/** notification.type (VARCHAR(40)) */
export type NotificationType =
  | 'MEETUP_APPLICATION_RECEIVED' | 'MEETUP_APPLICATION_APPROVED' | 'MEETUP_APPLICATION_REJECTED' | 'MEETUP_MEMBER_LEFT'
  | 'MEETUP_KICKED' | 'MEETUP_UPDATED' | 'MEETUP_CANCELED' | 'MEETUP_STARTING_SOON' | 'MEETUP_VACANCY'
  | 'CHAT_MESSAGE' | 'CHAT_REQUEST_RECEIVED' | 'CHAT_REQUEST_ACCEPTED'
  | 'POST_COMMENTED' | 'COMMENT_REPLIED' | 'POST_LIKED' | 'COMMENT_LIKED' | 'REPLY_LIKED' | 'POST_HIDDEN'
  | 'GUESTBOOK_WRITTEN' | 'SERVICE_NOTICE'
/** notification.target_type */
export type NotificationTargetType = 'MEETUP' | 'CHAT_ROOM' | 'CHAT_REQUEST' | 'POST' | 'COMMENT' | 'BURROW' | 'NOTICE'
/** notice.category */
export type NoticeCategory = 'NOTICE' | 'UPDATE' | 'EVENT'

/* ===== 사람 ===== */
/** 두더지 꾸미기 (member_profile.mole_*). 부위 이름은 erd-gaps "두더지 꾸미기 부위" 참고 */
export interface MoleLookDto {
  head: string | null
  face: string | null
  neck: string | null
  hand: string | null
}

/** 글쓴이·참여자·채팅 상대처럼 짧게 보여 주는 사람 (탈퇴하면 nickname null, status WITHDRAWN) */
export interface MemberSummaryDto {
  id: Id
  nickname: string | null
  status: MemberStatus
  /** member_profile.generation (기수) */
  generation: number | null
  /** campus.name (campus_floor → campus) */
  campus: string | null
  /** campus_floor.floor */
  floor: number | null
  mole: MoleLookDto
}

export interface MemberInterestDto {
  interestId: Id
  /** interest.name (세부 관심사 이름) */
  name: string
  categoryId: Id
  /** member_interest.sort_order (0 = 대표 관심사) */
  sortOrder: number
  /** member_interest.furniture (그 관심사로 고른 가구 id) */
  furniture: string | null
}

export interface AnswerDto {
  /** member_answer.slot (1~3) */
  slot: number
  questionId: Id
  /** intro_question.content */
  question: string
  answer: string
}

/** 프로필 팝업·땅굴 방문·요청 카드 옆 패널 */
export interface MemberProfileDto extends MemberSummaryDto {
  intro: string | null
  interests: MemberInterestDto[]
  answers: AnswerDto[]
  /** 접속 중 (ERD 에 없음 → erd-gaps. 실시간 presence 로 따로 받을 수도 있음) */
  online: boolean
}

/** GET /me */
export interface MeDto extends MemberProfileDto {
  email: string | null
  role: MemberRole
  ssafyVerifiedAt: IsoDateTime | null
  onboardedAt: IsoDateTime | null
  termsAgreedAt: IsoDateTime | null
  googleLinked: boolean
  hasPassword: boolean
}

/* ===== 인증 ===== */
export interface LoginRequest { email: string; password: string }
/** 로그인 결과: 다음에 갈 곳을 서버 상태로 정함 (SSAFY 인증 전 · 온보딩 전 · 완료) */
export interface LoginResponseDto {
  member: MeDto
  next: 'SSAFY_VERIFY' | 'ONBOARDING' | 'HOME'
}
export interface SuspendedErrorDetail { reason: string; endsAt: IsoDateTime }

/* ===== 관심사 ===== */
export interface InterestDto {
  id: Id
  categoryId: Id
  name: string
  /** 같은 관심사를 고른 사람 수 (니치 표시, 온보딩 "통하는 취향") */
  memberCount: number
}
export interface InterestCategoryDto {
  id: Id
  name: string
  interests: InterestDto[]
}
export interface IntroQuestionDto {
  id: Id
  /** intro_question.type: 공통 · 관심사별 등 */
  type: string
  interestCategoryId: Id | null
  content: string
}

/* ===== 땅굴 · 들판 ===== */
export interface CampusFloorDto { id: Id; campusId: Id; campus: string; floor: number }
export interface TermDto { id: Id; year: number; half: 'FIRST' | 'SECOND'; openedAt: IsoDateTime }

/** 땅굴 입구 (burrow_entrance): 학기 하나에 들판(캠퍼스-층)의 자리 하나 */
export interface BurrowEntranceDto {
  termId: Id
  /** term.year · term.half → "2026 하반기" */
  year: number
  half: 'FIRST' | 'SECOND'
  campusFloorId: Id
  campus: string
  floor: number
  /** 1~150 */
  slot: number
}

/** GET /burrows/{memberId} — 땅굴 방문 (주인 프로필 + 나와의 관계) */
export interface BurrowDto {
  id: Id
  owner: MemberProfileDto
  /** 이번 학기 입구. 없으면 null (탐색 버튼 숨김) */
  entrance: BurrowEntranceDto | null
  /** 내가 이 땅굴을 단골로 둠 (regular_burrow) */
  regular: boolean
  /** 이 땅굴을 단골로 둔 사람 수 */
  regularCount: number
  /** 지금 와 있는 방문자 수 (ERD 에 없음 → erd-gaps) */
  visitorsNow: number
  /** 나와 이 사람의 1:1 대화방 (있으면 "대화하기") */
  chatRoomId: Id | null
  /** 내가 보낸, 아직 답이 없는 대화 요청 (있으면 말풍선이 "요청 보냄"으로 바뀌고 누를 수 없다) */
  pendingRequestId: Id | null
  /** 방 꾸미기 저장 값 (ERD 에 없음 → erd-gaps "방 꾸미기 저장") */
  room: RoomLayoutDto | null
}

/** 방 꾸미기 저장 형식 제안 (위험 B10). schemaVersion 으로 바뀌는 형식을 옮김 */
export interface RoomLayoutDto {
  schemaVersion: 1
  wallpaperId: string | null
  /** 세부 관심사 id → 가구 id (member_interest.furniture 와 같은 값) */
  furniture: Record<string, string>
  /**
   * 꾸미기에서 고른 땅굴 색 테마 (2026-11-18, app/src/data/roomStyle.ts: cat_food … cat_pet_plant, base = 디자이너 원래 색).
   * 없거나 null 이면 대표 관심사 대분류의 묶음. 나머지 꾸미기 값(이불·러그 무늬 · 기본 가구 모양)은 회원 id 씨앗으로 프론트가 계산
   */
  themeId?: string | null
}

export interface GuestbookEntryDto {
  id: Id
  burrowId: Id
  author: MemberSummaryDto
  /** VARCHAR(50) (화면은 100자 → erd-gaps) */
  content: string
  createdAt: IsoDateTime
}

/** 들판 한 장 (GET /fields/{campusFloorId}?termId=) */
export interface FieldResidentDto { slot: number; member: MemberProfileDto; burrowId: Id }
export interface FieldDto {
  campusFloor: CampusFloorDto
  term: TermDto
  residents: FieldResidentDto[]
  /** 배정된 가장 큰 자리 번호 (구역 수 = ceil(maxSlot / 25)) */
  maxSlot: number
  mySlot: number | null
}

/* ===== 추천 ===== */
/** 추천 받기 요청: 고른 캠퍼스-층과 기수. 서버에 저장하지 않고 받을 때마다 다시 고름 (2026-11-21 명세) */
export interface RecommendRequestDto {
  /** 고른 캠퍼스-층의 id (목에서는 "캠퍼스|층") */
  campusFloorId: Id
  generation: number
}
export interface DailyRecommendationDto {
  recommendedOn: IsoDate
  members: MemberProfileDto[]
}

/* ===== 채팅 (REST: 방 목록 · 요청. 메시지 주고받기는 실시간 작업) ===== */
export interface ChatMessagePreviewDto {
  id: Id
  type: ChatMessageType
  senderId: Id | null
  senderNickname: string | null
  content: string | null
  /** MEETUP_SHARE 일 때 공유한 모임 */
  meetupId: Id | null
  meetupTitle: string | null
  createdAt: IsoDateTime
}
export interface ChatRoomSummaryDto {
  id: Id
  type: ChatRoomType
  /** MEETUP 방이면 모임 */
  meetupId: Id | null
  /** MEETUP 방은 모임 이름, DIRECT 방은 상대 닉네임 (탈퇴하면 "탈퇴한 사용자") */
  title: string
  /** DIRECT 방의 상대 */
  partner: MemberSummaryDto | null
  /** 대표 관심사 이름 (목록 타일 색) */
  topic: string | null
  /** 지금 참여자 수 (left_at 이 없는 사람) */
  memberCount: number
  lastMessage: ChatMessagePreviewDto | null
  /** chat_room_member.last_read_message_id 이후 메시지 수 (서버 계산) */
  unreadCount: number
  /** 읽기 전용이 된 까닭 */
  closedReason: 'PARTNER_LEFT' | 'PARTNER_WITHDRAWN' | null
  /** 모임이 끝났거나 취소됨 */
  ended: boolean
}
export interface ChatRequestDto {
  id: Id
  /** 내 기준 방향 */
  direction: 'RECEIVED' | 'SENT'
  counterpart: MemberProfileDto
  /** VARCHAR(50) */
  message: string | null
  status: ChatRequestStatus
  /** 어디서 요청했나 (ERD 에 없음 → erd-gaps): 땅굴 방문 · 같은 모임 · 그 밖 */
  context: 'BURROW_VISIT' | 'SAME_MEETUP' | 'OTHER'
  createdAt: IsoDateTime
  /** created_at + 5일 */
  expiresAt: IsoDateTime
  chatRoomId: Id | null
}
export interface AcceptChatRequestResponse { chatRoomId: Id }

/* ===== 모임 ===== */
export interface MeetupCardDto {
  id: Id
  title: string
  /** meetup.category = 대표 관심사 이름 (VARCHAR(20)) */
  category: string
  /** 관심사 태그 최대 3개 (ERD 에 테이블 없음 → erd-gaps) */
  tags: string[]
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  recruitDeadlineAt: IsoDateTime | null
  mode: MeetupMode
  /** campus.name (오프라인) */
  campus: string | null
  /** 오프라인: 장소, 온라인: 플랫폼이 '기타'일 때 직접 쓴 이름 */
  place: string | null
  platform: string | null
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
  id: Id
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
  /** interest_category.id 여러 개 (대표 관심사의 분야) */
  categoryIds?: string[]
  /** 캠퍼스 이름 (그 캠퍼스 오프라인 + 모든 온라인) */
  campus?: string
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
  category: string
  tags: string[]
  description: string
  capacity: number
  supplies: string | null
  acceptsMessage: boolean
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  recruitDeadlineAt: IsoDateTime | null
  mode: MeetupMode
  campus: string | null
  place: string | null
  placeDetail: string | null
  platform: string | null
  joinUrl: string | null
}
export interface ApplicantDto {
  applicationId: Id
  member: MemberProfileDto
  message: string | null
  createdAt: IsoDateTime
}

/* ===== 커뮤니티 ===== */
export interface PostImageDto { id: Id; sortOrder: number; url: string }
export interface PostListItemDto {
  id: Id
  category: PostCategoryCode
  title: string
  /** 본문 앞부분 (목록 카드 한 줄) */
  excerpt: string
  author: MemberSummaryDto
  /** post_interest → interest_category.name (최대 5개) */
  interests: string[]
  thumbnailUrl: string | null
  imageCount: number
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  liked: boolean
  /** 내가 저장한 때 (post_bookmark.created_at), 안 했으면 null */
  bookmarkedAt: IsoDateTime | null
  status: ContentStatus
  reportedByMe: boolean
  createdAt: IsoDateTime
  editedAt: IsoDateTime | null
}
export interface PostDetailDto extends PostListItemDto {
  /** VARCHAR(1000) */
  content: string
  images: PostImageDto[]
  meetup: MeetupCardDto | null
  /** 이전/다음 글 (목록 기준, 위험 B8) */
  prevId: Id | null
  nextId: Id | null
}
export interface CommentDto {
  id: Id
  postId: Id
  parentId: Id | null
  author: MemberSummaryDto
  /** 답글에 다시 답할 때 (comment.mention_member_id) */
  mention: { memberId: Id; nickname: string | null } | null
  /** VARCHAR(300) */
  content: string
  status: ContentStatus
  likeCount: number
  liked: boolean
  reportedByMe: boolean
  createdAt: IsoDateTime
  editedAt: IsoDateTime | null
  /** 한 단계만 (parent_id 가 있는 댓글) */
  replies: CommentDto[]
}
export interface PostListQuery {
  category?: PostCategoryCode
  /** 내 관심사만 */
  mine?: boolean
  /** 관심사(대분류) 이름 하나 */
  interest?: string
  q?: string
  sort?: 'LATEST' | 'POPULAR' | 'COMMENTS'
  page?: number
  size?: number
}
export interface PostWriteRequest {
  category: PostCategoryCode
  title: string
  content: string
  interests: string[]
  imageUrls: string[]
  meetupId: Id | null
}
export interface BoardActivityDto { postCount: number; commentedPostCount: number; bookmarkCount: number }

/* ===== 알림 ===== */
export interface NotificationDto {
  id: Id
  type: NotificationType
  category: NotificationCategory
  targetType: NotificationTargetType
  targetId: Id | null
  /** 원본이 지워졌으면 false → 누르면 "삭제된 …" 안내 */
  targetExists: boolean
  actor: MemberSummaryDto | null
  /** 서버가 만든 문장 (원본이 지워져도 보이도록 만들 때의 제목을 저장 → erd-gaps) */
  title: string
  body: string
  readAt: IsoDateTime | null
  createdAt: IsoDateTime
}
export interface NotificationPageDto extends CursorPageDto<NotificationDto> {
  /** 켜 둔 종류의 안 읽은 알림 수 (탭과 관계없이 전체) */
  unreadCount: number
}
export interface NotificationSettingDto {
  meetupOn: boolean
  chatOn: boolean
  communityOn: boolean
  burrowOn: boolean
  noticeOn: boolean
  browserPushOn: boolean
}
export interface NoticeDto { id: Id; category: NoticeCategory; title: string; content: string; createdAt: IsoDateTime }

/* ===== 신고 · 관리자 ===== */
export interface ReportRequest {
  targetType: ReportTargetType
  targetId: Id
  reason: ReportReason
  /** "기타"일 때 필수, VARCHAR(100) */
  detail: string | null
}
export interface AdminReportDto {
  id: Id
  targetType: ReportTargetType
  targetId: Id
  /** 신고된 내용 한 줄 */
  targetPreview: string
  reporter: MemberSummaryDto
  reason: ReportReason
  detail: string | null
  status: ReportStatus
  /** 같은 대상 신고 수 */
  reportCount: number
  createdAt: IsoDateTime
}
export interface AdminMemberDto extends MemberSummaryDto {
  email: string | null
  role: MemberRole
  createdAt: IsoDateTime
  suspendedUntil: IsoDateTime | null
}
export interface SuspendRequest { reason: string; days: number }
export interface WithdrawReasonStatDto { reason: string; count: number }
