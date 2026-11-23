/**
 * 목 모드: 저장소가 바뀌면 "서버 값이 바뀐 것"으로 보고 영역 캐시를 새로 받음 (App.tsx AppLayout 에 한 번 둠).
 * 영역마다 훅 하나 (api/<영역>/queries.ts 의 use<영역>MockSync, 처음엔 빈 훅). 실제 서버로 바꾼 영역의 훅은 아무것도 안 함.
 * 영역 작업자는 자기 영역 훅 안만 고친다 (이 파일은 고치지 않음)
 */
import { useEffect } from 'react'
import { ANY_MOCK } from './config'
import { ENV } from '../lib/env'
import { mockMeetupActors } from './meetups/mock'
import { mockCommunityActors } from './community/mock'
import { mockGuestbookActors } from './explore/mock'
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
  useEffect(installMockActors, [])
  return null
}

/**
 * 개발 서버 콘솔 손잡이: 다른 사람이 하는 일을 흉내 내 알림 · 화면을 확인 (목 서버 전용, 채팅은 따로 __digulChat)
 *   __digulMock.meetups.apply('seobeok')         누가 내 모임에 신청 → 빨간 점 (MEETUP_APPLICATION_RECEIVED)
 *   __digulMock.meetups.decide('m2', true)       주최자가 내 신청을 수락 / false 면 거절
 *   __digulMock.guestbook.write('yerin', '안녕')   누가 내 방명록에 글
 *   __digulMock.community.comment('yerin') · .like('mingu')   내 글에 댓글 · 좋아요
 */
function installMockActors() {
  if (!ENV.dev || typeof window === 'undefined') return
  (window as unknown as { __digulMock?: unknown }).__digulMock = { meetups: mockMeetupActors, guestbook: mockGuestbookActors, community: mockCommunityActors }
}
export function MockServerSync() {
  return ANY_MOCK ? <MockSyncInner /> : null
}
