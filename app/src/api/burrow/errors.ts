/**
 * 04 내 땅굴 — code → 화면 문구. 공통 코드는 common/errors.ts
 * 지금은 초안 목 서버가 던지는 코드. 온보딩 · 내 땅굴 작업자가 명세(04-my-burrow.md "에러")의 코드로 바꾼다
 */
import type { ErrorTable } from '../common/errors'

export const BURROW_ERRORS: ErrorTable = {
  NICKNAME_TAKEN: '이미 쓰는 닉네임이에요.',
  INVALID_ITEM: '고를 수 없는 꾸미기예요.',
}
