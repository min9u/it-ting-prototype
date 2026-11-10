import { lazy, Suspense, type ReactNode } from 'react'
import styles from './RoomView.module.css'

const FieldCanvas = lazy(() => import('../three/FieldCanvas'))

/**
 * 탐색하기 밭 3D (src/three/fieldScene.ts). Figma "탐색하기" 화면의 땅 위 장면.
 * 땅을 누르면 두더지가 그 자리로 걸어간다. 3D 준비 전에는 하늘·풀빛 그라데이션.
 */
export default function FieldView({ focusX = 0.5, children, label }: {
  /** 장면 가운데가 놓일 가로 위치 (0–1) */
  focusX?: number
  children?: ReactNode
  label?: string
}) {
  return (
    <div className={`${styles.scene} ${styles.field}`}>
      <Suspense fallback={null}>
        <FieldCanvas focusX={focusX} className={styles.canvas} label={label ?? '두더지가 사는 밭'} />
      </Suspense>
      {children}
    </div>
  )
}
