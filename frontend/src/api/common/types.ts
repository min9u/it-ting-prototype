/**
 * 공통 DTO (백엔드 확정 명세 v1: docs/backend/team-spec/api-convention.md, api/00-common.md).
 * DTO 는 명세 그대로 쓴다: id 는 숫자, 시각은 UTC "…Z", 날짜만은 "YYYY-MM-DD", enum 은 대문자, 값이 없으면 null.
 * 앱 모양(문자열 id, ms 시각)으로는 각 영역의 mappers.ts 가 바꾼다 (id 는 ./ids.ts, 시각은 lib/time.ts).
 */

/* ===== 기본 값 ===== */
/** 자원 id. JSON 에서 숫자 (명세 "JSON 필드") */
export type Id = number
/** UTC 시각 "2026-11-18T08:01:05Z" (필드 이름은 …At) */
export type UtcInstant = string
/** 날짜만 "2026-11-18" */
export type DateString = string

/* ===== 응답 틀 · 에러 ===== */
/** 입력 오류(400 INVALID_INPUT)의 칸 하나. field 는 요청 JSON 경로 ("nickname", "mole.head", "answers[1].answer") */
export interface FieldError { field: string; message: string }

/** error 칸 (실패 응답) */
export interface ApiErrorBody {
  /** 실패 종류. 화면 문구는 프론트가 이 값으로 정함 (영역 errors.ts) */
  code: string
  /** 개발자가 읽는 한국어 설명. 화면 분기에 쓰지 않는다 */
  message: string
  /** 입력 오류일 때만 */
  fields: FieldError[] | null
  /** 화면에 보여 줄 값이 실패에 딸려 있을 때만 (예: ACCOUNT_SUSPENDED 의 reason · endsAt) */
  detail: Record<string, unknown> | null
}

/** 모든 응답 본문의 틀. client.ts 가 풀어서 data 만 돌려주므로 영역 코드는 이 모양을 볼 일이 없다 */
export interface ApiEnvelope<T> {
  success: boolean
  data: T | null
  error: ApiErrorBody | null
}

/* ===== 목록 ===== */
/** 나누지 않는 목록 (data.items) */
export interface ItemsDto<T> { items: T[] }

/** 페이지 방식 (화면이 페이지 번호로 넘길 때). page 는 1부터 */
export interface PageDto<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export interface PageQuery { page?: number; size?: number }

/** 커서 방식 ("더 보기" · 스크롤). nextCursor 는 해석하지 말고 그대로 다음 요청에 */
export interface CursorPageDto<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}
export interface CursorQuery { cursor?: string | null; size?: number }

/* ===== 함께 쓰는 값 (00 공통 "함께 쓰는 값") ===== */
/** 두더지 아이템 코드. 항상 네 부위를 모두 담고, 고르지 않았으면 null. 모르는 코드는 "없음"으로 그린다 */
export interface MoleDto {
  head: string | null
  face: string | null
  neck: string | null
  hand: string | null
}

/** 사용자 표시: 사람을 보여 주는 모든 곳. 탈퇴하면 id · isWithdrawn 만 값이 있고 나머지는 null (mole 은 네 부위 null) */
export interface UserDisplayDto {
  id: Id
  nickname: string | null
  profileImageUrl: string | null
  mole: MoleDto
  campusName: string | null
  generation: number | null
  floor: number | null
  isWithdrawn: boolean
}

/** 관심사 태그. 목록의 첫 번째가 대표 관심사 */
export interface InterestTagDto {
  id: Id
  name: string
  interestCategoryId: Id
  /** 나와 겹치는 관심사 (내 관심사를 볼 때는 false) */
  isShared: boolean
}

/* ===== 00 공통 목록 ===== */
/** GET /campuses */
export interface CampusDto {
  id: Id
  name: string
  /** 층 id 는 다른 API 의 campusFloorId */
  floors: { id: Id; floor: number }[]
}
/** GET /generations (큰 기수부터) */
export interface GenerationDto { generation: number }
