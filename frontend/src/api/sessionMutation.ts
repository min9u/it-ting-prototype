/**
 * 계정이 바뀐 뒤 늦게 끝난 쓰기가 새 계정의 캐시를 바꾸지 않게 하는 useMutation (PR #37 Codex 리뷰 P0).
 * 예: A 가 단골 해제를 보내고 응답 전에 로그아웃 → B 로그인 → A 의 요청이 늦게 실패하면 되돌리기가 A 의 단골 목록을 B 의 캐시에 다시 넣었다.
 *
 * 시작할 때(onMutate) 세션 번호를 기록하고, 끝날 때(onSuccess · onError · onSettled) 번호가 바뀌었으면 그 처리를 건너뜀.
 * 화면에서 mutate(…, { onSuccess }) 로 넘긴 처리는 화면이 사라지면 TanStack Query 가 부르지 않으므로 여기서는 훅의 처리만 막는다.
 * 로그인 · 가입처럼 세션 자체를 바꾸는 쓰기(api/auth)는 그냥 useMutation.
 */
import { useMutation, type DefaultError, type UseMutationOptions } from '@tanstack/react-query'
import { sessionGeneration } from './queryClient'

type Stamp<C> = { gen: number; inner: C | undefined }

export function useSessionMutation<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown>(
  o: UseMutationOptions<TData, TError, TVariables, TContext>,
) {
  const same = (s: Stamp<TContext> | undefined) => !!s && s.gen === sessionGeneration()
  return useMutation<TData, TError, TVariables, Stamp<TContext>>({
    ...o,
    onMutate: async (v, c) => {
      const gen = sessionGeneration()
      const inner = o.onMutate ? await o.onMutate(v, c) : undefined
      return { gen, inner }
    },
    onSuccess: (d, v, s, c) => (same(s) ? o.onSuccess?.(d, v, s.inner as TContext, c) : undefined),
    onError: (e, v, s, c) => (same(s) ? o.onError?.(e, v, s?.inner, c) : undefined),
    onSettled: (d, e, v, s, c) => (same(s) ? o.onSettled?.(d, e, v, s?.inner, c) : undefined),
  })
}
