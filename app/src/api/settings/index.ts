/**
 * 10 설정 · 계정 영역 입구. import { settingsApi, settingsKeys } from '../../api/settings'
 * 이 폴더(api/settings/)는 인증 · 설정 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type SettingsApi } from './real'
export { settingsApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
