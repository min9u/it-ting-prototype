import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SceneHandle } from './engine'
import { quality } from './engine'
import { labVersion, subscribeLab } from '../lib/lowLab'
import { SceneErrorContext } from '../components/SceneBoundary'

/** WebGL 컨텍스트를 잃었을 때 다시 만들어 보는 횟수 (그래픽 드라이버 재시작·탭이 오래 숨겨짐 등) */
const MAX_RESTORE = 2

/**
 * three.js 장면을 담는 div. mount 함수가 이 안에 캔버스를 만들어 붙이고, 언마운트 때 모두 정리한다.
 * StrictMode에서 effect가 두 번 돌아도 첫 번째 렌더러는 dispose + forceContextLoss 로 바로 반납됨.
 * 저사양 실험실(lib/lowLab.ts) 선택이 바뀌면 장면을 새로 만든다.
 * - G 3D 창 작게: 저사양일 때 장면 div 를 화면 가운데 액자로 줄임 (그릴 픽셀이 약 절반)
 * - H 가볍게 보기: 저사양일 때 버튼으로 3D 그리기를 멈춤
 */
export default function SceneCanvas({ mount, deps, focusX, className, label, onReady, overlay }: {
  mount: (el: HTMLElement, focusX: number) => SceneHandle
  /** 이 값이 바뀌면 장면을 새로 만든다 (예: 방 주인 id) */
  deps: string
  focusX: number
  className?: string
  label?: string
  onReady?: (handle: SceneHandle) => void
  /**
   * 장면 위에 겹치는 UI (예: 집주인 머리 위 말풍선). 장면 div 와 같은 자리·크기의 형제 div 에 넣음
   * (G 액자로 줄어도 같이 따라감, role="img" 밖이라 버튼이 접근성 트리에 남음). 바탕은 클릭이 통과함
   */
  overlay?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const latest = useRef({ mount, focusX, onReady })
  latest.current = { mount, focusX, onReady }
  const ver = useSyncExternalStore(subscribeLab, labVersion)
  const q = quality()
  const lab = q.level === 'low' ? q.lab : null
  const [frozen, setFrozen] = useState(false)
  const small = !!lab?.G
  // G 일 때는 액자를 focusX 자리에 두고 장면은 액자 가운데(0.5)에 그림
  const sceneFx = small ? 0.5 : focusX
  latest.current.focusX = sceneFx
  // 3D 에러 경계(components/SceneBoundary)에 실패 알리기 → 화면이 2D 대체 그림으로
  const reportError = useContext(SceneErrorContext)
  const reportRef = useRef(reportError)
  reportRef.current = reportError
  // WebGL 컨텍스트를 잃으면 장면을 새로 만듦 (restore 가 늘어나면 effect 가 다시 돎)
  const [restore, setRestore] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let h: SceneHandle
    try {
      h = latest.current.mount(el, latest.current.focusX)
    } catch (err) {
      // WebGL을 못 쓰는 환경: 자리표시 이미지를 그대로 둔다 (경계 안이면 경계가 2D 로 바꿈)
      if (reportRef.current) reportRef.current(err)
      else console.warn('[3D] 장면을 만들지 못했어요', err)
      return
    }
    handle.current = h
    setFrozen(false)
    latest.current.onReady?.(h)
    // 도중에 컨텍스트를 잃음 (드라이버 재시작·GPU 메모리 부족·탭이 오래 숨겨짐): 1.5초 안에 돌아오지 않으면 장면을 새로 만듦.
    // 우리가 정리할 때 부르는 forceContextLoss 도 이 이벤트를 내므로 정리 전에 듣기를 끔
    const canvases = Array.from(el.querySelectorAll('canvas')) // 저사양 '선명한 방'은 2D 캔버스도 있음 → 모두 들음 (2D 는 이벤트가 안 옴)
    let lostTimer: ReturnType<typeof setTimeout> | undefined
    const onLost = (e: Event) => {
      e.preventDefault() // 브라우저가 되살려 줄 수 있게
      console.warn('[3D] WebGL 컨텍스트를 잃었어요')
      lostTimer = setTimeout(() => {
        if (restore < MAX_RESTORE) setRestore((n) => n + 1)
        else reportRef.current?.(new Error('WebGL 컨텍스트를 되살리지 못했어요'))
      }, 1500)
    }
    const onRestored = () => { clearTimeout(lostTimer); setRestore((n) => n + 1) }
    canvases.forEach((c) => { c.addEventListener('webglcontextlost', onLost); c.addEventListener('webglcontextrestored', onRestored) })
    return () => {
      clearTimeout(lostTimer)
      canvases.forEach((c) => { c.removeEventListener('webglcontextlost', onLost); c.removeEventListener('webglcontextrestored', onRestored) })
      h.dispose()
      handle.current = null
    }
  }, [deps, ver, restore])

  useEffect(() => { handle.current?.setFocusX(sceneFx) }, [sceneFx])

  const style = small
    ? { inset: 'auto', top: '9%', bottom: '16%', left: `calc(${focusX * 100}% - 36%)`, width: '72%', height: 'auto', borderRadius: 28, overflow: 'hidden', transition: 'left .45s', boxShadow: '0 0 0 6px rgba(251,244,236,.55), 0 18px 40px rgba(60,35,20,.25)' }
    : undefined

  const overlayStyle = {
    position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
    ...(small ? { inset: 'auto', top: '9%', bottom: '16%', left: `calc(${focusX * 100}% - 36%)`, width: '72%', transition: 'left .45s' } : null),
  } as const

  return (
    <>
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
    {overlay != null && <div style={overlayStyle}>{overlay}</div>}
    </>
  )
}
