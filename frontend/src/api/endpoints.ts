/**
 * 영역마다 명세대로 구현한 API 목록 (각 real.ts 의 ENDPOINTS) 을 모음. src/tests/api-v1-endpoints.test.ts 가 명세와 비교한다.
 * 영역 작업자는 이 파일을 고치지 않는다 (자기 real.ts 의 ENDPOINTS 와 PENDING 만)
 */
import type { Area } from './config'
import { ENDPOINTS as common } from './common/real'
import { ENDPOINTS as auth } from './auth/real'
import { ENDPOINTS as settings } from './settings/real'
import { ENDPOINTS as onboarding } from './onboarding/real'
import { ENDPOINTS as burrow } from './burrow/real'
import { ENDPOINTS as explore } from './explore/real'
import { ENDPOINTS as chat } from './chat/real'
import { ENDPOINTS as meetups } from './meetups/real'
import { ENDPOINTS as community } from './community/real'
import { ENDPOINTS as notifications } from './notifications/real'
import { ENDPOINTS as admin } from './admin/real'

export const ENDPOINTS_BY_AREA: Record<Area, readonly string[]> = {
  common, auth, settings, onboarding, burrow, explore, chat, meetups, community, notifications, admin,
}
