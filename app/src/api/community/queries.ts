/** 08 커뮤니티 — TanStack Query 훅과 캐시 키 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { usePosts } from '../../data/boardStore'
import { communityApi } from './api'
import { toBoardPost } from './mappers'
import type { PostListQuery } from './types'

/** 캐시 키 (첫 칸 'community') */
export const communityKeys = {
  all: ['community'] as const,
  list: (q: PostListQuery) => ['community', 'list', q] as const,
  detail: (id: string) => ['community', 'detail', id] as const,
}

export function usePostList(q: PostListQuery, enabled = true) {
  return useQuery({
    queryKey: communityKeys.list(q),
    queryFn: async ({ signal }) => { const p = await communityApi.list(q, signal); return { ...p, items: p.items.map((d) => toBoardPost(d)) } },
    placeholderData: keepPreviousData,
    enabled,
  })
}
/** 글 + 댓글 (댓글은 커서지만 지금 화면은 "N개 더 보기"를 앱 안에서 하므로 한 번에 100개) */
export function usePostDetail(id: string) {
  return useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: async ({ signal }) => {
      const [p, c] = await Promise.all([communityApi.get(id, signal), communityApi.comments(id, null, 100, signal)])
      return toBoardPost(p, c.items)
    },
  })
}

/** 목 모드: 게시판 저장소가 바뀌면 커뮤니티 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useCommunityMockSync() { useMockStoreSync('community', usePosts(), communityKeys.all) }
