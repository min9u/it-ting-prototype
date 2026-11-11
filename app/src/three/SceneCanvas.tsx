import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SceneHandle } from './engine'
import { quality } from './engine'
import { labVersion, subscribeLab } from '../lib/lowLab'

/**
 * three.js 장면을 담는 div. mount 함수가 이 안에 캔버스를 만들어 붙이고, 언마운트 때 모두 정리한다.
 * StrictMode에서 effect가 두 번 돌아도 첫 번째 렌더러는 dispose + forceContextLoss 로 바로 반납됨.
 * 저사양 실험실(lib/lowLab.ts) 선택이 바뀌면 장면을 새로 만든다.
 * - G 3D 창 작게: 저사양일 때 장면 div 를 화면 가운데 액자로 줄임 (그릴 픽셀이 약 절반)
 * - H 가볍게 보기: 저사양일 때 버튼으로 3D 그리기를 멈춤
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
  const ver = useSyncExternalStore(subscribeLab, labVersion)
  const q = quality()
  const lab = q.level === 'low' ? q.lab : null
  const [frozen, setFrozen] = useState(false)

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
    setFrozen(false)
    latest.current.onReady?.(h)
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [deps, ver])

  useEffect(() => { handle.current?.setFocusX(focusX) }, [focusX])

  const small = !!lab?.G
  const style = small
    ? { inset: '9% 14% 16%', width: 'auto', height: 'auto', borderRadius: 28, overflow: 'hidden', boxShadow: '0 0 0 6px rgba(251,244,236,.55), 0 18px 40px rgba(60,35,20,.25)' }
    : undefined

  return (
    <div ref={ref} className={className} style={style} role="img" aria-label={label}>
      {lab?.H && (
        <button
          type="button"
          onClick={() => { const on = !frozen; setFrozen(on); handle.current?.setFrozen?.(on) }}
          style={{
            position: 'absolute', left: 12, top: 12, zIndex: 6, padding: '8px 12px', borderRadius: 999,
            border: 0, font: '600 13px/1 Pretendard, system-ui, sans-serif', cursor: 'pointer',
            background: frozen ? '#c8643a' : 'rgba(62,42,31,.82)', color: '#fbf4ec', boxShadow: '0 3px 10px rgba(60,35,20,.25)',
          }}
          aria-pressed={frozen}
        >
          {frozen ? '▶ 다시 움직이기' : '⏸ 가볍게 보기'}
        </button>
      )}
    </div>
  )
}
