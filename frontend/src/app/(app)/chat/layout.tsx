'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Chat from '@/screens/chat/Chat'

/**
 * 채팅 /chat · /chat/requests · /chat/:roomId. 대화방을 바꿔도 목록 · 3D 찻방이 새로 만들어지지 않게 레이아웃이 화면을 그림
 * (react-router 에서는 세 주소가 같은 <Chat /> 를 그대로 썼음). page 들은 비어 있음
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <>
      <Chat requests={pathname === '/chat/requests'} />
      {children}
    </>
  )
}
