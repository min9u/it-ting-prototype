import { useRef } from 'react'
import SceneCanvas from './SceneCanvas'
import { mountHoleField, type HoleFieldEvents, type HoleFieldHandle } from './holeField'
import { stillFor } from './stills'

/**
 * 탐색 들판 3D (ExploreBurrow 가 React.lazy 로 불러옴).
 * deps(들판 id)가 바뀌면 장면을 새로 만든다. 이벤트는 ref 로 늘 최신 함수를 부름
 */
export default function HoleFieldCanvas({ fieldKey, occupied, zones, mySeat, startSeat, worn, focusX, events, onReady, className, label }: {
  fieldKey: string
  occupied: number[]
  zones: number
  mySeat: number | null
  startSeat: number
  worn: string[]
  focusX: number
  events: HoleFieldEvents
  onReady?: (h: HoleFieldHandle) => void
  className?: string
  label?: string
}) {
  const ev = useRef(events)
  ev.current = events
  const init = useRef({ occupied, zones, mySeat, startSeat, worn })
  init.current = { occupied, zones, mySeat, startSeat, worn }
  return (
    <SceneCanvas
      deps={fieldKey}
      mount={(el, fx) => mountHoleField(el, {
        focusX: fx, ...init.current,
        events: {
          onStand: (s) => ev.current.onStand?.(s),
          onMove: (a, b) => ev.current.onMove?.(a, b),
          onHover: (s, x, y) => ev.current.onHover?.(s, x, y),
          onLadder: () => ev.current.onLadder?.(),
          onAnchor: (x, y, v) => ev.current.onAnchor?.(x, y, v),
        },
      })}
      focusX={focusX}
      className={className}
      label={label}
      onReady={(h) => onReady?.(h as HoleFieldHandle)}
      fallback={stillFor('field')}
    />
  )
}
