/**
 * TanStack Query 설정 + 오류 토스트 저장소 (모든 영역이 같이 씀)
 * - 재시도: GET 재시도는 client.ts(withRetry)·목 서버가 이미 함 → 여기서는 끔 (두 번 겹치지 않게)
 * - staleTime 30초: 화면을 오가도 바로 다시 부르지 않음. 쓰기 뒤에는 관련 키를 invalidate 해서 새로 받음
 * - 401 은 어디서 났든 notifyUnauthorized → main.tsx 가 정한 처리 (로그인 화면으로)
 * - 캐시 키는 영역마다 api/<영역>/queries.ts 의 <영역>Keys (첫 칸이 영역 이름이라 서로 겹치지 않음)
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isUnauthorized, notifyUnauthorized } from './client'
import { createStore } from '../lib/store'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => { if (isUnauthorized(e)) notifyUnauthorized() } }),
  mutationCache: new MutationCache({ onError: (e) => { if (isUnauthorized(e)) notifyUnauthorized() } }),
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

/* ===== 오류 토스트 (쓰기가 실패해 되돌렸을 때) ===== */
export interface ErrorToast { id: number; title: string; desc?: string }
export const errorToastStore = createStore<{ toast: ErrorToast | null }>({ toast: null })
let toastSeq = 0
export function showErrorToast(title: string, desc?: string) {
  errorToastStore.set({ toast: { id: ++toastSeq, title, desc } })
}
