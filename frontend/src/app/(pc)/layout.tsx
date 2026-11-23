'use client'

import type { ReactNode } from 'react'
import { PcOnly } from '@/screens/start/Guards'

/** F1 · F2 시작 화면 묶음 (02 명세 2026-11-16): 휴대폰 · 태블릿이면 "PC에서 이용해 주세요" (00 공통 20). 주소에는 안 나타나는 묶음 */
export default function PcLayout({ children }: { children: ReactNode }) {
  return <PcOnly>{children}</PcOnly>
}
