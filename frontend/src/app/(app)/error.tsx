'use client'

import { RouteError } from '@/components/NotFound'

/** 에러 경계 3 (화면 하나): 헤더(GNB)는 두고 안쪽만 안내 (inline). 헤더 자체가 깨지면 바깥 app/error.tsx */
export default function AppError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} inline />
}
