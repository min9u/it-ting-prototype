/**
 * 00 공통 — TanStack Query 훅과 캐시 키. 캠퍼스 · 기수는 운영자가 DB 에서 고치는 값이라 한 번 받으면 다시 받지 않음
 */
import { useQuery } from '@tanstack/react-query'
import { commonApi } from './api'
import { toCampuses, toGenerations } from './mappers'

/** 캐시 키 (영역마다 첫 칸이 영역 이름) */
export const commonKeys = {
  all: ['common'] as const,
  campuses: ['common', 'campuses'] as const,
  generations: ['common', 'generations'] as const,
}

export function useCampuses() {
  return useQuery({ queryKey: commonKeys.campuses, queryFn: async ({ signal }) => toCampuses(await commonApi.campuses(signal)), staleTime: Infinity })
}
export function useGenerations() {
  return useQuery({ queryKey: commonKeys.generations, queryFn: async ({ signal }) => toGenerations(await commonApi.generations(signal)), staleTime: Infinity })
}

/** 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름). 필요하면 useMockStoreSync(…) 를 여기에 */
export function useCommonMockSync() { /* 아직 지켜볼 저장소 없음 */ }
