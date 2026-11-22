/**
 * 02 로그인 · 회원가입 영역 입구. 화면은 여기서 가져온다: import { authApi, useMe, AUTH_ERRORS } from '../../api/auth'
 * 이 폴더(api/auth/)는 인증 · 설정 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type AuthApi } from './real'
export { authApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
