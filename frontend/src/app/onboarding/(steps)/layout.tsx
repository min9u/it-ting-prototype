'use client'

import type { ReactNode } from 'react'
import { RequireLogin } from '@/screens/start/Guards'
import Onboarding from '@/screens/onboarding/Onboarding'

/**
 * 온보딩 /onboarding/:step. 단계(:step)가 바뀌어도 화면을 새로 만들지 않도록 레이아웃이 그림
 * (Next 는 주소 파라미터가 바뀌면 page 를 새로 만듦 → 이름 · 관심사 · 답이 사라짐. react-router 는 그대로 둠).
 * (steps) 는 주소에 안 나타나는 묶음: 이 레이아웃은 [step] 바깥이라 단계가 바뀌어도 남음
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <RequireLogin onboarding>
      <Onboarding />
      {children}
    </RequireLogin>
  )
}
