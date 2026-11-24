'use client'

import { useEffect, type ReactNode } from 'react'
import AppHeader from './AppHeader'
import { ApiToaster } from './AsyncState'
import { MockServerSync } from '../api/mockSync'
import { useChatEvents } from '../api/chat'
import { MyWornSync } from '../api/burrow'
import { startEventStream } from '../realtime/events'
import NewTermGate from '../screens/burrow/NewTermGate'
import { RequireLogin } from '../screens/start/Guards'
import { ApiKnobBadge } from '../labs'

/**
 * 로그인 뒤 화면 틀 (Vite 앱 App.tsx 의 AppLayout): 헤더(GNB) + 내용 + 쓰기 실패 토스트 · 목 서버 손잡이 배지(실험실).
 * 실시간 소식 연결(SSE)은 여기 들어올 때 시작 (src/realtime/events.ts).
 * 쓰는 곳: src/app/(app)/layout.tsx (로그인 영역 모든 화면), src/app/not-found.tsx (없는 주소도 헤더와 함께, Vite 앱의 path: '*')
 */
function AppLayout({ children }: { children: ReactNode }) {
  // 실시간 소식(SSE, 명세 v1 GET /me/event-stream)은 로그인 영역에 들어올 때 한 번 연결 (realtime/events.ts)
  useEffect(() => { startEventStream() }, [])
  // 채팅 소식(새 메시지 · 요청 수)을 캐시에 반영 (api/chat/queries.ts)
  useChatEvents()
  return (
    <>
      <AppHeader />
      {children}
      <ApiToaster />
      <ApiKnobBadge />
      <MockServerSync />
      {/* 실제 모드: 내 두더지 모습을 서버 값으로 (api/burrow/queries.ts) */}
      <MyWornSync />
      {/* 05 새 학기 안내: 이번 학기 캠퍼스-층을 고르기 전에는 어느 화면에서든 닫을 수 없는 안내 */}
      <NewTermGate />
    </>
  )
}

/** 비로그인이면 로그인 화면으로 (00 공통 11, RequireLogin) */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireLogin>
      <AppLayout>{children}</AppLayout>
    </RequireLogin>
  )
}
