import { useEffect, useRef } from 'react'
import type { SceneHandle } from './engine'

/**
 * three.js 장면을 담는 div. mount 함수가 이 안에 캔버스를 만들어 붙이고, 언마운트 때 모두 정리한다.
 * StrictMode에서 effect가 두 번 돌아도 첫 번째 렌더러는 dispose + forceContextLoss 로 바로 반납됨.
 */
export default function SceneCanvas({ mount, deps, focusX, className, label, onReady }: {
  mount: (el: HTMLElement, focusX: number) => SceneHandle
  /** 이 값이 바뀌면 장면을 새로 만든다 (예: 방 주인 id) */
  deps: string
  focusX: number
  className?: string
  label?: string
  onReady?: (handle: SceneHandle) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const latest = useRef({ mount, focusX, onReady })
  latest.current = { mount, focusX, onReady }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let h: SceneHandle
    try {
      h = latest.current.mount(el, latest.current.focusX)
    } catch (err) {
      // WebGL을 못 쓰는 환경: 자리표시 이미지를 그대로 둔다
      console.warn('[3D] 장면을 만들지 못했어요', err)
      return
    }
    handle.current = h
    latest.current.onReady?.(h)
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [deps])

  useEffect(() => { handle.current?.setFocusX(focusX) }, [focusX])

  return <div ref={ref} className={className} role="img" aria-label={label} />
}
