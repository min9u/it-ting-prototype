import * as THREE from 'three'
import { graphicsTier } from '../lib/graphicsTier'
import { getLab, type LabState } from '../lib/lowLab'

/*
 * 품질 묶음 (docs/gpu-fallback-research.md "결정" 2번).
 * - high: GPU. 원래 품질 그대로 (해상도 기기 배율 최대 2, 안티앨리어싱, 그림자, 후처리, fps 제한 없음, 계속 그림)
 * - low: 그래픽 가속이 꺼져 CPU로 그리는 PC(WARP·SwiftShader). 해상도 0.55배를 CSS로 늘림, 안티앨리어싱·그림자·후처리 끔,
 *   움직일 때 15fps 제한, 가만히 1초 지나면 그리기를 멈춤 (메인 스레드가 놀아서 버튼·스크롤이 정상)
 * - 'gpu'로 감지돼도 처음 2초 평균 프레임 시간이 50ms를 넘으면 low로 내리고, 이 탭에서는 계속 low (startLoop)
 */
export interface Quality {
  level: 'high' | 'low'
  /** renderer.setPixelRatio 값 (CSS 픽셀당 그리는 픽셀 수) */
  pixelRatio: number
  antialias: boolean
  /** 실시간 그림자 맵 (끄면 장면이 발밑 그림자 판으로 대신) */
  shadows: boolean
  /** EffectComposer 후처리 (N8AO·색보정) */
  post: boolean
  /** 움직이는 동안 최대 fps (0 = 제한 없음) */
  maxFps: number
  /** 바쁜 일이 없고 입력이 없으면 루프를 멈춤 */
  idleStop: boolean
  /** 멈추기 전에 기다리는 시간 (초) */
  idleAfter: number
  /** 저사양 실험실 선택 (low 일 때만 의미 있음, docs/gpu-lowspec-ideas.md) */
  lab: LabState | null
  /** I 가끔 숨쉬기: 쉬는 중 이 간격(초)마다 breatheFor 초 동안 깨움 (0 = 안 함) */
  breatheEvery: number
  breatheFor: number
}

const HIGH = (): Quality => ({ level: 'high', pixelRatio: Math.min(window.devicePixelRatio || 1, 2), antialias: true, shadows: true, post: true, maxFps: 0, idleStop: false, idleAfter: 1, lab: null, breatheEvery: 0, breatheFor: 0 })
const LOW = (): Quality => {
  const lab = getLab()
  return {
    level: 'low', pixelRatio: 0.55, antialias: false, shadows: false, post: false,
    // B 스톱모션: 15fps 대신 lab.fps (기본 10)
    maxFps: lab.B ? lab.fps : 15,
    idleStop: true, idleAfter: 1, lab,
    // I 가끔 숨쉬기: 4초마다 1.2초 깨움 (숨쉬기·깜빡임이 보일 만큼)
    breatheEvery: lab.I ? 4 : 0, breatheFor: 1.2,
  }
}

/** 자동으로 내렸는지 (탭이 살아 있는 동안 기억 → 다음 장면도 처음부터 low) */
let downgraded = false
const AUTO_AVG_MS = 50, AUTO_SKIP_MS = 500, AUTO_WINDOW_MS = 2000

/** 장면마다 새 객체를 받음 (자동으로 내릴 때 그 장면의 객체를 low 값으로 덮어씀) */
export function quality(): Quality {
  const q = graphicsTier() === 'software' || downgraded ? LOW() : HIGH()
  const f = testParam('maxfps')
  if (f !== null) q.maxFps = +f
  return q
}

/** 측정용 주소 손잡이 (?maxfps=0 → fps 제한 없음, ?partial=0 → 땅굴 부분 그리기 끔) */
export function testParam(name: string): string | null {
  try { return (location.search + location.hash).match(new RegExp(`[?&]${name}=(\\w+)`))?.[1] ?? null } catch { return null }
}

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
  /** H 가볍게 보기: 3D 그리기 멈춤/다시 */
  setFrozen?(on: boolean): void
  /** 모델을 다 받고 첫 그림을 그린 뒤 풀림 (땅굴 장면만. 못 불러와도 풀림) */
  loaded?: Promise<void>
  /**
   * 집주인 두더지 머리 위 화면 위치 알림 (남의 땅굴만). 장면 컨테이너 기준 px, null = 숨김
   * (집주인이 안 보임·입장 연출 중·집주인 리액션 말풍선이 떠 있음). 바뀔 때만 부름, 등록하면 지금 값을 바로 한 번 부름
   */
  onHostScreen?(cb: ((p: HostScreen | null) => void) | null): void
}

/** 집주인 두더지 머리 꼭대기의 화면 위치 (장면 컨테이너 기준 px) */
export interface HostScreen { x: number; y: number }

/**
 * 렌더러를 만들어 container 안에 캔버스를 붙인다.
 * 캔버스를 매번 새로 만드는 이유: React StrictMode가 effect를 두 번 돌릴 때
 * 같은 캔버스에 forceContextLoss() 뒤 다시 붙으면 잃어버린 컨텍스트를 그대로 받게 됨.
 */
export function createRenderer(container: HTMLElement, o: { alpha?: boolean; exposure: number; shadowType: THREE.ShadowMapType; quality: Quality; preserve?: boolean; canvas?: OffscreenCanvas }) {
  const q = o.quality
  // preserve: 지난 프레임 그림을 남겨 둠 (땅굴 저사양의 부분 그리기용)
  // canvas: D 시험판에서 Worker 가 넘겨받은 OffscreenCanvas (three 는 HTMLCanvasElement 처럼 씀)
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas as unknown as HTMLCanvasElement | undefined, antialias: q.antialias, alpha: !!o.alpha, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.preserve })
  renderer.setPixelRatio(q.pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = o.exposure
  renderer.shadowMap.enabled = q.shadows
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

export interface LoopCallbacks {
  resize(w: number, h: number): void
  frame(dt: number, t: number): void
  /** 지금 움직이는 게 있는지 (두더지 동작·떨어지기·줌·카메라 감속 등). 없으면 idleStop 일 때 루프가 멈춤 */
  busy?(): boolean
  /** 자동으로 low 로 내려갔을 때 (q 는 이미 low 값). 해상도·후처리·그림자를 바로 바꿀 것 */
  downgrade?(q: Quality): void
}

/**
 * requestAnimationFrame 루프. 마운트하자마자 첫 프레임은 동기로 그린다
 * (헤드리스 브라우저에서는 rAF가 거의 안 돌아서). 탭이 숨으면 멈춘다.
 * - q.maxFps: 그 간격보다 빨리 온 rAF는 건너뜀 (사이 시간에 메인 스레드가 입력·UI를 처리)
 * - q.idleStop: busy() 가 거짓이고 입력이 없는 상태가 q.idleAfter 초 지나면 멈춤.
 *   캔버스 위 누르기·끌기·휠, wake() 호출(키 조종·리액션·액세서리·focusX), 크기 변경, 탭 다시 보임에 다시 시작
 * - high 품질이면 ready() 뒤 2초 평균 프레임 간격을 재서 50ms가 넘으면 low 로 내림 (cb.downgrade)
 */
export function startLoop(container: HTMLElement, cb: LoopCallbacks, q: Quality) {
  let raf = 0, last = 0, t = 0, running = false, alive = true
  let awakeUntil = 0
  // H 가볍게 보기: 얼리면 깨우지 않음. I 숨쉬기 타이머
  let frozen = false, breathTimer = 0
  // 자동 내리기 측정: ready() 시각, 지난 rAF 시각, 모은 간격 합·개수
  let probeFrom = -1, probePrev = 0, probeSum = 0, probeN = 0
  const doResize = () => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return false
    cb.resize(w, h)
    return true
  }
  const probe = (now: number) => {
    if (probeFrom < 0 || q.level !== 'high' || !cb.downgrade) return
    if (now - probeFrom < AUTO_SKIP_MS) { probePrev = now; return } // 셰이더 컴파일·텍스처 올리기 구간은 뺌
    if (probePrev) { probeSum += now - probePrev; probeN++ }
    probePrev = now
    if (probeSum < AUTO_WINDOW_MS) return
    const avg = probeSum / probeN
    probeFrom = -1
    if (avg > AUTO_AVG_MS) {
      downgraded = true
      Object.assign(q, LOW())
      console.info(`[3D] 프레임이 느려서(평균 ${avg.toFixed(0)}ms) 저사양 모드로 바꿔요`)
      cb.downgrade(q)
      doResize()
    }
  }
  const tick = (now: number) => {
    if (!running) return
    raf = requestAnimationFrame(tick)
    probe(now)
    if (q.maxFps && now - last < 1000 / q.maxFps - 4) return // fps 제한 (rAF 간격 흔들림 4ms 여유)
    // rAF 의 now(프레임 시작 시각)는 play() 때 잰 performance.now() 보다 이를 수 있음 → 음수 dt 막기.
    // (음수가 들어가면 가구 낙하 타이머가 0 → 음수로 가서 다시 안 돌고, 가구가 숨은 채로 남았음. 2026-11-12 온보딩 → 내 땅굴)
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.1)
    last = now
    t += dt
    cb.frame(dt, t)
    countFrame()
    if (q.idleStop) {
      if (cb.busy?.()) awakeUntil = Math.max(awakeUntil, now + q.idleAfter * 1000)
      else if (now > awakeUntil) pause()
    }
  }
  const play = () => {
    if (running || !alive || document.hidden || frozen) return
    running = true
    last = performance.now()
    probePrev = 0
    raf = requestAnimationFrame(tick)
  }
  const pause = () => {
    running = false; cancelAnimationFrame(raf)
    // I 가끔 숨쉬기: 쉬는 동안 breatheEvery 초마다 breatheFor 초만 다시 그림
    clearTimeout(breathTimer)
    if (q.breatheEvery > 0 && alive && !frozen && !document.hidden) {
      breathTimer = window.setTimeout(() => {
        if (!alive || frozen || running) return
        awakeUntil = performance.now() + q.breatheFor * 1000
        play()
      }, q.breatheEvery * 1000)
    }
  }
  const wake = () => {
    if (!alive) return
    awakeUntil = Math.max(awakeUntil, performance.now() + q.idleAfter * 1000)
    play()
  }
  const onVis = () => (document.hidden ? pause() : wake())
  const ro = new ResizeObserver(() => { if (alive && doResize()) { cb.frame(0, t); wake() } })
  ro.observe(container)
  document.addEventListener('visibilitychange', onVis)
  // 캔버스 위 입력 → 다시 그리기. 마우스를 그냥 움직이는 것은 끌 때(버튼 누름)만
  const onPointer = (e: PointerEvent) => { if (e.type !== 'pointermove' || e.buttons) wake() }
  container.addEventListener('pointerdown', onPointer)
  container.addEventListener('pointermove', onPointer)
  container.addEventListener('pointerup', onPointer)
  container.addEventListener('wheel', wake, { passive: true })
  if (doResize()) cb.frame(0, 0) // 첫 프레임 동기 렌더
  wake()
  return {
    resize() { if (doResize()) { cb.frame(0, t); wake() } },
    /** 지금 한 번 그림 (루프가 멈춰 있어도) */
    redraw() { cb.frame(0, t) },
    /** 루프를 다시 돌림 (idleStop 이면 idleAfter 초 동안은 바쁘지 않아도 그림) */
    wake,
    /** 루프가 돌고 있는지 */
    isRunning: () => running,
    /** H 가볍게 보기: true 면 지금 그림에서 멈추고 입력이 와도 다시 그리지 않음 */
    setFrozen(on: boolean) {
      frozen = on
      if (on) { running = false; cancelAnimationFrame(raf); clearTimeout(breathTimer) } else wake()
    },
    isFrozen: () => frozen,
    /** 장면이 다 불러와졌을 때. 이때부터 자동 내리기용 프레임 시간을 잼 */
    ready() { probeFrom = performance.now(); probePrev = 0; probeSum = 0; probeN = 0; cb.frame(0, t); wake() },
    stop() {
      alive = false
      pause()
      clearTimeout(breathTimer)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      container.removeEventListener('pointerdown', onPointer)
      container.removeEventListener('pointermove', onPointer)
      container.removeEventListener('pointerup', onPointer)
      container.removeEventListener('wheel', wake)
    },
  }
}

/** 측정용: 장면을 실제로 그린 횟수 (explore/gpu/cdp-move.mjs 가 읽음) */
function countFrame() { const w = window as unknown as { __sceneFrames?: number }; w.__sceneFrames = (w.__sceneFrames ?? 0) + 1 }

/** focusX를 CSS transition(.45s)처럼 부드럽게 따라가게 */
export function approach(cur: number, target: number, dt: number, tau = 0.12) {
  if (Math.abs(target - cur) < 1e-4) return target
  return cur + (target - cur) * (1 - Math.exp(-dt / tau))
}
