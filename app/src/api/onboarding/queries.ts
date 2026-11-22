/** 03 온보딩 — TanStack Query 훅과 캐시 키 (화면 연결은 온보딩 · 내 땅굴 작업자가) */
export const onboardingKeys = {
  all: ['onboarding'] as const,
  interestCategories: ['onboarding', 'interest-categories'] as const,
  introQuestions: ['onboarding', 'intro-questions'] as const,
  profile: (userId: string) => ['onboarding', 'profile', userId] as const,
}

/** 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름). 필요하면 useMockStoreSync(…) 를 여기에 */
export function useOnboardingMockSync() { /* 아직 지켜볼 저장소 없음 */ }
