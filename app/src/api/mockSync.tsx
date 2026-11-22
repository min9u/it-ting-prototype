/**
 * 목 모드: 저장소가 바뀌면 "서버 값이 바뀐 것"으로 보고 영역 캐시를 새로 받음 (App.tsx AppLayout 에 한 번 둠).
 * 영역마다 훅 하나 (api/<영역>/queries.ts 의 use<영역>MockSync, 처음엔 빈 훅). 실제 서버로 바꾼 영역의 훅은 아무것도 안 함.
 * 영역 작업자는 자기 영역 훅 안만 고친다 (이 파일은 고치지 않음)
 */
import { ANY_MOCK } from './config'
import { useCommonMockSync } from './common/queries'
import { useAuthMockSync } from './auth/queries'
import { useSettingsMockSync } from './settings/queries'
import { useOnboardingMockSync } from './onboarding/queries'
import { useBurrowMockSync } from './burrow/queries'
import { useExploreMockSync } from './explore/queries'
import { useChatMockSync } from './chat/queries'
import { useMeetupsMockSync } from './meetups/queries'
import { useCommunityMockSync } from './community/queries'
import { useNotificationsMockSync } from './notifications/queries'

function MockSyncInner() {
  useCommonMockSync()
  useAuthMockSync()
  useSettingsMockSync()
  useOnboardingMockSync()
  useBurrowMockSync()
  useExploreMockSync()
  useChatMockSync()
  useMeetupsMockSync()
  useCommunityMockSync()
  useNotificationsMockSync()
  return null
}
export function MockServerSync() {
  return ANY_MOCK ? <MockSyncInner /> : null
}
