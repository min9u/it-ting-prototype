/**
 * 10 설정 · 계정 영역 입구. import { settingsApi, useAccount, SETTINGS_ERRORS } from '../../api/settings'
 * 이 폴더(api/settings/)는 인증 · 설정 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type SettingsApi } from './real'
export { settingsApi, SETTINGS_IS_MOCK } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
/** 목 서버 전용 데모 손잡이 (화면 목록의 "Google 로만 가입한 계정으로 보기") */
export { settingsMockDemo } from './mock'
