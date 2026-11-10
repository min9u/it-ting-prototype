import SceneCanvas from './SceneCanvas'
import { mountRoomScene } from './roomScene'

/** 땅굴 방 3D (RoomView 가 React.lazy 로 불러옴 → three.js 는 별도 청크) */
export default function RoomCanvas({ ownerId, interests, focusX, className, label, onReady }: {
  ownerId: string
  interests?: string[]
  focusX: number
  className?: string
  label?: string
  onReady?: () => void
}) {
  return (
    <SceneCanvas
      deps={`${ownerId}|${(interests ?? []).join(',')}`}
      mount={(el, fx) => mountRoomScene(el, { ownerId, interests, focusX: fx })}
      focusX={focusX}
      className={className}
      label={label}
      onReady={onReady}
    />
  )
}
