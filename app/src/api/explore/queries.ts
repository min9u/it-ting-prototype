/** 05 탐색 · 방문 — TanStack Query 훅과 캐시 키 */
import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { getRegulars, subscribeRegulars } from '../../data/field'
import { exploreApi } from './api'
import { toBurrow, toGuestbookEntry } from './mappers'

/** 캐시 키 (첫 칸 'explore'). 땅굴과 그 방명록은 앞부분이 같아서 땅굴만 바꿀 때는 patch(…, exact = true) */
export const exploreKeys = {
  all: ['explore'] as const,
  burrow: (userId: string) => ['explore', 'burrow', userId] as const,
  guestbook: (userId: string) => ['explore', 'burrow', userId, 'guestbook'] as const,
}

export function useBurrow(userId: string, enabled = true) {
  return useQuery({ queryKey: exploreKeys.burrow(userId), queryFn: async ({ signal }) => toBurrow(await exploreApi.get(userId, signal)), enabled })
}
export function useGuestbook(userId: string) {
  return useQuery({
    queryKey: exploreKeys.guestbook(userId),
    queryFn: async ({ signal }) => (await exploreApi.guestbook(userId, null, 50, signal)).items.map(toGuestbookEntry),
  })
}

/** 목 모드: 단골 목록이 바뀌면 탐색 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useExploreMockSync() { useMockStoreSync('explore', useSyncExternalStore(subscribeRegulars, getRegulars), exploreKeys.all) }
