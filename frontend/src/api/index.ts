/**
 * API 계층 입구 (모든 영역을 한 번에 모음). **영역 작업자는 이 파일을 고치지 않는다.**
 *   import { api } from '../api'      api.meetups.get(id)
 * 영역의 훅 · 매퍼 · 타입 · 캐시 키 · 에러 표는 영역 폴더에서 바로 가져온다:
 *   import { useMeetupDetail, meetupKeys, MEETUP_ERRORS } from '../api/meetups'
 * (여기서 export * 로 다 모으면 영역끼리 이름이 겹칠 때 깨지므로 모으지 않는다)
 *
 * 모드: NEXT_PUBLIC_API_MODE=mock(기본)|real, 영역별 NEXT_PUBLIC_API_REAL_AREAS · NEXT_PUBLIC_API_MOCK_AREAS (api/config.ts)
 * 구조와 규칙: docs/backend/api-v1-foundation.md
 */
import { commonApi } from './common/api'
import { authApi } from './auth/api'
import { settingsApi } from './settings/api'
import { onboardingApi } from './onboarding/api'
import { burrowApi } from './burrow/api'
import { exploreApi } from './explore/api'
import { chatApi } from './chat/api'
import { meetupsApi } from './meetups/api'
import { communityApi } from './community/api'
import { notificationsApi } from './notifications/api'
import { adminApi } from './admin/api'

export const api = {
  common: commonApi,
  auth: authApi,
  settings: settingsApi,
  onboarding: onboardingApi,
  burrow: burrowApi,
  explore: exploreApi,
  chat: chatApi,
  meetups: meetupsApi,
  community: communityApi,
  notifications: notificationsApi,
  admin: adminApi,
}
export type Api = typeof api

export { API_MODE, API_BASE, areaMode } from './config'
export { ApiError, isApiError, isNotFound, isUnauthorized } from './client'
export { errorText } from './common/errors'
export { patch, useOptimistic, toastApiError } from './optimistic'
