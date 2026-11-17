import { lazy, Suspense, type ReactNode } from 'react'
import type { FieldHandle, FieldSceneOptions } from '../three/fieldScene'
import { stillFor, stillStyle } from '../three/stills'
import styles from './RoomView.module.css'
import SceneBoundary from './SceneBoundary'

const FieldCanvas = lazy(() => import('../three/FieldCanvas'))

/**
 * 탐색하기 밭 3D (src/three/fieldScene.ts). Figma "탐색하기" 화면의 땅 위 장면.
 * 땅을 누르면 두더지가 그 자리로 걸어간다. 3D 준비 전(예열 중)·WebGL 이 없을 때는 같은 구도의 고해상도 정지 그림 (three/stills.ts,
 * docs/rendering-experiments-3.md 5번. 그 전에는 하늘·풀빛 그라데이션). 3D 는 예열이 끝나면 그 위로 0.35초에 나타남
 * options·onReady: 탐색하기의 굴 이동(굴 나오기·들어가기)과 줌 (docs/field-move.md)
 */
export default function FieldView({ focusX = 0.5, children, label, options, onReady, paused }: {
  /** 장면 가운데가 놓일 가로 위치 (0–1) */
  focusX?: number
  children?: ReactNode
  label?: string
  options?: Omit<FieldSceneOptions, 'focusX'>
  onReady?: (handle: FieldHandle) => void
  /** 안 보이는 동안 그리기 멈춤 (랜딩에서 투명하게 숨긴 층) */
  paused?: boolean
}) {
  const still = stillFor('landing')
  return (
    <div className={`${styles.scene} ${styles.field}`}>
      <img src={still.src} alt="" aria-hidden draggable={false} style={stillStyle(still, focusX)} />
      {/* 3D 를 못 만들면 3D 자리만 비우고 위 정지 그림이 그대로 보임 (SceneBoundary) */}
      <SceneBoundary>
        <Suspense fallback={null}>
          <FieldCanvas focusX={focusX} className={styles.canvas} label={label ?? '두더지가 사는 밭'} options={options} onReady={onReady} paused={paused} />
        </Suspense>
      </SceneBoundary>
      {children}
    </div>
  )
}
