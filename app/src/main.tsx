import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './App'
import { queryClient } from './api/queryClient'
import { setUnauthorizedHandler } from './api/client'
import GpuNotice from './components/GpuNotice'
import LowLab from './components/LowLab'
import DeviceGate from './components/DeviceGate'
import NetworkBanner from './components/NetworkBanner'
import { installChunkReload } from './lib/chunkReload'
import { handleUnauthorized, registerNavigator } from './lib/authFlow'
// Pretendard는 CDN 대신 번들에 포함 (아티팩트 배포는 외부 CSS를 막음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
// S-Core Dream (본문 글, --font-text): 파일을 번들에 포함. 라이선스상 OTF 원본 그대로 (src/assets/fonts/README.md)
import './styles/fonts.css'
import './styles/global.css'

// 재배포 뒤 옛 탭: 새 버전 파일을 못 받으면 한 번만 새로고침 (docs/dev-deploy-risks.md D2)
installChunkReload()
// 401 → 로그인 화면으로 보낼 때 쓰는 이동 (lib/authFlow.ts. 라우터를 직접 import 하면 순환 참조)
registerNavigator((to, o) => { void router.navigate(to, o) })
// API 401 이 리프레시로도 안 풀리면 → lib/authFlow (지금은 LOGIN_FREE 라 기록만)
setUnauthorizedHandler(() => handleUnauthorized('api 401'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 00 공통 20: 휴대폰 · 태블릿이면 서비스 화면 대신 "PC에서 이용해 주세요" */}
    <DeviceGate>
      {/* 서버 데이터 캐시 (api/queryClient.ts). 목 모드에서도 같은 흐름 */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      <GpuNotice />
      <NetworkBanner />
      <LowLab />
    </DeviceGate>
  </StrictMode>,
)
