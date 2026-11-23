'use client'

import type { ReactNode } from 'react'
import AppShell from '@/components/AppShell'

/** 로그인 영역 (Vite 앱 App.tsx 의 RequireLogin + AppLayout). (app) 은 주소에 안 나타나는 묶음 */
export default function LoggedInLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
