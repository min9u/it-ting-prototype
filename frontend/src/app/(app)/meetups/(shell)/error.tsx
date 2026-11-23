'use client'

import { RouteError } from '@/components/NotFound'

/** 모임 탭 · 옆 위젯은 두고 안쪽 목록만 안내 (inline) */
export default function MeetupsError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} inline />
}
