import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { add, at, clay, cyl, group, box, sph, roomNoise } from './clay'
import { furnishRoom } from './furniture'
import { bindMoleKeys } from './mole'
import { createMoleActor, loadMoleGltf, REACTIONS, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { gradientEnv, ROOM_ENV } from './lighting'
import { roomGradePass } from './post'
import { approach, createRenderer, destroyRenderer, disposeObject, frameCamera, startLoop, type SceneHandle } from './engine'

/*
 * 땅굴 방 장면. explore/3d/room.html 을 옮김 (비교 UI·OrbitControls 는 뺌).
 * 구도: 4:3 "가상 화면"이 장면 높이의 106.5%, 위에서 1% 내려와 있고 가로 가운데가 focusX.
 * (Figma 내 땅굴 화면과 비교해서 돔 꼭대기·두더지 발 높이를 맞춤)
 */

export interface RoomSceneOptions {
  ownerId?: string
  interests?: string[]
  focusX?: number
  /** 남의 땅굴이면 집주인 닉네임. 집주인 두더지가 방에 서 있음 */
  hostName?: string
  hostWorn?: string[]
  /** 내 두더지 액세서리 */
  worn?: string[]
}

const R = 6.4, DH = 8.6 // 돔 반지름, 높이
const prof = (y: number) => R * Math.pow(Math.max(0, 1 - Math.pow(y / DH, 2.1)), 0.52)
function profilePts(scale = 1, n = 64) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) { const y = DH * scale * (i / n); pts.push(new THREE.Vector2(prof(y / scale) * scale, y)) }
  return pts
}
const WALL = '#e6b092', WALL_D = '#b8744c', RIB = '#d49a74', WOOD = '#d09a70'

/** 땅굴 껍데기: 돔 안·밖, 단면 테두리, 갈비뼈 기둥, 판벽, 바닥 */
function buildShell(scene: THREE.Object3D) {
  const inner = new THREE.Mesh(new THREE.LatheGeometry(profilePts(1), 72, Math.PI / 2, Math.PI), clay(WALL, { side: THREE.DoubleSide, bumpScale: 0.9 }))
  inner.receiveShadow = true; scene.add(inner)
  const outer = new THREE.Mesh(new THREE.LatheGeometry(profilePts(1.075), 72, Math.PI / 2, Math.PI), clay(WALL_D, { side: THREE.DoubleSide }))
  scene.add(outer)
  // 단면 테두리 (z=0 평면에서 안·밖 사이)
  {
    const s = new THREE.Shape(), o = profilePts(1.075, 64), i = profilePts(1, 64)
    s.moveTo(-o[0].x, 0)
    for (const p of o) s.lineTo(-p.x, p.y)
    for (let k = o.length - 1; k >= 0; k--) s.lineTo(o[k].x, o[k].y)
    for (const p of i) s.lineTo(p.x, p.y)
    for (let k = i.length - 1; k >= 0; k--) s.lineTo(-i[k].x, i[k].y)
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 1 }), clay('#dc946c'))
    rim.position.z = -0.07; add(rim, scene)
  }
  // 갈비뼈 기둥
  const ribAt = (phi: number, rad = 0.13, hex = RIB) => {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 48; k++) { const y = DH * 0.985 * k / 48, r = prof(y) - 0.06; pts.push(new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi))) }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, rad, 10), clay(hex)), scene)
  }
  ;[Math.PI * 0.72, Math.PI, Math.PI * 1.28].forEach((p) => ribAt(p))
  // 꼭대기 고리 + 가운데 막대
  add(at(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.14, 12, 32), clay(RIB)), 0, DH - 0.35, -0.2), scene).rotation.x = Math.PI / 2
  cyl(scene, 0.035, 0.035, 2.2, '#efe2d0', 0, DH - 2.6, -0.5, 8)

  // 아래쪽 나무 판벽 (반원 띠)
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#c98559'; g.fillRect(0, 0, 1024, 64)
    for (let x = 0; x < 1024; x += 16) { g.fillStyle = 'rgba(90,40,20,.28)'; g.fillRect(x, 0, 2, 64) }
    g.fillStyle = 'rgba(255,220,190,.25)'; g.fillRect(0, 0, 1024, 5)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.12, R - 0.1, 1.25, 72, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.DoubleSide }))
    band.position.y = 0.62; band.receiveShadow = true; scene.add(band)
    const cap = new THREE.Mesh(new THREE.TorusGeometry(R - 0.14, 0.07, 8, 72, Math.PI), clay('#b8704a'))
    cap.rotation.x = Math.PI / 2; cap.rotation.z = Math.PI; cap.position.y = 1.25; add(cap, scene)
  }

  // 바닥: 원판 + 마루 무늬
  {
    const c = document.createElement('canvas'); c.width = c.height = 1024
    const g = c.getContext('2d')!
    g.fillStyle = WOOD; g.fillRect(0, 0, 1024, 1024)
    const rowH = 64
    for (let y = 0; y < 1024; y += rowH) {
      g.fillStyle = 'rgba(110,50,25,.30)'; g.fillRect(0, y, 1024, 3)
      let x = (y / rowH % 2) * 150 - 80
      while (x < 1024) { const w = 220 + Math.random() * 160; g.fillRect(x, y, 3, rowH); g.fillStyle = `rgba(255,${200 + Math.random() * 30},170,${Math.random() * .08})`; g.fillRect(x + 3, y + 3, w - 3, rowH - 3); g.fillStyle = 'rgba(110,50,25,.30)'; x += w }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.55, R + 0.6, 0.4, 96), [
      new THREE.MeshStandardMaterial({ color: '#a8603d', roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: t, roughness: .9, bumpMap: roomNoise(), bumpScale: .4 }),
      new THREE.MeshStandardMaterial({ color: '#a8603d', roughness: 1 })])
    floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor)
  }
}

function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p) }
  return pts
}

/** 천장 장식: 펜던트 조명, 깃발 줄, 꼬마전구, 걸이 화분, 벽 액자 */
function buildCeiling(scene: THREE.Object3D) {
  {
    const g = group(scene, 0, DH - 3.15, -0.5)
    const shade = add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2.1), clay('#d9a046', { side: THREE.DoubleSide })), g)
    shade.scale.y = 0.5
    add(at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12), new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd9a0', emissiveIntensity: 2.4 })), 0, -0.02, 0), g).castShadow = false
  }
  {
    const pts = catenary(new THREE.Vector3(-4.6, 5.9, -1.4), new THREE.Vector3(4.6, 5.9, -1.4), 1.1, 15)
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.02, 5), clay('#f3e6d6')), scene)
    const cols = ['#e07a52', '#f0d7a8', '#9fbf74', '#f4eadd', '#b9d3df', '#eda98b']
    const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0], 3)); tri.computeVertexNormals()
    for (let i = 1; i < pts.length - 1; i++) { const f = add(new THREE.Mesh(tri, clay(cols[i % cols.length], { side: THREE.DoubleSide })), scene); f.position.copy(pts[i]); f.castShadow = false }
  }
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 2.0, 7.0, -3.8), b = new THREE.Vector3(s * 5.3, 6.0, -1.4)
    const mid = a.clone().lerp(b, .5).add(new THREE.Vector3(0, .4, 0))
    for (const [p, q] of [[a, mid], [mid, b]]) {
      const pts = catenary(p, q, .55, 10)
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .02, 5), clay('#a86a48')), scene)
      const bc = ['#fff1cf', '#cfe7c2', '#f6c9c2', '#d9e9f2']
      for (let i = 2; i < pts.length; i += 3) { const m = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 8), new THREE.MeshStandardMaterial({ color: bc[i % 4], emissive: bc[i % 4], emissiveIntensity: .7 })); m.position.copy(pts[i]); m.position.y -= .1; scene.add(m) }
    }
  }
  {
    const g = group(scene, -1.55, 5.55, -1.6)
    cyl(g, .38, .3, .38, '#df7a57', 0, 0, 0)
    sph(g, .36, '#7fa95a', 0, .42, 0, 1, .55, 1)
    for (let i = 0; i < 4; i++) { const x = -.25 + i * .17; for (let k = 0; k < 4; k++) sph(g, .07, '#7fa95a', x + Math.sin(k + i) * .05, -.1 - k * .22 - (i % 2) * .15, .25) }
    for (const a of [0, 2.1, 4.2]) add(new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1.2, 4), clay('#c9a27e')), g).position.set(Math.cos(a) * .3, .95, Math.sin(a) * .3)
  }
  const frame = (x: number, y: number, z: number, w: number, h: number, pic: string, ry: number) => {
    const g = group(scene, x, y, z, ry)
    box(g, w, h, .07, '#c97c55', 0, 0, 0, .03); box(g, w * .74, h * .74, .03, pic, 0, h * .13, .05, .01)
  }
  frame(-1.3, 4.0, -5.15, .62, .62, '#9fbf74', .2)
  frame(1.5, 4.25, -5.1, .55, .7, '#b9d3df', -.2)
  frame(-2.8, 3.4, -4.6, .45, .58, '#f0d7a8', .55)
}

export function mountRoomScene(container: HTMLElement, opts: RoomSceneOptions = {}): SceneHandle {
  const renderer = createRenderer(container, { alpha: true, exposure: 0.92, shadowType: THREE.PCFSoftShadowMap })
  const scene = new THREE.Scene()
  scene.environment = gradientEnv(renderer, ROOM_ENV)
  scene.environmentIntensity = 0.7

  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 200)
  camera.position.set(0, 4.4, 21.5)
  camera.lookAt(0, 3.45, 0)

  buildShell(scene)

  // 조명
  scene.add(new THREE.HemisphereLight('#ffe4cc', '#a85a3c', 0.25))
  const key = new THREE.DirectionalLight('#ffe2c4', 1.5)
  key.position.set(-2, 16, 15); key.castShadow = true
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 12, bottom: -4, near: 1, far: 40 })
  scene.add(key)
  const bulb = new THREE.PointLight('#ffdcb0', 14, 14, 1.6); bulb.position.set(0, DH - 3.2, -0.5); scene.add(bulb)
  const fill = new THREE.PointLight('#ffe0cc', 6, 16, 1.5); fill.position.set(0, 2.5, 6); scene.add(fill)

  buildCeiling(scene)

  // 가구 (관심사별로 바뀌는 부분)
  const furniture = new THREE.Group()
  furniture.name = 'furniture'
  // 가구는 뒤쪽 반원 벽을 따라 붙음. 높이별 안쪽 벽 반지름(아래 1.25까지는 나무 판벽)
  const wallAt = (y: number) => Math.min(prof(y) - .08, y < 1.3 ? R - .16 : 99)
  const placed: THREE.Group[] = furnishRoom(furniture, { interests: opts.interests, wallAt, center: [0, .7] })
  scene.add(furniture)

  // 두더지 (glb, 따로 불러옴 → 오면 천장에서 떨어짐)
  // 다닐 수 있는 곳: 바닥 원판 안, 뒤쪽 벽 안, 가구 발자리 밖
  const MOLE_R = .38, MOLE_S = 1.9
  const clampRoom = (p: THREE.Vector3) => {
    const fr = R + .2 - MOLE_R, d = Math.hypot(p.x, p.z)
    if (d > fr) { p.x *= fr / d; p.z *= fr / d }
    if (p.z < 0) { const back = wallAt(0) - MOLE_R, d2 = Math.hypot(p.x, p.z); if (d2 > back) { p.x *= back / d2; p.z *= back / d2 } }
    for (let k = 0; k < 2; k++) for (const g of placed) {
      const f = g.userData.foot as { x: number; z: number; r: number } | null; if (!f) continue
      const dx = p.x - f.x, dz = p.z - f.z, dd = Math.hypot(dx, dz), need = f.r + MOLE_R
      if (dd < need) { p.x = f.x + dx / (dd || 1) * need; p.z = f.z + dz / (dd || 1) * need }
    }
    // 집주인 두더지와 겹치지 않게 (두더지 몸 폭 약 0.8m × scale)
    if (host) {
      const h = host.object.position, dx = p.x - h.x, dz = p.z - h.z, dd = Math.hypot(dx, dz), need = 1.35
      if (dd < need) { p.x = h.x + dx / (dd || 1) * need; p.z = h.z + dz / (dd || 1) * need }
    }
    return p
  }
  let host: MoleActor | null = null
  let mole: MoleActor | null = null
  let disposed = false
  const keyProxy = { drive: (x: number, z: number) => mole?.drive(x, z) }
  let worn = opts.worn ?? []
  Promise.all([loadMoleGltf(), loadAccessories()]).then(([gltf, acc]) => {
    if (disposed) return
    // 같은 glb 하나를 복제해서 씀 (집주인 + 나)
    if (opts.hostName) {
      host = createMoleActor(gltf, { scale: MOLE_S, start: new THREE.Vector3(1.5, 0, .4), yaw: -.35, drop: false, lookEvery: [5, 11], acc, worn: opts.hostWorn })
      scene.add(host.object)
    }
    mole = createMoleActor(gltf, { scale: MOLE_S, start: new THREE.Vector3(opts.hostName ? -1.4 : -.2, 0, 1.6), clamp: clampRoom, acc, worn })
    scene.add(mole.object)
  }).catch((err) => console.warn('[3D] 두더지 모델을 못 불러왔어요', err))
  // 직접 조종: 방향키·WASD, 바닥을 누르면 그쪽으로, 동작이 있는 가구를 누르면 그 동작
  const unbindKeys = bindMoleKeys(keyProxy)
  const el = renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const furnitureOf = (o: THREE.Object3D | null) => {
    for (; o; o = o.parent) if (o.userData.furniture) return o.userData.furniture.id === 'rug' ? null : o
    return null
  }
  const pick = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(furniture, true)[0]
    // 집주인 두더지: 몸을 세로 막대(키 1m × scale)로 보고 광선과의 거리로 판정
    let onHost = false
    if (host) {
      const hp = host.object.position, a = new THREE.Vector3(hp.x, .1 * MOLE_S, hp.z), b2 = new THREE.Vector3(hp.x, 1 * MOLE_S, hp.z)
      const pr = new THREE.Vector3(), ps = new THREE.Vector3()
      const d2 = ray.ray.distanceSqToSegment(a, b2, pr, ps)
      onHost = d2 < (.45 * MOLE_S) ** 2 && (!hit || pr.distanceTo(ray.ray.origin) < hit.distance)
    }
    return { g: hit && !onHost ? furnitureOf(hit.object) : null, onHost }
  }
  const actionOf = (g: THREE.Object3D | null) => {
    const f = g?.userData.furniture
    return f?.seat ? `${f.label}에 앉기` : f?.act === 'drink' ? '커피 마시기' : null
  }
  // 말풍선(리액션)·가구 이름표(마우스를 올렸을 때)
  // 말풍선은 두더지 오른쪽 위 (머리 위 '대화 요청하기' 버튼과 안 겹치게). 꼬리는 왼쪽 아래
  const makeBubble = () => {
    const b = document.createElement('div')
    Object.assign(b.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '4', font: '600 22px/1 system-ui, sans-serif', padding: '8px 11px', borderRadius: '16px 16px 16px 4px', background: 'rgba(251,248,244,.96)', boxShadow: '0 4px 14px rgba(60,35,20,.18)', transformOrigin: '0 100%', transform: 'translate(0,-100%) scale(.6)', opacity: '0', transition: 'opacity .18s, transform .22s cubic-bezier(.2,.7,.2,1.4)' })
    container.append(b)
    return { el: b, from: 0, until: 0, who: null as MoleActor | null }
  }
  const bubbles = [makeBubble(), makeBubble()]
  const say = (i: number, who: MoleActor, emoji: string, delay = 0) => {
    const b = bubbles[i]; b.el.textContent = emoji; b.who = who; b.from = clock + delay; b.until = clock + delay + 2.2
  }
  const sideV = new THREE.Vector3()
  const drawBubbles = (t: number) => {
    for (const b of bubbles) {
      const on = !!b.who && t >= b.from && t < b.until
      if (on && b.who) {
        // 머리 높이에서 몸 오른쪽(화면 기준)으로 0.55m
        b.who.headTop(headV); headV.y -= .25 * MOLE_S
        sideV.copy(headV).project(camera)
        b.el.style.left = `${(sideV.x * .5 + .5) * W + 34}px`; b.el.style.top = `${(-sideV.y * .5 + .5) * H}px`
      }
      const op = on ? '1' : '0'
      if (b.el.style.opacity !== op) { b.el.style.opacity = op; b.el.style.transform = `translate(0,-100%) scale(${on ? 1 : .6})` }
    }
  }
  const hint = document.createElement('div')
  Object.assign(hint.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '4', font: '500 13px/1 Pretendard, system-ui, sans-serif', padding: '7px 10px', borderRadius: '8px', background: 'rgba(62,42,31,.88)', color: '#fbf4ec', transform: 'translate(-50%, calc(-100% - 14px))', opacity: '0', transition: 'opacity .12s', whiteSpace: 'nowrap' })
  container.append(hint)
  let clock = 0
  const headV = new THREE.Vector3()

  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    if (!mole) return
    const { g, onHost } = pick(e)
    if (onHost) return
    if (g && mole.interact(g)) return
    if (g) return // 동작 없는 가구는 interact 가 앞까지 걸어감
    const o = ray.ray.origin, dir = ray.ray.direction; if (dir.y >= 0) return
    const t = -o.y / dir.y; mole.walkTo(new THREE.Vector3(o.x + dir.x * t, 0, o.z + dir.z * t))
  }
  let moveQueued: PointerEvent | null = null
  const onMove = (e: PointerEvent) => { moveQueued = e }
  const onLeave = () => { moveQueued = null; hint.style.opacity = '0'; el.style.cursor = 'pointer' }
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave)
  el.style.cursor = 'pointer'

  // 후처리: GTAO + 색보정
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.addPass(new RenderPass(scene, camera))
  const ao = new GTAOPass(scene, camera, 1, 1)
  ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.2, scale: 1.25, samples: 16 })
  ao.blendIntensity = 0.95
  composer.addPass(ao)
  const output = new OutputPass()
  composer.addPass(output)
  const grade = roomGradePass()
  composer.addPass(grade)

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  const applyFrame = () => {
    // 4:3 가상 화면: 높이 = 장면의 106.5%, 위에서 1% 아래, 가로 가운데 = focusX
    const bh = H * 1.065, bw = bh * 4 / 3
    frameCamera(camera, W, H, { left: focus * W - bw / 2, top: 0.01 * H, w: bw, h: bh })
  }

  const loop = startLoop(container, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      ao.setSize(w, h)
      grade.uniforms.uRes.value.set(w, h)
      applyFrame()
    },
    frame(dt, t) {
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame() }
      clock = t
      if (moveQueued) {
        const e = moveQueued; moveQueued = null
        const pk = pick(e), rect = el.getBoundingClientRect()
        const label = pk.onHost ? opts.hostName ?? null : actionOf(pk.g)
        hint.textContent = label ?? ''
        hint.style.opacity = label ? '1' : '0'
        hint.style.left = `${e.clientX - rect.left}px`; hint.style.top = `${e.clientY - rect.top}px`
      }
      host?.update(dt)
      mole?.update(dt)
      drawBubbles(t)
      grade.uniforms.uTime.value = t % 10
      composer.render(dt)
    },
  })

  return {
    resize: () => loop.resize(),
    setFocusX(x) {
      focusTarget = x
      // 루프가 안 도는 환경(헤드리스·숨은 탭)에서도 최종 위치는 맞게
      if (document.hidden) { focus = x; applyFrame() }
    },
    setWorn(ids) { worn = ids; mole?.setWorn(ids) },
    react(kind) {
      if (!mole) return
      const emoji = REACTIONS.find((r) => r.kind === kind)?.emoji ?? ''
      if (kind === 'greet' && host) {
        // 집주인 앞까지 가서 마주 보고 인사 → 집주인도 0.25초 뒤 인사. 말풍선은 인사를 시작할 때
        const me = mole, hs = host
        me.greetWith(hs)
        const started = clock
        const watch = () => {
          if (disposed || clock - started > 20) return
          if (me.isGreeting()) { say(0, me, emoji); say(1, hs, emoji, .25); return }
          requestAnimationFrame(watch)
        }
        requestAnimationFrame(watch)
        return
      }
      mole.react(kind)
      say(0, mole, emoji)
    },
    dispose() {
      disposed = true
      loop.stop()
      unbindKeys()
      mole?.dispose(); host?.dispose()
      bubbles.forEach((b) => b.el.remove()); hint.remove()
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave)
      disposeObject(scene)
      ao.dispose(); output.dispose(); grade.dispose(); composer.dispose()
      destroyRenderer(renderer)
    },
  }
}
