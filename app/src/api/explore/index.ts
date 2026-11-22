/**
 * 05 탐색 · 방문 (+ 00 학기) 영역 입구. import { exploreApi, useBurrow, exploreKeys } from '../../api/explore'
 * 이 폴더(api/explore/)는 탐색 · 방문 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, GUESTBOOK_MAX, type ExploreApi } from './real'
export { exploreApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
