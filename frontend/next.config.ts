import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

/*
 * 디굴디굴 프론트엔드 Next.js 설정 (docs/nextjs-migration.md)
 *
 * 1. 실험실(labs) 스위치: NEXT_PUBLIC_LABS=1 일 때만 실험실 페이지(page.lab.tsx)와 화면 안 실험 패널이 빌드에 들어감
 *    - next dev 는 기본 켬, next build 는 기본 끔 (켜려면 NEXT_PUBLIC_LABS=1 npm run build)
 *    - 꺼지면 pageExtensions 에 'lab.tsx' 가 없어서 /lab/style 같은 주소가 아예 없음(404), 코드도 묶이지 않음
 *    - 화면 안 패널은 src/labs/index.ts 가 빌드 때 정해지는 값으로 고름 (꺼지면 빈 컴포넌트)
 * 2. /api/v1/* 를 백엔드로 넘김 (Vite 프록시 대신 rewrites). 기본 http://localhost:8080, API_PROXY_TARGET 으로 바꿈, off 면 끔
 * 3. 에셋: glb · 이미지는 import 하면 URL 문자열 (Vite 와 같음). Turbopack 규칙 type: 'asset'
 */

/** "1"·"true"·"yes"·"on" 만 참 (src/lib/env.ts flag 와 같은 규칙) */
function flag(v: string | undefined, fallback: boolean): boolean {
  if (v == null || v.trim() === '') return fallback
  return /^(1|true|yes|on)$/i.test(v.trim())
}

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER
  const labs = flag(process.env.NEXT_PUBLIC_LABS, dev)
  // 백엔드 주소 (서버에서만 읽음, 브라우저 코드에 안 들어감). DEV_PROXY_TARGET 은 Vite 앱과 같은 이름이라 같이 받음
  const target = (process.env.API_PROXY_TARGET || process.env.DEV_PROXY_TARGET || 'http://localhost:8080').replace(/\/+$/, '')

  return {
    reactStrictMode: true,
    // next dev 가 frontend/AGENTS.md 를 만들지 않게 (에이전트 규칙은 팀 리포 맨 위 AGENTS.md 한 곳에서)
    agentRules: false,
    // 실험실 페이지는 page.lab.tsx. 켤 때만 페이지 확장자에 넣음
    pageExtensions: labs ? ['tsx', 'ts', 'lab.tsx'] : ['tsx', 'ts'],
    env: {
      // 클라이언트 코드가 빌드 때 받는 값 (src/lib/env.ts 에서만 읽음)
      NEXT_PUBLIC_LABS: labs ? '1' : '0',
      // 빌드 표시: 저사양 정지 그림 캐시(three/stills.ts)의 키 앞에 붙여, 다시 배포하면 예전 그림을 안 씀
      NEXT_PUBLIC_BUILD_STAMP: dev ? 'dev' : Date.now().toString(36),
    },
    // 압축 끔: Next 의 gzip 미들웨어가 /api/v1 rewrite 로 넘긴 실시간 소식(SSE, text/event-stream)을 모아 두어
    // 이벤트가 안 옴 (next start 에서 5초 동안 10바이트, 끄면 바로 옴. docs/nextjs-migration.md "SSE").
    // 배포는 앞단 Nginx 가 압축하고 /api 를 Spring 으로 바로 넘기는 구성을 전제로 함
    compress: false,
    experimental: {
      // rewrite 프록시의 기본 대기 30초가 지나면 SSE 연결이 끊김 → 1시간 (끊겨도 realtime/events.ts 가 다시 연결)
      proxyTimeout: 60 * 60 * 1000,
    },
    // /onboarding → 온보딩 1 (Vite 앱의 <Navigate to="/onboarding/name" replace />). 서버에서 307 로 보냄
    async redirects() {
      return [{ source: '/onboarding', destination: '/onboarding/name', permanent: false }]
    },
    async rewrites() {
      if (target === 'off') return []
      return [{ source: '/api/v1/:path*', destination: `${target}/api/v1/:path*` }]
    },
    images: {
      // import 한 이미지를 Vite 처럼 URL 문자열로 (next/image 용 객체 대신). 아래 Turbopack 규칙과 짝
      disableStaticImages: true,
    },
    turbopack: {
      rules: {
        // Vite 의 `?url` 과 같은 결과: 파일을 내보내고 주소 문자열을 줌
        '*.glb': { type: 'asset' },
        '*.png': { type: 'asset' },
        '*.jpg': { type: 'asset' },
        '*.webp': { type: 'asset' },
        '*.svg': { type: 'asset' },
      },
    },
  }
}
