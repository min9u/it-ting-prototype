import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
// Pretendard 는 CDN 대신 npm 패키지로 번들 (Vite 앱과 같음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@/styles/global.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: '디굴디굴',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

/**
 * 맨 바깥 틀 (Vite 앱의 index.html + main.tsx).
 * - 화면은 모두 브라우저에서만 그림 (providers.tsx 의 ClientOnly): 서버 HTML 은 빈 #root. Vite 앱(SPA)과 같은 첫 화면
 * - #root: 모달이 열리면 뒤 화면을 inert 로 막는 기준 (components/Modal.tsx), 스모크 검사도 #root 를 봄
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 제목·버튼 글꼴 Do Hyeon (styles/tokens.css --font-display). Vite 앱 index.html 과 같은 링크 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- 루트 레이아웃이라 모든 화면에 한 번만 들어감 */}
        <link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
