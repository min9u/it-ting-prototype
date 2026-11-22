/**
 * 04 내 땅굴 영역 입구. import { burrowApi, burrowKeys } from '../../api/burrow'
 * 이 폴더(api/burrow/)는 온보딩 · 내 땅굴 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type BurrowApi } from './real'
export { burrowApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
