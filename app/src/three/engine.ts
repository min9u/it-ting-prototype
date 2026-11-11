import * as THREE from 'three'

/** 각 장면이 React 쪽에 돌려주는 손잡이 */
export interface SceneHandle {
  /** 렌더러·지오메트리·텍스처·캔버스까지 모두 정리 */
  dispose(): void
  /** 컨테이너 크기가 바뀌었을 때 (ResizeObserver가 알아서 부르지만 수동으로도 가능) */
  resize(): void
  /** 장면 가운데가 놓일 가로 위치 (0–1). 오른쪽 패널이 열리면 왼쪽으로 치우친다 */
  setFocusX(x: number): void
  /** 두더지 리액션 (땅굴 장면만) */
  react?(kind: 'greet' | 'look' | 'scratch' | 'drink'): void
  /** 내 두더지 액세서리 갈아 끼우기 (땅굴 장면만) */
  setWorn?(ids: string[]): void
}

/**
 * 렌더러를 만들어 container 안에 캔버스를 붙인다.
 * 캔버스를 매번 새로 만드는 이유: React StrictMode가 effect를 두 번 돌릴 때
 * 같은 캔버스에 forceContextLoss() 뒤 다시 붙으면 잃어버린 컨텍스트를 그대로 받게 됨.
 */
export function createRenderer(container: HTMLElement, o: { alpha?: boolean; exposure: number; shadowType: THREE.ShadowMapType }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!o.alpha, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = o.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = o.shadowType
  if (o.alpha) renderer.setClearColor(0x000000, 0)
  const el = renderer.domElement
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none'
  container.appendChild(el)
  return renderer
}

/** 렌더러와 캔버스를 정리. 컨텍스트도 바로 돌려줘서 재마운트 때 WebGL 컨텍스트가 쌓이지 않게 */
export function destroyRenderer(renderer: THREE.WebGLRenderer) {
  renderer.dispose()
  renderer.forceContextLoss()
  renderer.domElement.remove()
}

/** 장면 안의 지오메트리·재질·텍스처·그림자 맵을 모두 해제 */
export function disposeObject(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>()
  const mats = new Set<THREE.Material>()
  const texs = new Set<THREE.Texture>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) geos.add(m.geometry)
    if (m.material) ([] as THREE.Material[]).concat(m.material).forEach((x) => mats.add(x))
    if (o instanceof THREE.InstancedMesh) o.dispose()
    const light = o as THREE.DirectionalLight
    if (light.isLight && light.shadow) light.shadow.dispose()
  })
  for (const m of mats) {
    for (const v of Object.values(m)) if (v instanceof THREE.Texture) texs.add(v)
    m.dispose()
  }
  if (root instanceof THREE.Scene) {
    if (root.background instanceof THREE.Texture) texs.add(root.background)
    if (root.environment) texs.add(root.environment)
  }
  geos.forEach((g) => g.dispose())
  texs.forEach((t) => t.dispose())
}

/**
 * 카메라 구도 맞추기: "가상 화면"(box, 캔버스 픽셀 좌표)에 장면 전체가 들어가도록 하고
 * 실제 캔버스는 그중 한 부분만 보여 준다. box를 옮기면 장면이 좌우로 밀린다 (focusX).
 */
export function frameCamera(cam: THREE.PerspectiveCamera, W: number, H: number, box: { left: number; top: number; w: number; h: number }) {
  cam.aspect = box.w / box.h
  cam.setViewOffset(box.w, box.h, -box.left, -box.top, W, H)
}

/**
 * requestAnimationFrame 루프. 마운트하자마자 첫 프레임은 동기로 그린다
 * (헤드리스 브라우저에서는 rAF가 거의 안 돌아서). 탭이 숨으면 멈춘다.
 */
export function startLoop(container: HTMLElement, cb: { resize(w: number, h: number): void; frame(dt: number, t: number): void }) {
  let raf = 0, last = 0, t = 0, running = false, alive = true
  const doResize = () => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return false
    cb.resize(w, h)
    return true
  }
  const tick = (now: number) => {
    if (!running) return
    raf = requestAnimationFrame(tick)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    t += dt
    cb.frame(dt, t)
  }
  const play = () => {
    if (running || !alive || document.hidden) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
  const pause = () => { running = false; cancelAnimationFrame(raf) }
  const onVis = () => (document.hidden ? pause() : play())
  const ro = new ResizeObserver(() => { if (alive && doResize()) cb.frame(0, t) })
  ro.observe(container)
  document.addEventListener('visibilitychange', onVis)
  if (doResize()) cb.frame(0, 0) // 첫 프레임 동기 렌더
  play()
  return {
    resize() { if (doResize()) cb.frame(0, t) },
    /** 다음 프레임에서 바로 다시 그리도록 (루프가 멈춰 있어도) */
    redraw() { cb.frame(0, t) },
    stop() {
      alive = false
      pause()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}

/** focusX를 CSS transition(.45s)처럼 부드럽게 따라가게 */
export function approach(cur: number, target: number, dt: number, tau = 0.12) {
  if (Math.abs(target - cur) < 1e-4) return target
  return cur + (target - cur) * (1 - Math.exp(-dt / tau))
}
