/**
 * 05 탐색 · 방문 (+ 00 학기) — 에러 code → 화면 문구. 명세 05-explore-visit.md 의 "에러" 표마다.
 * 공통 코드(INTERNAL_ERROR · NEW_TERM_INCOMPLETE …)는 common/errors.ts. 화면은 code 로만 분기한다
 */
import type { ErrorTable } from '../common/errors'

export const EXPLORE_ERRORS: ErrorTable = {
  // 들판 · 학기
  TERM_NOT_FOUND: '아직 열리지 않았거나 없는 학기예요.',
  CAMPUS_FLOOR_NOT_FOUND: '없는 캠퍼스-층이에요. 다른 층을 골라 주세요.',
  // 땅굴 · 단골 · 방명록
  BURROW_NOT_FOUND: '없는 땅굴이에요.',
  OWN_BURROW_NOT_ALLOWED: '내 땅굴에는 할 수 없어요.',
  GUESTBOOK_ENTRY_NOT_FOUND: '이미 지워진 방명록 글이에요.',
  FORBIDDEN: '내가 쓴 글만 지울 수 있어요.',
  // 대화 요청 보내기
  USER_NOT_FOUND: '탈퇴했거나 없는 사용자예요.',
  CHAT_ROOM_ALREADY_EXISTS: '이미 대화 중인 사람이에요. 채팅에서 이어서 이야기해 보세요.',
  CHAT_REQUEST_ALREADY_SENT: '이미 대화 요청을 보냈어요. 상대가 답할 때까지 기다려 주세요.',
  CHAT_REQUEST_ALREADY_RECEIVED: '이미 나에게 요청한 사람입니다. 알림창에 가서 확인하세요.',
}

/** 방문자 뷰 "대화 요청하기"가 REQUEST_RECEIVED 일 때 띄우는 토스트 (명세 방문자 뷰 4 문구 그대로) */
export const ALREADY_RECEIVED_TEXT = EXPLORE_ERRORS.CHAT_REQUEST_ALREADY_RECEIVED
