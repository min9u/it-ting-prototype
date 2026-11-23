'use client'

import NotFound from '@/components/NotFound'

/** 어느 라우트에도 안 맞는 주소 (로그인 영역 밖). 로그인 영역의 없는 주소는 (app)/[...rest] → (app)/not-found.tsx (헤더 있음) */
export default function RootNotFound() {
  return <NotFound />
}
