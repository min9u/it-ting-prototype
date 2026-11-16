import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import GpuNotice from './components/GpuNotice'
import LowLab from './components/LowLab'
import DeviceGate from './components/DeviceGate'
import NetworkBanner from './components/NetworkBanner'
import { installChunkReload } from './lib/chunkReload'
import { registerNavigator } from './lib/authFlow'
// Pretendard는 CDN 대신 번들에 포함 (아티팩트 배포는 외부 CSS를 막음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/global.css'

// 재배포 뒤 옛 탭: 새 버전 파일을 못 받으면 한 번만 새로고침 (docs/dev-deploy-risks.md D2)
installChunkReload()
// 401 → 로그인 화면으로 보낼 때 쓰는 이동 (lib/authFlow.ts. 라우터를 직접 import 하면 순환 참조)
registerNavigator((to, o) => { void router.navigate(to, o) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 00 공통 20: 휴대폰 · 태블릿이면 서비스 화면 대신 "PC에서 이용해 주세요" */}
    <DeviceGate>
      <RouterProvider router={router} />
      <GpuNotice />
      <NetworkBanner />
      <LowLab />
    </DeviceGate>
  </StrictMode>,
)
