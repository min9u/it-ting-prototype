/**
 * 06 채팅 — code → 화면 문구 (명세 06-chat.md 각 API 의 "에러" 표). 공통 코드는 common/errors.ts
 * 화면은 errorText(e, CHAT_ERRORS) 또는 useOptimistic 의 errors: CHAT_ERRORS. 분기는 code 로만
 */
import type { ErrorTable } from '../common/errors'

export const CHAT_ERRORS: ErrorTable = {
  CHAT_ROOM_NOT_FOUND: '없는 대화이거나 이미 나간 대화예요.',
  CHAT_ROOM_READ_ONLY: '상대가 대화방을 나가서 더 보낼 수 없어요.',
  CHAT_ROOM_LEAVE_NOT_ALLOWED: '끝나지 않은 모임의 대화방은 지금 나갈 수 없어요.',
  CHAT_REQUEST_NOT_FOUND: '이미 처리됐거나 만료된 요청이에요.',
  CHAT_REQUEST_ALREADY_ACCEPTED: '상대가 이미 수락한 요청이에요. 대화 목록에서 대화를 이어 가세요.',
  FORBIDDEN: '주최자만 할 수 있어요.',
  // 모임 나가기(참여 취소, 07 모임 API)에서 오는 것
  MEETUP_NOT_FOUND: '없는 모임이거나 삭제된 모임이에요.',
  MEETUP_APPLICATION_NOT_FOUND: '참여가 확정된 모임이 아니에요.',
  MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED: '시작 24시간 전부터는 모임에서 나갈 수 없어요.',
  // 옛 대화 요청 보내기(api.chat.sendRequest, 05 로 옮기면 지움)
  ROOM_EXISTS: '이미 대화방이 있어요.',
  REQUEST_EXISTS: '이미 대화를 요청했어요.',
  REQUEST_FROM_PEER: '이 분이 먼저 대화를 요청했어요. 채팅 › 요청에서 답해 주세요.',
}
