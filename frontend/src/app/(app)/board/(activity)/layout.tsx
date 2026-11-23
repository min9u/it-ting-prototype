'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { BoardActivity } from '@/screens/board/Board'

/**
 * 게시판 내 활동 /board/saved · /board/mine · /board/commented.
 * react-router 에서는 세 주소가 같은 <BoardActivity /> 를 그대로 썼음(고른 카테고리 · 쪽 번호가 남음) → 같게 레이아웃이 그림.
 * (activity) 는 주소에 안 나타나는 묶음
 */
export default function ActivityLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const kind = pathname.endsWith('/mine') ? 'mine' : pathname.endsWith('/commented') ? 'commented' : 'saved'
  return (
    <>
      <BoardActivity kind={kind} />
      {children}
    </>
  )
}
