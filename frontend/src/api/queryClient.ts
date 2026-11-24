/**
 * TanStack Query 설정 + 오류 토스트 저장소 (모든 영역이 같이 씀)
 * - 재시도: GET 재시도는 client.ts(withRetry)·목 서버가 이미 함 → 여기서는 끔 (두 번 겹치지 않게)
 * - staleTime 30초: 화면을 오가도 바로 다시 부르지 않음. 쓰기 뒤에는 관련 키를 invalidate 해서 새로 받음
 * - 401 은 어디서 났든 notifyUnauthorized → main.tsx 가 정한 처리 (로그인 화면으로).
 *   401 이 "로그인 실패"라는 정상 답인 호출(로그인 LOGIN_FAILED 등)은 훅에 meta: { quiet401: true } (client.ts 의 quiet401 과 같은 뜻)
 * - 403 ONBOARDING_INCOMPLETE 는 어느 API 에서 와도 온보딩 1 로 (main.tsx 가 setOnboardingIncompleteHandler 로 lib/authFlow 를 끼움)
 * - 캐시 키는 영역마다 api/<영역>/queries.ts 의 <영역>Keys (첫 칸이 영역 이름이라 서로 겹치지 않음)
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError, isUnauthorized, notifyUnauthorized } from './client'
import { createStore } from '../lib/store'

/** 훅의 meta 로 줄 수 있는 것 */
export interface ApiMeta { quiet401?: boolean }

/**
 * 세션 번호: 계정이 바뀔 때(401 · 로그인 성공 · 로그아웃 · 탈퇴) 늘어남 (lib/authFlow dropUserData, lib/signOut afterSignOut).
 * 그 전에 시작한 쓰기가 늦게 끝나도 새 계정의 캐시를 바꾸지 않게 (api/sessionMutation useSessionMutation)
 */
let sessionGen = 0
export const sessionGeneration = () => sessionGen
export function newSession() { sessionGen++ }

let onOnboardingIncomplete: (() => void) | null = null
/** 403 ONBOARDING_INCOMPLETE 처리 (main.tsx 가 lib/authFlow handleOnboardingIncomplete 를 끼움. 직접 import 하면 순환 참조) */
export function setOnboardingIncompleteHandler(f: (() => void) | null) { onOnboardingIncomplete = f }

/** 어느 API 든 실패했을 때 공통으로: 401 → 로그인 화면 (meta.quiet401 이면 안 함), 403 ONBOARDING_INCOMPLETE → 온보딩 1 */
function onApiError(e: unknown, meta: Record<string, unknown> | undefined) {
  if (isUnauthorized(e)) { if (!(meta as ApiMeta | undefined)?.quiet401) notifyUnauthorized(); return }
  if (isApiError(e) && e.status === 403 && e.code === 'ONBOARDING_INCOMPLETE') onOnboardingIncomplete?.()
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e, query) => onApiError(e, query.meta) }),
  mutationCache: new MutationCache({ onError: (e, _v, _c, mutation) => onApiError(e, mutation.options.meta) }),
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
