/**
 * 02 로그인 · 회원가입 — TanStack Query 훅과 캐시 키
 *
 * 로그인 · 가입 같은 "로그인 없이 부르는 쓰기"는 아래 useLogin · useSignup … 훅 (meta.quiet401: 로그인 실패 LOGIN_FAILED 도 401 이라
 * 공용 MutationCache 가 "다시 로그인"으로 보내지 않게). 성공한 뒤에는 useSessionReset() 으로 내 계정 캐시를 새로 받는다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isUnauthorized } from '../client'
import type { ApiMeta } from '../queryClient'
import { authApi } from './api'
import { toMe, type MeVM } from './mappers'
import type {
  EmailVerificationCheckRequest, EmailVerificationRequest, LoginRequest, PasswordResetCompleteRequest, PasswordResetRequest, SignupRequest,
  SsafyVerificationRequest,
} from './types'

export const authKeys = {
  all: ['auth'] as const,
  me: ['auth', 'me'] as const,
  passwordReset: (token: string) => ['auth', 'password-reset', token] as const,
}

/**
 * 내 계정 · 다음 단계 (GET /me). 로그인하지 않았으면(401) 오류가 아니라 data 가 null.
 * 서비스를 처음 열 때 · 로그인 영역에 들어갈 때 (screens/start/Guards.tsx RequireLogin)
 */
export function useMe(enabled = true) {
  return useQuery<MeVM | null>({
    queryKey: authKeys.me,
    queryFn: async ({ signal }) => {
      try { return toMe(await authApi.me(signal)) } catch (e) { if (isUnauthorized(e)) return null; throw e }
    },
    enabled,
    staleTime: 60_000,
  })
}

/**
 * 로그인 · 가입 · 로그아웃 · 탈퇴 뒤: 내 계정 캐시를 버리고 다시 받게.
 * 같은 탭에서 다른 계정으로 로그인해도 이전 계정의 데이터(내 땅굴 · 계정 · 대화 목록 …)가 보이지 않게 계정마다 다른 캐시를 먼저 모두 버림
 */
export function useSessionReset() {
  const qc = useQueryClient()
  return () => {
    void qc.cancelQueries()
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'common' && q.queryKey[0] !== authKeys.all[0] })
    return qc.resetQueries({ queryKey: authKeys.all })
  }
}

/** 재설정 링크가 유효한지 (GET /password-resets/{token}). 404 PASSWORD_RESET_LINK_INVALID 면 isError */
export function usePasswordResetLink(token: string | null) {
  return useQuery({
    queryKey: authKeys.passwordReset(token ?? ''),
    queryFn: ({ signal }) => authApi.checkPasswordReset(token ?? '', signal),
    enabled: !!token,
    staleTime: 0,
    gcTime: 0,
  })
}

/* ===== 로그인 없이 부르는 쓰기 (401 이 정상 답이라 공용 "다시 로그인"을 끔) ===== */
const PUBLIC_META: ApiMeta = { quiet401: true }
function usePublicMutation<V, R>(fn: (v: V) => Promise<R>) {
  return useMutation({ mutationFn: fn, meta: { ...PUBLIC_META } })
}
/** 로그인 (POST /sessions). 401 LOGIN_FAILED · 403 ACCOUNT_SUSPENDED 는 화면이 code 로 */
export const useLogin = () => usePublicMutation((v: LoginRequest) => authApi.login(v))
/** 이메일 인증 코드 보내기 · 확인 */
export const useSendEmailCode = () => usePublicMutation((v: EmailVerificationRequest) => authApi.sendEmailCode(v))
export const useCheckEmailCode = () => usePublicMutation((v: EmailVerificationCheckRequest) => authApi.checkEmailCode(v))
/** SSAFY 인증 코드 보내기 · 가입 */
export const useSendSsafyCode = () => usePublicMutation((v: SsafyVerificationRequest) => authApi.sendSsafyCode(v))
export const useSignup = () => usePublicMutation((v: SignupRequest) => authApi.signup(v))
/** 비밀번호 재설정 메일 · 새 비밀번호 */
export const useRequestPasswordReset = () => usePublicMutation((v: PasswordResetRequest) => authApi.requestPasswordReset(v))
export const useCompletePasswordReset = () => usePublicMutation((v: { token: string; body: PasswordResetCompleteRequest }) => authApi.completePasswordReset(v.token, v.body))

/** 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름). 세션은 쓰기 뒤 useSessionReset 으로 맞춤 */
export function useAuthMockSync() { /* 지켜볼 저장소 없음 */ }
