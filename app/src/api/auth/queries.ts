/** 02 로그인 · 회원가입 — TanStack Query 훅과 캐시 키 */
import { useQuery } from '@tanstack/react-query'
import { authApi } from './api'
import { toMe } from './mappers'

export const authKeys = {
  all: ['auth'] as const,
  me: ['auth', 'me'] as const,
}

/** 내 계정 · 다음 단계 (401 이면 isError + isUnauthorized(error)) */
export function useMe(enabled = true) {
  return useQuery({ queryKey: authKeys.me, queryFn: async ({ signal }) => toMe(await authApi.me(signal)), enabled })
}

/** 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름). 필요하면 useMockStoreSync(…) 를 여기에 */
export function useAuthMockSync() { /* 아직 지켜볼 저장소 없음 */ }
