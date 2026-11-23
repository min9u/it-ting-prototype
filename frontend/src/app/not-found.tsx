'use client'

import AppShell from '@/components/AppShell'
import NotFound from '@/components/NotFound'

/**
 * 어느 라우트에도 안 맞는 주소 → 응답 404 + 헤더(GNB)가 있는 "없는 주소예요".
 * Vite 앱은 로그인 영역 안의 path: '*' 였음 → 같은 틀(AppShell: 로그인 확인 + 헤더) 안에 그림.
 * 실험실이 꺼진 빌드의 /lab/style · /lab/rooms · /screens · /dev/crash 도 여기 (페이지가 아예 없음)
 */
export default function RootNotFound() {
  return (
    <AppShell>
      <NotFound />
    </AppShell>
  )
}
