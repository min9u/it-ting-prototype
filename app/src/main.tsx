import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './App'
import { queryClient } from './api/queryClient'
import { setUnauthorizedHandler } from './api/client'
import { setAuthState } from './data/auth'
import GpuNotice from './components/GpuNotice'
import LowLab from './components/LowLab'
import DeviceGate from './components/DeviceGate'
// Pretendard는 CDN 대신 번들에 포함 (아티팩트 배포는 외부 CSS를 막음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/global.css'

// 401 이 리프레시로도 안 풀리면: 비로그인으로 바꾸고 로그인 화면으로 (돌아올 주소는 state.from, Guards.tsx 와 같은 방식)
setUnauthorizedHandler(() => {
  const { pathname, search } = router.state.location
  if (pathname === '/login') return
  setAuthState('guest')
  void router.navigate('/login', { replace: true, state: { from: `${pathname}${search}` } })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 00 공통 20: 휴대폰 · 태블릿이면 서비스 화면 대신 "PC에서 이용해 주세요" */}
    <DeviceGate>
      {/* 서버 데이터 캐시 (api/queryClient.ts). 목 모드에서도 같은 흐름 */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      <GpuNotice />
      <LowLab />
    </DeviceGate>
  </StrictMode>,
)
