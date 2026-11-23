'use client'

import type { ReactNode } from 'react'
import { OutletProvider } from '@/lib/nav'
import Settings from '@/screens/settings/Settings'

/** F10 설정 · 계정: 왼쪽 메뉴 + 항목별 화면(Settings 의 <Outlet /> 자리) */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider outlet={children}>
      <Settings />
    </OutletProvider>
  )
}
