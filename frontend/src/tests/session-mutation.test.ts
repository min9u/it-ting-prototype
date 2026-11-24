/**
 * 계정이 바뀐 뒤 늦게 끝난 쓰기가 새 계정의 캐시를 바꾸지 않는지 (PR #37 Codex 리뷰 P0).
 * A 가 단골 해제를 보내고 응답 전에 로그아웃 → B 로그인 → A 의 요청이 늦게 실패해도 되돌리기(A 의 스냅샷)가 안 들어감
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSessionMutation } from '../api/sessionMutation'
import { newSession } from '../api/queryClient'

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => h(QueryClientProvider, { client: qc }, children)
  let settle!: { ok: (v: string) => void; fail: (e: Error) => void }
  const call = () => new Promise<string>((ok, fail) => { settle = { ok, fail } })
  return { qc, wrapper, call: vi.fn(call), get settle() { return settle } }
}

describe('useSessionMutation', () => {
  it('같은 세션이면 되돌리기 · 성공 처리를 그대로 부름', async () => {
    const t = setup()
    const onError = vi.fn(); const onSettled = vi.fn()
    const { result } = renderHook(() => useSessionMutation({ mutationFn: t.call, onMutate: () => 'snapshot', onError, onSettled }), { wrapper: t.wrapper })
    act(() => { result.current.mutate() })
    await waitFor(() => expect(t.call).toHaveBeenCalled())
    act(() => { t.settle.fail(new Error('늦은 실패')) })
    await waitFor(() => expect(onSettled).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith(expect.any(Error), undefined, 'snapshot', expect.anything())
  })

  it('그 사이 계정이 바뀌면(newSession) 되돌리기 · 성공 처리를 건너뜀', async () => {
    const t = setup()
    const onError = vi.fn(); const onSuccess = vi.fn(); const onSettled = vi.fn()
    const { result } = renderHook(() => useSessionMutation({ mutationFn: t.call, onMutate: () => 'A 의 스냅샷', onError, onSuccess, onSettled }), { wrapper: t.wrapper })
    act(() => { result.current.mutate() })
    await waitFor(() => expect(t.call).toHaveBeenCalled())
    newSession() // 로그아웃 → 다른 계정 로그인
    act(() => { t.settle.fail(new Error('늦은 실패')) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(onError).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()

    act(() => { result.current.mutate() })
    await waitFor(() => expect(t.call).toHaveBeenCalledTimes(2))
    newSession()
    act(() => { t.settle.ok('늦은 성공') })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('쓰기 훅은 모두 useSessionMutation (세션을 바꾸는 api/auth 만 예외)', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string; readdirSync(p: string): string[] }
    const files = ['src/api/optimistic.ts', ...fs.readdirSync('src/api').filter((d) => !d.includes('.') && d !== 'auth').map((d) => `src/api/${d}/queries.ts`)]
    for (const f of files) {
      let src = ''
      try { src = fs.readFileSync(f, 'utf8') } catch { continue }
      expect(/\buseMutation\(/.test(src), f).toBe(false)
    }
  })
})

