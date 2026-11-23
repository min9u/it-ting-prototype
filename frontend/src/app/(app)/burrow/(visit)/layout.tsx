'use client'

import type { ReactNode } from 'react'
import VisitBurrow from '@/screens/burrow/VisitBurrow'

/**
 * 남의 땅굴 /burrow/:userId. 다른 사람 땅굴로 옮겨 가도 화면(3D 포함)을 새로 만들지 않게 레이아웃이 그림
 * (react-router 와 같은 동작. Next 는 주소 파라미터가 바뀌면 page 를 새로 만듦). (visit) 는 주소에 안 나타나는 묶음
 */
export default function VisitLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <VisitBurrow />
      {children}
    </>
  )
}
