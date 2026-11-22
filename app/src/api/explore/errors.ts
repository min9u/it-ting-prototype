/**
 * 05 탐색 · 방문 — code → 화면 문구. 공통 코드는 common/errors.ts
 * 지금은 초안 목 서버가 던지는 코드. 탐색 · 방문 작업자가 명세(05-explore-visit.md "에러")의 코드로 바꾼다
 */
import type { ErrorTable } from '../common/errors'

export const EXPLORE_ERRORS: ErrorTable = {
  BURROW_NOT_FOUND: '없는 땅굴이에요.',
  GUESTBOOK_ENTRY_NOT_FOUND: '이미 지워진 방명록 글이에요.',
  EMPTY_CONTENT: '내용을 적어 주세요.',
  ALREADY_DRAWN: '오늘은 이미 추천을 받았어요.',
}
