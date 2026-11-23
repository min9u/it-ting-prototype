'use client'

import type { ReactNode } from 'react'
import { OutletProvider } from '@/lib/nav'
import MeetupsShell from '@/screens/meetups/MeetupsShell'

/**
 * 모임 목록 /meetups · 내 모임 /meetups/me 의 틀(옆 위젯 · 탭). 안쪽 화면은 MeetupsShell 의 <Outlet /> 자리에.
 * /meetups/new · /meetups/:id 는 이 틀 밖 (Vite 앱 App.tsx 와 같음). (shell) 은 주소에 안 나타나는 묶음
 */
export default function MeetupsShellLayout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider outlet={children}>
      <MeetupsShell />
    </OutletProvider>
  )
}
