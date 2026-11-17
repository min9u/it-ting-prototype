import * as THREE from 'three'

/*
 * 이동 중에도 배경을 선명하게: 구운 그림을 띠로 잘라 "밀기" (탐색 들판 저사양, docs/explore-move-quality.md)
 *
 * 가속 끈 크롬(WARP)에서 탐색 들판은 멈춰 있을 때만 1배 선명한 배경(sharpBake → 2D 캔버스)을 쓰고, 카메라가 움직이는 0.4초는
 * 들판 전체를 0.33배로 다시 그렸다(흐림). 여기서는 다시 그리지 않고 이미 구운 1배 그림을 옮겨 보여 준다.
 *
 * - 카메라 이동은 들판 바닥과 나란한 평행 이동(점프)과 화면 가로 밀기(패널, setViewOffset)뿐이고 회전·확대가 없다.
 *   이때 바닥 평면(높이 yRef)의 점은 "찍은 카메라 화면 → 지금 카메라 화면"이 호모그래피 하나로 정확히 옮겨지고,
 *   화면의 가로 행은 가로 행으로 간다 (카메라에 기울기(roll)가 없어서). 그래서 그림을 가로 띠 ns 개로 잘라
 *   띠마다 평행 이동 + 확대(가로·세로)를 주면 거의 정확하다 (띠 가운데 행은 정확, 띠 위아래 끝 오차 1px 안팎).
 * - 옮기는 일은 CSS transform → 화면 합성기가 함. 가속이 꺼진 크롬의 소프트웨어 합성기(한 스레드)는
 *   투영(matrix3d)·기울임(skew)이 들어가면 느린 길로 가서(2코어 띠 두 장 15~19fps) 축에 맞춘 평행 이동·확대만 씀(42fps).
 *   WebGL 캔버스를 1배로 키워 셰이더로 옮기면 2코어에서 1배 캔버스를 매 프레임 합성기로 읽어 오는 비용 때문에 26fps 라 버림
 *   (explore/gpu/move/comp-bench.*, docs/explore-move-quality.md 2번)
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
  /** 두 칸 다 덮지 못하는 곳: 위·아래 절반마다 경계 상자 (CSS px, 위 = 0) + 화면 대비 비율. 없으면 빈 배열 */
  gaps(cam: THREE.PerspectiveCamera): { boxes: { x0: number; y0: number; x1: number; y1: number }[]; frac: number }
  /** 띠가 덮은 곳을 WebGL 캔버스에서 투명하게 (지금 그리기 대상에, place 다음에 부를 것) */
  punch(renderer: THREE.WebGLRenderer): void
  /** 구멍 뚫기 셰이더 미리 컴파일 (예열 때, 첫 이동에서 멈추지 않게) */
  prepare(renderer: THREE.WebGLRenderer): Promise<void>
  /** 크기 (CSS px). 바뀌면 그림을 비움 */
  size(w: number, h: number, dpr: number): void
  dispose(): void
}

/**
 * 띠 수. 띠 안에서는 한 행(가운데)만 정확: 좌우 이동은 아래 행일수록 더 밀려서(가까워서) 띠 위아래 끝이 ±(행마다 차이 × 띠 높이 / 2).
 * 6m 점프 중간(3m)에 1080px 화면이면 행마다 약 0.25px → 96 띠(약 10행)면 ±1.3px
 */
const NS = 96
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
  let curTop: 0 | 1 = 0

  const build = (s: SlotS) => {
    s.strips.forEach((st) => st.cv.remove())
    s.strips = []
    const Hd = Math.max(1, Math.round(H * dpr)), Wd = Math.max(1, Math.round(W * dpr))
    for (let i = 0; i < ns; i++) {
      const r0 = Math.round(i * Hd / ns), r1 = Math.round((i + 1) * Hd / ns)
      if (r1 <= r0) continue
      // 아래로 1행 겹치게 (띠 사이 틈 방지)
      const rows = Math.min(Hd, r1 + 1) - r0
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

  const inside = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => {
    const s = toScreen(cam, p)
    return s.x >= 0.5 && s.x <= W - 0.5 && s.y >= 0.5 && s.y <= H - 0.5
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
      // 화면을 격자로 훑어 어느 칸에도 안 들어가는 점 → 위·아래 절반마다 경계 상자 (격자 한 칸만큼 넓힘)
      const step = 32
      const nx = Math.ceil(W / step), ny = Math.ceil(H / step)
      const box = [{ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }]
      let miss = 0, all = 0
      const src = slots.filter((s) => s.cam).map((s) => s.cam!)
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = Math.min(W, i * step), v = Math.min(H, j * step)
        all++
        let ok = false
        if (toGround(cam, u, v, g)) for (const sc of src) if (inside(sc, g)) { ok = true; break }
        if (ok) continue
        miss++
        const b = box[v < H / 2 ? 0 : 1]
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
    async prepare(renderer) { await renderer.compileAsync(pScene, pCam).catch(() => {}) },
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
