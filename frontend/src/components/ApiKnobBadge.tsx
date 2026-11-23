import { useLocation } from '@/lib/nav'
import { activeKnobs, ANY_MOCK, clearKnobs } from '../api/config'
import s from './AsyncState.module.css'

/*
 * 실험실 전용 (docs/nextjs-migration.md "실험실"): src/labs/index.ts 를 거쳐서만 불러옴 → NEXT_PUBLIC_LABS 가 꺼진 빌드에는 안 들어감.
 * Vite 앱에서는 components/AsyncState.tsx 안에 있던 것
 */

/** ?api=… 손잡이가 켜져 있으면 왼쪽 아래에 작게 (스크린샷·시연 때 켜진 줄 알 수 있게). ✕ 로 끔 */
export default function ApiKnobBadge() {
  // 주소(해시 포함)가 바뀌면 다시 읽음 — 해시 라우터는 ?api= 를 붙여도 새로고침되지 않음
  useLocation()
  if (!ANY_MOCK) return null
  const knobs = [...activeKnobs()]
  if (!knobs.length) return null
  const off = () => {
    clearKnobs()
    const url = new URL(window.location.href)
    url.searchParams.delete('api')
    url.hash = url.hash.replace(/([?&])api=[^&]*&?/, '$1').replace(/[?&]$/, '')
    window.location.replace(url.toString())
  }
  return (
    <div className={s.knob} role="note">
      <span>목 서버 · {knobs.join(', ')}</span>
      <button type="button" onClick={off} aria-label="목 서버 손잡이 끄기">✕</button>
    </div>
  )
}
