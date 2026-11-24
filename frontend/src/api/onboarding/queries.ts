/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) — TanStack Query 훅과 캐시 키
 * 관심사 · 질문 목록은 운영자가 DB 에서 고치는 값이라 한 번 받으면 이 탭 안에서는 다시 받지 않는다 (staleTime Infinity)
 */
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionMutation } from '../sessionMutation'
import { toDtoId } from '../common/ids'
import { onboardingApi } from './api'
import { toInterestCatalog, toProfile, toQuestions } from './mappers'
import type { OnboardingCompleteRequest } from './types'

export const onboardingKeys = {
  all: ['onboarding'] as const,
  interestCategories: ['onboarding', 'interest-categories'] as const,
  introQuestions: ['onboarding', 'intro-questions'] as const,
  profiles: ['onboarding', 'profile'] as const,
  profile: (userId: string) => ['onboarding', 'profile', userId] as const,
}

/** 관심사 대분류 12 · 세부 90 (+ id ↔ 앱 코드 표). 화면은 data.categories 를 예전 CATEGORIES 자리에 씀 */
export function useInterestCatalog() {
  return useQuery({
    queryKey: onboardingKeys.interestCategories,
    queryFn: async ({ signal }) => toInterestCatalog(await onboardingApi.interestCategories(signal)),
    staleTime: Infinity,
  })
}

/** 자기소개 질문 (두 종류 모두). 대분류 코드를 잇으려고 관심사 목록과 함께 씀 */
export function useIntroQuestions() {
  const catalog = useInterestCatalog()
  const q = useQuery({
    queryKey: onboardingKeys.introQuestions,
    queryFn: ({ signal }) => onboardingApi.introQuestions(undefined, signal),
    staleTime: Infinity,
  })
  const data = useMemo(() => (q.data ? toQuestions(q.data, catalog.data) : undefined), [q.data, catalog.data])
  return { data, isLoading: q.isLoading || catalog.isLoading, error: q.error ?? catalog.error, refetch: () => { void q.refetch(); void catalog.refetch() } }
}

/** 프로필 팝업 (00 공통 15). userId 는 앱 id. 비어 있으면 부르지 않음 */
export function useUserProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: onboardingKeys.profile(userId ?? ''),
    queryFn: async ({ signal }) => toProfile(await onboardingApi.userProfile(toDtoId(userId!), signal)),
    enabled: !!userId,
  })
}

/** 닉네임 확인 (온보딩 1 "다음", 내 정보 수정). 실패는 화면이 칸 밑에 보여 주므로 토스트 없음 */
export function useCheckNickname() {
  return useSessionMutation({ mutationFn: (nickname: string) => onboardingApi.checkNickname(nickname) })
}

/** 온보딩 확정 (온보딩 4 "관심사 확정"). 성공하면 모든 캐시를 새로 받음 (내 땅굴 · 내 계정 · 사람 표시가 바뀜) */
export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useSessionMutation({
    mutationFn: (body: OnboardingCompleteRequest) => onboardingApi.completeOnboarding(body),
    // 새로 받는 것(GET /me 의 nextStep 포함)을 기다린 뒤 화면이 이동하게 Promise 를 돌려줌.
    // 안 기다리면 로그인 검사(RequireLogin)가 옛 nextStep ONBOARDING 을 보고 온보딩 1로 되돌림 (명세 03: 확정 → 내 땅굴)
    onSuccess: () => qc.invalidateQueries(),
  })
}

/**
 * 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름).
 * 이 영역의 저장소(data/myBurrow · interests · moleItems)는 이 영역 API 로만 바뀌고, 쓰기 훅이 캐시를 새로 받으므로 지켜볼 것이 없다
 */
export function useOnboardingMockSync() { /* 지켜볼 저장소 없음 */ }
