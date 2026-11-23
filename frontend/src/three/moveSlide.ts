import * as THREE from 'three'

/*
 * 이동 중에도 배경을 선명하게: 구운 그림 옮기기 (탐색 들판 저사양, docs/explore-move-quality.md)
 * 기본은 아래쪽 createGlSlide (WebGL 셰이더). 이 위쪽 createSlide(css 띠 밀기)는 시험용 ?slidemode=css 로만 씀 (앱 안에서 gl 보다 못했음)
 *
 * 가속 끈 크롬(WARP)에서 탐색 들판은 멈춰 있을 때만 1배 선명한 배경(sharpBake → 2D 캔버스)을 쓰고, 카메라가 움직이는 0.4초는
 * 들판 전체를 0.33배로 다시 그렸다(흐림). 여기서는 다시 그리지 않고 이미 구운 1배 그림을 옮겨 보여 준다.
 *
 * - 카메라 이동은 들판 바닥과 나란한 평행 이동(점프)과 화면 가로 밀기(패널, setViewOffset)뿐이고 회전·확대가 없다.
 *   이때 바닥 평면(높이 yRef)의 점은 "찍은 카메라 화면 → 지금 카메라 화면"이 호모그래피 하나로 정확히 옮겨지고,
 *   화면의 가로 행은 가로 행으로 간다 (카메라에 기울기(roll)가 없어서). 그래서 그림을 가로 띠 ns 개로 잘라
 *   띠마다 평행 이동 + 확대(가로·세로)를 주면 거의 정확하다 (띠 가운데 행은 정확, 띠 위아래 끝 오차 1px 안팎).
 * - 옮기는 일은 CSS transform → 화면 합성기가 함. 가속이 꺼진 크롬의 소프트웨어 합성기(한 스레드)는
 *   투영(matrix3d)·기울임(skew)이 들어가면 느린 길로 가서(2코어 띠 두 장 15~19fps) 축에 맞춘 평행 이동·확대만 씀(시험 42fps).
 *   다만 앱 안에서는 띠 캔버스 384개를 만들고 처음 합성하는 비용(2코어 첫 진입 +0.4초)과 합성기 두 장 비용(16스레드 37~42fps)이 있어
 *   gl 이 나았음 (explore/gpu/move/comp-bench.*, docs/explore-move-quality.md 3·5번)
 * - 칸 두 개: 0 = 떠나는 자리(지금 그림), 1 = 도착할 자리(미리 구운 그림). 이동 앞 절반은 0 을, 뒤 절반은 1 을 위에 둠.
 *   두 그림 다 덮지 못하는 곳(대각선 점프의 모서리 등)은 gaps() 로 알려 주고, 부르는 쪽이 WebGL 캔버스(위)에 3D 로 메움.
 *   그 메움이 선명한 띠를 가리지 않게 punch() 로 띠가 덮은 곳을 투명하게 뚫음
 * - 바닥보다 높은 것(풀 뭉치 0.24m·호박 0.47m·울타리 0.6m·사다리 1.1m)은 평면 가정 때문에 이동 중간에 조금 어긋남(시차).
 *   이동 끝(k = 1)과 처음(k = 0)에는 정확한 그림이라 멈춰 있을 때와 같음
 * - 움직이는 층(layer 1: 두더지·링·관심사 이펙트)은 굽지 않고 WebGL 로 계속 그림 (이 띠는 layer 0 그림만)
 */

export interface Slide {
  /** 칸에 그림을 넣음. img = 기기 픽셀 크기 그림(위가 0), cam = 그 그림을 찍은 카메라(복제본, 끝날 때까지 바꾸지 말 것) */
  load(slot: 0 | 1, img: CanvasImageSource, cam: THREE.PerspectiveCamera): void
  /** 그 칸에 그림이 있는지 */
  has(slot: 0 | 1): boolean
  /** 칸 비우기 (화면에서도 내림) */
  drop(slot?: 0 | 1): void
  /** 지금 카메라에 맞게 띠를 옮기고 보이게 함. top = 위에 둘 칸 */
  place(cam: THREE.PerspectiveCamera, top: 0 | 1): void
  /** 띠를 내림 (그림은 남겨 둠) */
  hide(): void
  /** 두 칸 다 덮지 못하는 곳: 화면 네 귀퉁이(사분면)마다 경계 상자 (CSS px, 위 = 0) + 화면 대비 비율. 없으면 빈 배열 */
  gaps(cam: THREE.PerspectiveCamera): { boxes: { x0: number; y0: number; x1: number; y1: number }[]; frac: number }
  /** 띠가 덮은 곳을 WebGL 캔버스에서 투명하게 (지금 그리기 대상에, place 다음에 부를 것) */
  punch(renderer: THREE.WebGLRenderer): void
  /** 구멍 뚫기 셰이더 컴파일을 걸어 둠 (예열 때. 기다리지 않음: WARP 에서 완료 확인을 돌리면 예열이 1초 넘게 늘었음) */
  prepare(renderer: THREE.WebGLRenderer): void
  /** 띠 캔버스를 미리 만들어 둠 (쉬는 동안. 첫 이동 때 384개를 만드느라 멈추지 않게) */
  prebuild(): void
  /** 크기 (CSS px). 바뀌면 그림을 비움 */
  size(w: number, h: number, dpr: number): void
  dispose(): void
}

/**
 * 띠 수. 띠 안에서는 한 행(가운데)만 정확: 좌우 이동은 아래 행일수록 더 밀려서(가까워서) 띠 위아래 끝이 ±(행마다 차이 × 띠 높이 / 2).
 * 6m 점프 중간(3m)에 1080px 화면이면 행마다 약 0.25px → 96 띠(약 10행)면 ±1.3px 로 대각선 길 가장자리에 계단이 보였음 →
 * 192 띠(약 5행) ±0.65px. 합성 비용은 띠 수와 거의 무관 (32 ↔ 64 띠 같은 fps, 넓이가 같아서)
 */
const NS = 192
/** 띠를 아래로 겹치는 행 수 (기기 픽셀). 아래 build() 설명 */
const OVERLAP = 3
/** punch 를 띠 가장자리에서 이만큼(CSS px) 안쪽으로: 메운 3D 가 띠 가장자리를 살짝 덮어 틈(바탕색)이 안 보이게 */
const INSET = 1.5

export function createSlide(container: HTMLElement, before: HTMLElement, o: { yRef: number; ns?: number }): Slide {
  const ns = o.ns ?? NS
  let W = 1, H = 1, dpr = 1
  type Strip = { cv: HTMLCanvasElement; v0: number; v1: number; h: number }
  type SlotS = { box: HTMLDivElement; strips: Strip[]; cam: THREE.PerspectiveCamera | null; shown: boolean; mats: number[][] }
  const mkSlot = (): SlotS => {
    const box = document.createElement('div')
    box.setAttribute('aria-hidden', 'true')
    box.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;display:none;contain:strict'
    container.insertBefore(box, before)
    return { box, strips: [], cam: null, shown: false, mats: [] }
  }
  const slots: [SlotS, SlotS] = [mkSlot(), mkSlot()]
  /** 지금 위에 있는 칸. 만들 때 0, 1 순서로 넣어서 처음엔 1 이 위 */
  let curTop: 0 | 1 = 1

  const build = (s: SlotS) => {
    s.strips.forEach((st) => st.cv.remove())
    s.strips = []
    const Hd = Math.max(1, Math.round(H * dpr)), Wd = Math.max(1, Math.round(W * dpr))
    for (let i = 0; i < ns; i++) {
      const r0 = Math.round(i * Hd / ns), r1 = Math.round((i + 1) * Hd / ns)
      if (r1 <= r0) continue
      // 아래로 OVERLAP 행 겹치게: 합성기가 띠 위아래 끝 한 줄을 반투명하게(가장자리 안티앨리어싱) 그려서, 1행만 겹치면
      // 그 틈으로 아래 칸(먼 자리에서 찍은 그림)이 가로 줄무늬로 비쳤음 (2026-11-17 이동 도중 화질 비교에서 발견)
      const rows = Math.min(Hd, r1 + OVERLAP) - r0
      const cv = document.createElement('canvas')
      cv.width = Wd; cv.height = rows
      cv.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${rows / dpr}px;transform-origin:0 0;display:block;will-change:transform`
      s.box.appendChild(cv)
      s.strips.push({ cv, v0: r0 / dpr, v1: r1 / dpr, h: rows / dpr })
    }
  }

  // 화면 점(CSS px) ↔ 바닥 평면
  const ndc = new THREE.Vector3(), dir = new THREE.Vector3(), g = new THREE.Vector3()
  /** 카메라 cam 의 화면 (u, v) 가 보는 바닥 점 (없으면 false) */
  const toGround = (cam: THREE.PerspectiveCamera, u: number, v: number, out: THREE.Vector3) => {
    ndc.set(u / W * 2 - 1, 1 - v / H * 2, 0.5).unproject(cam)
    dir.copy(ndc).sub(cam.position)
    if (dir.y > -1e-6) return false
    const t = (o.yRef - cam.position.y) / dir.y
    out.copy(cam.position).addScaledVector(dir, t)
    return true
  }
  const scr = { x: 0, y: 0 }
  const toScreen = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => {
    ndc.copy(p).project(cam)
    scr.x = (ndc.x + 1) / 2 * W; scr.y = (1 - ndc.y) / 2 * H
    return scr
  }
  /** 찍은 카메라 화면 점 → 지금 카메라 화면 점 */
  const map = (src: THREE.PerspectiveCamera, cur: THREE.PerspectiveCamera, u: number, v: number) => {
    if (!toGround(src, u, v, g)) return null
    const s = toScreen(cur, g)
    return { x: s.x, y: s.y }
  }

  const placeSlot = (s: SlotS, cur: THREE.PerspectiveCamera) => {
    const src = s.cam!
    s.mats = []
    for (const st of s.strips) {
      // 가로: 가운데 행의 양 끝 / 세로: 가운데 열의 위·아래 끝 (행은 행으로 가므로 기울임 없이 평행 이동 + 확대)
      const vm = (st.v0 + st.v1) / 2
      const L = map(src, cur, 0, vm), R = map(src, cur, W, vm)
      const T = map(src, cur, W / 2, st.v0), B = map(src, cur, W / 2, st.v1)
      if (!L || !R || !T || !B) { st.cv.style.visibility = 'hidden'; s.mats.push([]); continue }
      const hh = st.v1 - st.v0
      const a = (R.x - L.x) / W, d = (B.y - T.y) / hh
      const e = L.x, f = T.y
      st.cv.style.visibility = ''
      st.cv.style.transform = `translate3d(${e.toFixed(2)}px,${f.toFixed(2)}px,0) scale(${a.toFixed(5)},${d.toFixed(5)})`
      s.mats.push([a, d, e, f, hh])
    }
  }

  /** 그 카메라 화면 안인지 (가장자리 1px 여유: 화면 테두리 점이 반올림 때문에 밖으로 나와 늘 빈 곳으로 잡히던 것 막기) */
  const inside = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => {
    const s = toScreen(cam, p)
    return s.x >= -1 && s.x <= W + 1 && s.y >= -1 && s.y <= H + 1
  }

  // punch: 띠 평행사변형마다 투명으로 (깊이는 먼 곳으로 → 그 위 움직이는 층은 가려지지 않음)
  const maxQ = ns * 2
  const pos = new Float32Array(maxQ * 6 * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(0.0); gl_FragDepth = 1.0; }',
    blending: THREE.NoBlending, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, toneMapped: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  const pScene = new THREE.Scene(); pScene.add(mesh)
  const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  return {
    load(slot, img, cam) {
      const s = slots[slot]
      if (s.strips.length === 0) build(s)
      const Wd = Math.max(1, Math.round(W * dpr))
      for (const st of s.strips) {
        const ctx = st.cv.getContext('2d')
        if (!ctx) continue
        const r0 = Math.round(st.v0 * dpr)
        ctx.clearRect(0, 0, st.cv.width, st.cv.height)
        ctx.drawImage(img, 0, r0, Wd, st.cv.height, 0, 0, Wd, st.cv.height)
      }
      s.cam = cam
    },
    has: (slot) => !!slots[slot].cam,
    drop(slot) {
      for (const i of slot == null ? [0, 1] as const : [slot]) {
        const s = slots[i]
        s.cam = null; s.mats = []
        if (s.shown) { s.box.style.display = 'none'; s.shown = false }
      }
    },
    place(cam, top) {
      for (const i of [0, 1] as const) {
        const s = slots[i]
        if (!s.cam) { if (s.shown) { s.box.style.display = 'none'; s.shown = false } continue }
        placeSlot(s, cam)
        if (!s.shown) { s.box.style.display = ''; s.shown = true }
      }
      if (top !== curTop) {
        // 위에 둘 칸을 DOM 순서로 (WebGL 캔버스 바로 아래)
        container.insertBefore(slots[top].box, before)
        curTop = top
      }
    },
    hide() {
      for (const s of slots) if (s.shown) { s.box.style.display = 'none'; s.shown = false }
    },
    gaps(cam) {
      // 화면을 격자로 훑어(칸 가운데 + 테두리에서 2px 안쪽) 어느 칸에도 안 들어가는 점 → 사분면마다 경계 상자 (격자 한 칸만큼 넓힘).
      // 사분면으로 나누는 건 대각선 점프에서 빈 곳이 마주 보는 두 모서리에 생겨서 (상자 하나면 화면 전체가 됨)
      const step = 32
      const nx = Math.ceil(W / step), ny = Math.ceil(H / step)
      const box = [0, 1, 2, 3].map(() => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }))
      let miss = 0, all = 0
      const src = slots.filter((s) => s.cam).map((s) => s.cam!)
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = Math.min(W - 2, Math.max(2, i * step)), v = Math.min(H - 2, Math.max(2, j * step))
        all++
        let ok = false
        if (toGround(cam, u, v, g)) for (const sc of src) if (inside(sc, g)) { ok = true; break }
        if (ok) continue
        miss++
        const b = box[(v < H / 2 ? 0 : 2) + (u < W / 2 ? 0 : 1)]
        b.x0 = Math.min(b.x0, u - step); b.x1 = Math.max(b.x1, u + step); b.y0 = Math.min(b.y0, v - step); b.y1 = Math.max(b.y1, v + step)
      }
      const boxes = box.filter((b) => b.x1 > b.x0).map((b) => ({ x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(W, b.x1), y1: Math.min(H, b.y1) }))
      return { boxes, frac: miss / all }
    },
    punch(renderer) {
      let n = 0
      const put = (x: number, y: number) => { pos[n * 3] = x / W * 2 - 1; pos[n * 3 + 1] = 1 - y / H * 2; pos[n * 3 + 2] = 0; n++ }
      // 아래 칸부터 (겹쳐도 상관없음, 둘 다 투명)
      for (const s of slots) {
        if (!s.cam || !s.shown) continue
        const last = s.strips.length - 1
        s.mats.forEach((m, i) => {
          if (!m.length) return
          const [a, d, e, f, hh] = m
          // 띠가 덮은 사각형. 가로는 INSET 만큼 안쪽, 세로는 맨 위·맨 아래 띠만 안쪽
          const x0 = e + INSET, x1 = e + a * W - INSET
          const y0 = f + (i === 0 ? INSET : 0), y1 = f + d * hh - (i === last ? INSET : 0)
          if (x1 <= x0 || y1 <= y0) return
          put(x0, y0); put(x1, y0); put(x0, y1)
          put(x1, y0); put(x1, y1); put(x0, y1)
        })
      }
      if (!n) return
      geo.setDrawRange(0, n)
      ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
      const prevAuto = renderer.autoClear
      renderer.autoClear = false
      renderer.render(pScene, pCam)
      renderer.autoClear = prevAuto
    },
    prepare(renderer) { try { renderer.compile(pScene, pCam) } catch { /* 무시 */ } },
    prebuild() {
      for (const sl of slots) if (sl.strips.length === 0) { build(sl); for (const st of sl.strips) st.cv.getContext('2d') }
    },
    size(w, h, d) {
      if (w === W && h === H && d === dpr) return
      W = w; H = h; dpr = d
      for (const s of slots) { s.strips.forEach((st) => st.cv.remove()); s.strips = []; s.cam = null; s.mats = []; s.box.style.display = 'none'; s.shown = false }
    },
    dispose() {
      for (const s of slots) s.box.remove()
      geo.dispose(); mat.dispose()
    },
  }
}

/* ===================================================================================================
 * WebGL 로 옮기기 (강한 PC = 16스레드급, docs/explore-move-quality.md 3·4번)
 *
 * 띠 밀기(위)는 화면 합성기(한 스레드)가 띠 두 장을 매 프레임 옮겨 그려서 16스레드에서도 약 40~45fps 가 끝(예전 0.33배 다시 그리기는 62fps).
 * 그래서 이동하는 0.4초 동안만 WebGL 캔버스를 1배로 키우고, 두 그림을 텍스처로 올려 셰이더에서 바닥 평면 호모그래피로
 * 정확히 옮겨 그림(띠 계단 없음). 합성기는 캔버스 한 장만 (시험 16스레드 59fps). 2코어는 1배 캔버스를 매 프레임 합성기로
 * 읽어 오는 비용이 있지만 앱 안에서 재 보니 띠 밀기보다 나아서(26 ↔ 25fps, 첫 진입은 띠 밀기가 0.4초 늦음) 이것이 기본 (holeField wantGl)
 * =================================================================================================== */

export interface GlSlide {
  /** 칸에 그림을 넣음. ver = 그 캔버스 내용 판(바뀌었으면 텍스처를 다시 올림, 지금 바로 → 이동 중에 멈추지 않게) */
  load(slot: 0 | 1, cv: HTMLCanvasElement, cam: THREE.PerspectiveCamera, ver: number): void
  has(slot: 0 | 1): boolean
  drop(slot?: 0 | 1): void
  /** 지금 그리기 대상에 두 그림을 옮겨 그림 (top 칸 먼저, 못 덮는 곳은 다른 칸, 둘 다 못 덮으면 그리지 않음). 깊이는 먼 곳으로 */
  draw(renderer: THREE.WebGLRenderer, cam: THREE.PerspectiveCamera, top: 0 | 1): void
  /** 두 칸 다 못 덮는 곳 (Slide.gaps 와 같음) */
  gaps(cam: THREE.PerspectiveCamera): { boxes: { x0: number; y0: number; x1: number; y1: number }[]; frac: number }
  size(w: number, h: number): void
  prepare(renderer: THREE.WebGLRenderer): void
  dispose(): void
}

/** 네 점 짝 (x, y) → (X, Y) 의 호모그래피 (행 우선 9개, h8 = 1) */
function solveHomography(src: number[][], dst: number[][]): number[] | null {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [X, Y] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X])
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y])
  }
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-12) return null
    const tmp = A[c]; A[c] = A[p]; A[p] = tmp
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1]
}

export function createGlSlide(o: { yRef: number }): GlSlide {
  let W = 1, H = 1
  const ndc = new THREE.Vector3(), dir = new THREE.Vector3(), g = new THREE.Vector3()
  const toGround = (cam: THREE.PerspectiveCamera, u: number, v: number, out: THREE.Vector3) => {
    ndc.set(u / W * 2 - 1, 1 - v / H * 2, 0.5).unproject(cam)
    dir.copy(ndc).sub(cam.position)
    if (dir.y > -1e-6) return false
    out.copy(cam.position).addScaledVector(dir, (o.yRef - cam.position.y) / dir.y)
    return true
  }
  const toScreen = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => {
    ndc.copy(p).project(cam)
    return [(ndc.x + 1) / 2 * W, (1 - ndc.y) / 2 * H]
  }
  type SlotG = { tex: THREE.Texture | null; cam: THREE.PerspectiveCamera | null }
  const slots: [SlotG, SlotG] = [{ tex: null, cam: null }, { tex: null, cam: null }]
  /** 캔버스마다 텍스처 하나 (두 캔버스가 역할을 바꿔도 다시 올리지 않게) */
  const texOf = new Map<HTMLCanvasElement, { tex: THREE.Texture; ver: number }>()
  let renderer: THREE.WebGLRenderer | null = null

  const mat = new THREE.ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, hA: { value: new THREE.Matrix3() }, hB: { value: new THREE.Matrix3() }, hasA: { value: 0 }, hasB: { value: 0 }, topB: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tA; uniform sampler2D tB; uniform mat3 hA; uniform mat3 hB; uniform int hasA; uniform int hasB; uniform int topB;
      varying vec2 vUv;
      vec4 at(sampler2D t, mat3 h) {
        vec3 q = h * vec3(vUv, 1.0);
        vec2 u = q.xy / q.z;
        if (q.z <= 0.0 || u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) return vec4(0.0);
        return vec4(texture2D(t, u).rgb, 1.0);
      }
      void main() {
        vec4 a = hasA == 1 ? at(tA, hA) : vec4(0.0);
        vec4 b = hasB == 1 ? at(tB, hB) : vec4(0.0);
        vec4 c = topB == 1 ? (b.a > 0.0 ? b : a) : (a.a > 0.0 ? a : b);
        if (c.a == 0.0) discard;
        gl_FragColor = c;
        gl_FragDepth = 1.0;
      }`,
    depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, toneMapped: false, blending: THREE.NoBlending,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const qScene = new THREE.Scene(); qScene.add(quad)
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  /** 지금 화면 uv(위가 1) → 찍은 그림 uv 호모그래피 */
  const homography = (src: THREE.PerspectiveCamera, cur: THREE.PerspectiveCamera, out: THREE.Matrix3) => {
    const s: number[][] = [], d: number[][] = []
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (!toGround(cur, u * W, (1 - v) * H, g)) return false
      const [x, y] = toScreen(src, g)
      s.push([u, v]); d.push([x / W, 1 - y / H])
    }
    const h = solveHomography(s, d)
    if (!h) return false
    out.set(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8])
    return true
  }
  return {
    load(slot, cv, cam, ver) {
      let t = texOf.get(cv)
      if (!t) {
        const tex = new THREE.Texture(cv)
        tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter
        tex.colorSpace = THREE.NoColorSpace // 이미 화면 색(sRGB) 값 그대로
        t = { tex, ver: -1 }
        texOf.set(cv, t)
      }
      if (t.ver !== ver) { t.tex.needsUpdate = true; t.ver = ver; renderer?.initTexture(t.tex) } // 지금 올림 (첫 이동 프레임에서 멈추지 않게)
      slots[slot].tex = t.tex; slots[slot].cam = cam
    },
    has: (slot) => !!slots[slot].cam,
    drop(slot) { for (const i of slot == null ? [0, 1] as const : [slot]) { slots[i].cam = null; slots[i].tex = null } },
    draw(r, cam, top) {
      const u = mat.uniforms
      u.hasA.value = slots[0].cam && homography(slots[0].cam, cam, u.hA.value) ? 1 : 0
      u.hasB.value = slots[1].cam && homography(slots[1].cam, cam, u.hB.value) ? 1 : 0
      u.tA.value = slots[0].tex ?? slots[1].tex; u.tB.value = slots[1].tex ?? slots[0].tex
      u.topB.value = top
      const prev = r.autoClear
      r.autoClear = false
      r.render(qScene, qCam)
      r.autoClear = prev
    },
    gaps(cam) {
      const step = 32
      const nx = Math.ceil(W / step), ny = Math.ceil(H / step)
      const box = [0, 1, 2, 3].map(() => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }))
      let miss = 0, all = 0
      const src = slots.filter((s) => s.cam).map((s) => s.cam!)
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = Math.min(W - 2, Math.max(2, i * step)), v = Math.min(H - 2, Math.max(2, j * step))
        all++
        let ok = false
        if (toGround(cam, u, v, g)) for (const sc of src) { const [x, y] = toScreen(sc, g); if (x >= -1 && x <= W + 1 && y >= -1 && y <= H + 1) { ok = true; break } }
        if (ok) continue
        miss++
        const b = box[(v < H / 2 ? 0 : 2) + (u < W / 2 ? 0 : 1)]
        b.x0 = Math.min(b.x0, u - step); b.x1 = Math.max(b.x1, u + step); b.y0 = Math.min(b.y0, v - step); b.y1 = Math.max(b.y1, v + step)
      }
      const boxes = box.filter((b) => b.x1 > b.x0).map((b) => ({ x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(W, b.x1), y1: Math.min(H, b.y1) }))
      return { boxes, frac: miss / all }
    },
    size(w, h) {
      if (w === W && h === H) return
      W = w; H = h
      slots[0].cam = null; slots[1].cam = null
    },
    prepare(r) { renderer = r; try { r.compile(qScene, qCam) } catch { /* 무시 */ } }, // 기다리지 않음 (Slide.prepare 설명)
    dispose() {
      texOf.forEach((t) => t.tex.dispose()); texOf.clear()
      quad.geometry.dispose(); mat.dispose()
    },
  }
}
