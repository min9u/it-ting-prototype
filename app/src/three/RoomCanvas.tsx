import SceneCanvas from './SceneCanvas'
import { mountRoomScene } from './roomScene'
import type { SceneHandle } from './engine'

/** 땅굴 방 3D (RoomView 가 React.lazy 로 불러옴 → three.js 는 별도 청크) */
export default function RoomCanvas({ ownerId, interests, hostName, focusX, className, label, onReady }: {
  ownerId: string
  /** 남의 땅굴이면 집주인 닉네임 (집주인 두더지가 나옴) */
  hostName?: string
  interests?: string[]
  focusX: number
  className?: string
  label?: string
  onReady?: (handle: SceneHandle) => void
}) {
  return (
    <SceneCanvas
      deps={`${ownerId}|${hostName ?? ''}|${(interests ?? []).join(',')}`}
      mount={(el, fx) => mountRoomScene(el, { ownerId, interests, hostName, focusX: fx })}
      focusX={focusX}
      className={className}
      label={label}
      onReady={onReady}
    />
  )
}
