import SceneCanvas from './SceneCanvas'
import { mountFieldScene, type FieldHandle, type FieldSceneOptions } from './fieldScene'

/** 탐색하기 밭 3D (FieldView 가 React.lazy 로 불러옴) */
export default function FieldCanvas({ focusX, className, label, onReady, options }: {
  focusX: number
  className?: string
  label?: string
  onReady?: (handle: FieldHandle) => void
  /** 굴 id·시작 굴·줌 (장면을 만들 때 한 번 읽음) */
  options?: Omit<FieldSceneOptions, 'focusX'>
}) {
  return (
    <SceneCanvas
      deps="field"
      mount={(el, fx) => mountFieldScene(el, { ...options, focusX: fx })}
      focusX={focusX}
      className={className}
      label={label}
      onReady={onReady ? (h) => onReady(h as FieldHandle) : undefined}
    />
  )
}
