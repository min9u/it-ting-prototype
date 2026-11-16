import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import GpuNotice from './components/GpuNotice'
import LowLab from './components/LowLab'
import DeviceGate from './components/DeviceGate'
// Pretendard는 CDN 대신 번들에 포함 (아티팩트 배포는 외부 CSS를 막음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 00 공통 20: 휴대폰 · 태블릿이면 서비스 화면 대신 "PC에서 이용해 주세요" */}
    <DeviceGate>
      <RouterProvider router={router} />
      <GpuNotice />
      <LowLab />
    </DeviceGate>
  </StrictMode>,
)
