/**
 * 04 내 땅굴 영역 입구. import { useMyBurrow, burrowKeys, BURROW_ERRORS } from '../../api/burrow'
 * 이 폴더(api/burrow/)는 온보딩 · 내 땅굴 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 * 방명록 목록 · 삭제(useGuestbookEntries · useDeleteGuestbookEntry)는 방문자 뷰(05)도 같이 쓴다
 */
export * from './types'
export { ENDPOINTS, GUESTBOOK_PAGE_SIZE, type BurrowApi } from './real'
export { burrowApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
export { reportGuestbookEntry, reportUser } from './report'
