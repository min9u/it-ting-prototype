'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, setOnboardingIncompleteHandler } from '@/api/queryClient'
import { setUnauthorizedHandler } from '@/api/client'
import GpuNotice from '@/components/GpuNotice'
import DeviceGate from '@/components/DeviceGate'
import NetworkBanner from '@/components/NetworkBanner'
import { handleOnboardingIncomplete, handleUnauthorized } from '@/lib/authFlow'
import { NavBridge } from '@/lib/nav'
import { LowLab } from '@/labs'

// API 401 이 리프레시로도 안 풀리면 → lib/authFlow (지금은 LOGIN_FREE 라 기록만)
setUnauthorizedHandler(() => handleUnauthorized('api 401'))
// 어느 API 든 403 ONBOARDING_INCOMPLETE → 온보딩 1 (lib/authFlow)
setOnboardingIncompleteHandler(handleOnboardingIncomplete)

const noop = () => () => {}

/**
 * 브라우저에서만 그림: 서버(빌드 · 첫 HTML)에서는 아무것도 안 그리고, 브라우저에 붙은 뒤 한 번에 그림.
 * 화면들이 처음 그릴 때부터 localStorage · sessionStorage · window 를 읽어서(목 서버 · 저사양 감지 · 3D),
 * 서버에서 그리면 브라우저 결과와 달라짐(hydration 경고) → Vite 앱(SPA)처럼 브라우저에서만
 */
function ClientOnly({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false)
  return client ? <>{children}</> : null
}

/** Vite 앱 main.tsx 의 바깥 틀: 기기 안내 → 서버 데이터 캐시 → 화면 + 가속 꺼짐 안내 · 연결 끊김 띠 · 🧪 실험실 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ClientOnly>
      {/* 00 공통 20: 휴대폰 · 태블릿이면 서비스 화면 대신 "PC에서 이용해 주세요" */}
      <DeviceGate>
        {/* 서버 데이터 캐시 (api/queryClient.ts). 목 모드에서도 같은 흐름 */}
        <QueryClientProvider client={queryClient}>
          <NavBridge />
          {children}
        </QueryClientProvider>
        <GpuNotice />
        <NetworkBanner />
        <LowLab />
      </DeviceGate>
    </ClientOnly>
  )
}
