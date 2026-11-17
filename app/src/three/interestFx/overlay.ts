import type * as THREE from 'three'
import { quality } from '../engine'
import { prefersReducedMotion } from '../../lib/a11y'

/*
 * 관심사 이펙트를 그리는 2D 캔버스 (WebGL 캔버스 바로 위, 클릭은 통과). docs/interest-effects.md "그리는 방식"
 *
 * 왜 3D 장면(layer 1)이 아니라 2D 겹 캔버스인가:
 * - 저사양(가속 꺼짐)에서 땅굴·들판은 배경을 한 번 구워 두고 두더지 둘레 사각형만 다시 그림(scissor). 움직이는 층에 입자를 넣으면
 *   그 사각형이 방 전체로 커지고, 루프가 쉬지 못해(busy) 늘 CPU 를 씀. 겹 캔버스는 3D 루프·배경 굽기·부분 그리기와 상관이 없음
 * - 해상도도 3D(0.55배)와 따로라 아이콘·글자가 선명함
 * - 3D 좌표는 그대로 씀: 매 프레임 카메라 행렬로 화면 위치를 계산 (방 돌리기·확대·들판 점프를 따라감)
 * 단점: 두더지가 이펙트 앞을 지나가도 가리지 않음 (이펙트가 늘 위). 작은 입자라 눈에 거의 안 띔
 *
 * 기기 단계별 (lib/deviceTier.ts, engine quality):
 * - full (GPU): 매 rAF, 기기 배율 최대 1.5, 입자 최대 160, 들판 움직이는 구멍 12개
 * - lite (가속 꺼짐 · 16스레드급): 20fps, 배율 1, 입자 최대 48, 움직이는 구멍 5개, 땅굴 선반 소품은 입자 없음
 * - still (가속 꺼짐 · 2코어급, 또는 움직임 줄이기): 움직임 없이 아이콘·고리만. 카메라가 바뀌거나 켜고 끌 때만 다시 그림
 */
export interface FxMode {
  level: 'full' | 'lite' | 'still'
  /** 최대 fps (0 = rAF 그대로) */
  fps: number
  dpr: number
  maxParticles: number
  /** 탐색 들판: 움직이는(연기·통통) 구멍 수 */
  active: number
  reduce: boolean
  /** 패널에 보일 설명 */
  label: string
}

export function fxMode(): FxMode {
  const q = quality()
  const reduce = prefersReducedMotion()
  const forced = (() => { try { return (location.search + location.hash).match(/[?&]fxmode=(full|lite|still)\b/)?.[1] ?? null } catch { return null } })()
  const level: FxMode['level'] = (forced as FxMode['level'] | null) ?? (reduce ? 'still' : q.level === 'high' ? 'full' : q.tier === 'weak' ? 'still' : 'lite')
  if (level === 'full') return { level, fps: 0, dpr: Math.min(window.devicePixelRatio || 1, 1.5), maxParticles: 160, active: 12, reduce, label: 'GPU · 모든 이펙트가 움직여요' }
  if (level === 'lite') return { level, fps: 20, dpr: 1, maxParticles: 48, active: 5, reduce, label: '그래픽 가속 꺼짐 · 가까운 것만 20fps로 움직여요' }
  return { level, fps: 6, dpr: 1, maxParticles: 0, active: 0, reduce, label: reduce ? '움직임 줄이기 설정 · 움직임 없이 아이콘만 보여요' : '아주 느린 PC · 움직임 없이 아이콘만 보여요' }
}

export interface OverlayFrame { ctx: CanvasRenderingContext2D; W: number; H: number; dt: number; t: number }

export interface Overlay {
  readonly mode: FxMode
  /** 다음 프레임에 다시 그림 (still 이어도) */
  invalidate(): void
  dispose(): void
}

/**
 * after(WebGL 캔버스) 바로 뒤에 겹 캔버스를 붙이고 루프를 돌림.
 * draw 는 CSS 픽셀 좌표로 그림 (배율은 여기서 맞춤). animating() 이 거짓이고 카메라가 그대로면 다시 그리지 않음
 */
export function createOverlay(container: HTMLElement, after: Element, camera: THREE.Camera, draw: (f: OverlayFrame) => void, animating: () => boolean): Overlay {
  const mode = fxMode()
  const cv = document.createElement('canvas')
  cv.setAttribute('aria-hidden', 'true')
  cv.dataset.fx = 'interest'
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
  after.after(cv)
  const ctx = cv.getContext('2d')!
  let W = 0, H = 0, alive = true, dirty = true, raf = 0, last = performance.now(), t = 0
  const sizeUp = () => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h || (w === W && h === H)) return
    W = w; H = h
    cv.width = Math.round(w * mode.dpr); cv.height = Math.round(h * mode.dpr)
    dirty = true
  }
  const ro = new ResizeObserver(sizeUp)
  ro.observe(container)
  sizeUp()
  // 카메라가 바뀌었는지 (지난 그림의 행렬과 비교)
  const prevCam = new Float32Array(32)
  const camChanged = () => {
    const a = (camera as THREE.PerspectiveCamera).matrixWorldInverse.elements, b = (camera as THREE.PerspectiveCamera).projectionMatrix.elements
    let ch = false
    for (let i = 0; i < 16; i++) {
      if (Math.abs(prevCam[i] - a[i]) > 1e-5) { prevCam[i] = a[i]; ch = true }
      if (Math.abs(prevCam[16 + i] - b[i]) > 1e-5) { prevCam[16 + i] = b[i]; ch = true }
    }
    return ch
  }
  const w = window as unknown as { __fxFrames?: number }
  const tick = (now: number) => {
    if (!alive) return
    raf = requestAnimationFrame(tick)
    const gap = mode.fps ? 1000 / mode.fps - 3 : 0
    if (now - last < gap) return
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
    last = now
    const moved = camChanged()
    const anim = mode.level !== 'still' && animating()
    if (!anim && !moved && !dirty) return
    dirty = false
    t += dt
    if (!W || !H) return
    ctx.setTransform(mode.dpr, 0, 0, mode.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    draw({ ctx, W, H, dt: mode.level === 'still' ? 0 : dt, t })
    w.__fxFrames = (w.__fxFrames ?? 0) + 1 // 측정용
  }
  raf = requestAnimationFrame(tick)
  return {
    mode,
    invalidate() { dirty = true },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.width = cv.height = 0
      cv.remove()
    },
  }
}
