/**
 * 낙관적 쓰기가 실패하면 되돌린 뒤 바꿨던 캐시를 서버에서 다시 받는지 (PR #37 Codex 리뷰 P1).
 * 댓글 좋아요 대기 중에 다른 댓글을 지우고 좋아요가 실패하면, 요청 전 전체 목록으로 되돌려 지운 댓글이 다시 보였다
 */
import { describe, expect, it } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { patch, useOptimistic } from '../api/optimistic'

describe('useOptimistic 실패', () => {
  it('invalidate: [] 여도 실패하면 바꿨던 캐시를 새로 받게 만료시킴', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const key = ['community', 'comments', 'p1']
    qc.setQueryData(key, ['댓글 1', '댓글 2'])
    const wrapper = ({ children }: { children: ReactNode }) => h(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useOptimistic(), { wrapper })
    act(() => {
      result.current.mutate({ call: () => Promise.reject(new Error('좋아요 실패')), invalidate: [], patches: [patch<string[]>(key, (d) => [...d, '좋아요 반영'])] })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData(key)).toEqual(['댓글 1', '댓글 2'])
    expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
