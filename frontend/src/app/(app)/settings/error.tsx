'use client'

import { RouteError } from '@/components/NotFound'

/** 설정 왼쪽 메뉴는 두고 오른쪽 내용만 안내 (inline) */
export default function SettingsError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} inline />
}
