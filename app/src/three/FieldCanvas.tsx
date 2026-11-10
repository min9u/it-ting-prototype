import SceneCanvas from './SceneCanvas'
import { mountFieldScene } from './fieldScene'

/** 탐색하기 밭 3D (FieldView 가 React.lazy 로 불러옴) */
export default function FieldCanvas({ focusX, className, label, onReady }: {
  focusX: number
  className?: string
  label?: string
  onReady?: () => void
}) {
  return (
    <SceneCanvas
      deps="field"
      mount={(el, fx) => mountFieldScene(el, { focusX: fx })}
      focusX={focusX}
      className={className}
      label={label}
      onReady={onReady}
    />
  )
}
