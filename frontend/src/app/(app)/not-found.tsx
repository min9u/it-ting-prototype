'use client'

import NotFound from '@/components/NotFound'

/** 로그인 영역의 없는 주소: 헤더(GNB)는 두고 "없는 주소예요" (Vite 앱의 path: '*') */
export default function AppNotFound() {
  return <NotFound />
}
