/**
 * 02 로그인 · 회원가입 영역 입구. 화면은 여기서 가져온다: import { authApi, useMe, AUTH_ERRORS } from '../../api/auth'
 * 이 폴더(api/auth/)는 인증 · 설정 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type AuthApi } from './real'
export { authApi, AUTH_IS_MOCK } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
export { GOOGLE_RETURN, goGoogle, isServerUrl, suspendedFromQuery } from './google'
/** 목 서버 전용 (흉내 Google 화면 · 목 메일함). 실제 서버 모드에서는 화면이 부르지 않는다 */
export { mockGoogleCallback, mockMailbox, MOCK_GOOGLE } from './mock'
