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
 * - full (GPU): 30fps (카메라가 움직이는 동안은 매 rAF 로 장면과 같이), 기기 배율 최대 1.5, 입자 최대 160, 들판 움직이는 구멍 12개.
 *   (2026-11-17 측정: 매 rAF 60fps 로 그리면 가만히 있는 탐색에서 렌더러 CPU 15 → 29%, GPU 프로세스 21 → 51% 라 입자는 30fps 로 충분)
 * - lite (가속 꺼짐 · 16스레드급): 20fps, 배율 1, 입자 최대 48, 움직이는 구멍 5개, 땅굴 선반 소품은 입자 없음.
 *   마우스·키·카메라가 8초 동안 가만히 있으면 쉼(calm): 새 입자를 안 만들고 남은 것이 사라지면 멈춘 그림 하나로 그치고 다시 그리지 않음
 *   (2026-11-17 측정: 쉬지 않으면 겹 캔버스를 20fps 로 합성하느라 WARP 의 GPU 프로세스 CPU 가 가만히 있어도 크게 늘었음. 3D 루프의 idleStop 과 같은 생각)
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
  /** 이 초 동안 입력·카메라 변화가 없으면 쉼 (0 = 안 쉼) */
  restAfter: number
}

export function fxMode(): FxMode {
  const q = quality()
  const reduce = prefersReducedMotion()
  const forced = (() => { try { return (location.search + location.hash).match(/[?&]fxmode=(full|lite|still)\b/)?.[1] ?? null } catch { return null } })()
  const level: FxMode['level'] = (forced as FxMode['level'] | null) ?? (reduce ? 'still' : q.level === 'high' ? 'full' : q.tier === 'weak' ? 'still' : 'lite')
  if (level === 'full') return { level, fps: 30, dpr: Math.min(window.devicePixelRatio || 1, 1.5), maxParticles: 160, active: 12, reduce, label: 'GPU · 모든 이펙트가 움직여요', restAfter: 0 }
  if (level === 'lite') return { level, fps: 20, dpr: 1, maxParticles: 48, active: 5, reduce, label: '그래픽 가속 꺼짐 · 가까운 것만 20fps로, 가만히 있으면 쉬어요', restAfter: 8 }
  return { level, fps: 6, dpr: 1, maxParticles: 0, active: 0, reduce, label: reduce ? '움직임 줄이기 설정 · 움직임 없이 아이콘만 보여요' : '아주 느린 PC · 움직임 없이 아이콘만 보여요', restAfter: 0 }
}

export interface OverlayFrame {
  ctx: CanvasRenderingContext2D; W: number; H: number; dt: number; t: number
  /** 쉬는 중 (lite 에서 한동안 가만히 있음): 새 입자를 만들지 말고 맥박·통통은 멈춘 모습으로 */
  calm: boolean
}

export interface Overlay {
  readonly mode: FxMode
  /** 다음 프레임에 다시 그림 (still 이어도). 깨움 (가속 꺼짐 쉬기를 8초 미룸) */
  invalidate(): void
  /** 다시 그리기만 하고 깨우지는 않음 (정해 둔 시각에 사라질 것을 지울 때. 깨우면 쉬기가 그만큼 늦어졌음, 2차) */
  refresh(): void
  /** 겹 캔버스를 통째로 숨김/보임 (합성에서도 빠짐). 바뀔 때만 스타일을 건드림 */
  setHidden(on: boolean): void
  dispose(): void
}

/**
 * after(WebGL 캔버스) 바로 뒤에 겹 캔버스를 붙이고 루프를 돌림.
 * draw 는 CSS 픽셀 좌표로 그림 (배율은 여기서 맞춤). animating() 이 거짓이고 카메라가 그대로면 다시 그리지 않음
 */
export function createOverlay(container: HTMLElement, after: Element, camera: THREE.Camera, draw: (f: OverlayFrame) => void, animating: (calm: boolean) => boolean): Overlay {
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
  // 쉬기 (mode.restAfter): 장면 위 입력·키·카메라 변화·켜고 끄기에 깨어남
  let awakeUntil = performance.now() + mode.restAfter * 1000
  const wake = () => { awakeUntil = performance.now() + mode.restAfter * 1000 }
  const onInput = () => wake()
  if (mode.restAfter) {
    container.addEventListener('pointermove', onInput, { passive: true })
    container.addEventListener('pointerdown', onInput, { passive: true })
    container.addEventListener('wheel', onInput, { passive: true })
    window.addEventListener('keydown', onInput)
  }
  let wasAnim = false
  /** lite: 카메라가 움직이는 동안 비워 둠 (들판 점프 0.4초·방 돌리기). 3D 가 가장 무거운 순간에 겹 캔버스 그리기·합성을 쉬게 */
  let hiddenForMove = false
  /** setHidden 으로 통째로 숨김 */
  let hiddenAll = false
  const tick = (now: number) => {
    if (!alive) return
    raf = requestAnimationFrame(tick)
    const moved = camChanged()
    // fps 제한. 단 GPU(full)는 카메라가 움직이는 프레임이면 바로 (말풍선·이정표가 장면을 늦게 따라가 보이지 않게)
    const gap = mode.fps && !(moved && mode.level === 'full') ? 1000 / mode.fps - 3 : 0
    if (now - last < gap || hiddenAll) { if (moved) dirty = true; return }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
    last = now
    if (moved) wake()
    if (mode.level === 'lite') {
      // 지우기만 한 번 (style.visibility 를 바꾸면 3차 측정에서 점프 fps 가 더 떨어졌음: 스타일 다시 계산·층 다시 올리기)
      if (moved) { if (!hiddenForMove) { hiddenForMove = true; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height) } return }
      if (hiddenForMove) { hiddenForMove = false; dirty = true }
    }
    const calm = mode.level === 'still' || (mode.restAfter > 0 && now > awakeUntil)
    const anim = mode.level !== 'still' && animating(calm)
    // 움직이다 멈추는 순간 한 번 더 그려서 마지막 그림이 멈춘 모습이 되게
    const settle = wasAnim && !anim
    wasAnim = anim
    if (!anim && !moved && !dirty && !settle) return
    dirty = false
    t += dt
    if (!W || !H) return
    ctx.setTransform(mode.dpr, 0, 0, mode.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    draw({ ctx, W, H, dt: mode.level === 'still' ? 0 : dt, t, calm })
    w.__fxFrames = (w.__fxFrames ?? 0) + 1 // 측정용
  }
  raf = requestAnimationFrame(tick)
  return {
    mode,
    invalidate() { dirty = true; wake() },
    refresh() { dirty = true },
    setHidden(on) {
      if (on === hiddenAll) return
      hiddenAll = on
      cv.style.display = on ? 'none' : 'block'
      if (!on) dirty = true
    },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      container.removeEventListener('pointermove', onInput)
      container.removeEventListener('pointerdown', onInput)
      container.removeEventListener('wheel', onInput)
      window.removeEventListener('keydown', onInput)
      cv.width = cv.height = 0
      cv.remove()
    },
  }
}
