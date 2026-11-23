import type { ReactNode } from 'react'

/** 루트 레이아웃. 글꼴 · 전역 스타일 · 공통 providers 는 앱 바깥 틀을 넣을 때 채운다 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
