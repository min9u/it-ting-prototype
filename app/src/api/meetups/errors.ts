/**
 * 07 모임 — code → 화면 문구 (명세 07-meetup.md 의 "에러" 표 모두). 공통 코드는 common/errors.ts.
 * 화면은 code 로만 분기한다: errorText(e, MEETUP_ERRORS) 또는 useOptimistic({ errors: MEETUP_ERRORS })
 */
import { RULES } from '../../lib/validation'
import type { ErrorTable } from '../common/errors'

export const MEETUP_ERRORS: ErrorTable = {
  // 404
  MEETUP_NOT_FOUND: '삭제되었거나 없는 모임이에요.',
  MEETUP_APPLICATION_NOT_FOUND: '이미 처리되었거나 취소된 신청이에요. 목록을 새로 불러왔어요.',
  // 403
  OWN_MEETUP_NOT_ALLOWED: '내가 연 모임에는 신청할 수 없어요.',
  FORBIDDEN: '주최자만 할 수 있어요.',
  // 409 신청하는 사람
  MEETUP_ALREADY_APPLIED: '이미 신청했거나 참여가 확정된 모임이에요.',
  MEETUP_REAPPLY_NOT_ALLOWED: '이 모임에는 다시 신청할 수 없어요.',
  MEETUP_NOT_RECRUITING: '지금은 신청을 받지 않는 모임이에요. 정원이 찼거나 모집이 마감됐어요.',
  MEETUP_APPLICATION_ALREADY_CONFIRMED: '주최자가 방금 수락해 참여가 확정됐어요. 빠지려면 참여 취소를 해 주세요.',
  MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED: '시작 24시간 전부터는 참여를 취소할 수 없어요. 주최자에게 모임 대화로 알려주세요.',
  // 409 주최자
  MEETUP_EDIT_NOT_ALLOWED: '시작 12시간 전부터는 모임을 수정할 수 없어요.',
  MEETUP_CANCEL_NOT_ALLOWED: '이미 시작했거나 참여 확정자가 없는 모임은 취소할 수 없어요.',
  MEETUP_DELETE_NOT_ALLOWED: '참여가 확정된 사람이 있거나 이미 시작한 모임은 삭제할 수 없어요.',
  MEETUP_FULL: '정원이 다 차서 수락할 수 없어요. 자리가 나면 수락할 수 있어요.',
  MEETUP_KICK_NOT_ALLOWED: '취소되었거나 이미 시작한 모임에서는 내보낼 수 없어요.',
  // 409 찜
  MEETUP_NOT_LIKED: '찜한 모임에만 빈자리 알림을 켤 수 있어요.',
}

/**
 * 입력 칸 길이 (명세 07 "글자 수": 모임 이름 30 · 소개 1,000 · 준비물 100 · 장소 100 · 상세 주소 100 · 접속 링크 500 · 남길 말 100, 정원 2~50).
 * 글자 수의 원본은 lib/validation.ts RULES 하나 (2026-11-22 명세 값으로 맞춤). 여기는 모임 화면 · 목 서버가 쓰기 편하게 모은 이름
 */
export const MEETUP_LIMITS = {
  title: RULES.meetupTitle.max, description: RULES.meetupIntro.max, supplies: RULES.meetupSupplies.max, place: RULES.meetupPlace.max,
  placeDetail: RULES.meetupPlaceDetail.max, joinUrl: RULES.meetupJoinUrl.max, message: RULES.meetupApplyMessage.max,
  capacityMin: 2, capacityMax: 50, keyword: RULES.searchKeyword.max,
} as const
