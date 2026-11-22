/**
 * 06 채팅 — code → 화면 문구. 공통 코드는 common/errors.ts
 * 지금은 초안 목 서버가 던지는 코드. 채팅 작업자가 명세(06-chat.md "에러")의 코드로 바꾼다
 */
import type { ErrorTable } from '../common/errors'

export const CHAT_ERRORS: ErrorTable = {
  CHAT_REQUEST_NOT_FOUND: '이미 처리된 요청이에요.',
  ROOM_EXISTS: '이미 대화방이 있어요.',
  REQUEST_EXISTS: '이미 대화를 요청했어요.',
  REQUEST_FROM_PEER: '이 분이 먼저 대화를 요청했어요. 채팅 › 요청에서 답해 주세요.',
}
