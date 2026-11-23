'use client'

import { RouteError } from '@/components/NotFound'

/**
 * 에러 경계 1 (맨 바깥, docs/frontend-hardening.md "에러 경계"): 시작 화면 · 온보딩 · 관리자, 로그인 영역 틀(헤더) 자체가 깨질 때.
 * Vite 앱의 맨 바깥 errorElement 와 같음. 루트 레이아웃이 깨지면 global-error.tsx
 */
export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} />
}
