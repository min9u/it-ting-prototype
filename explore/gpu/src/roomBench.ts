import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { add, at, clay, cyl, group, box, sph, roomNoise } from '../../../app/src/three/clay'
import { furnishRoom } from '../../../app/src/three/furniture'
import { makeMole, createMoleMotion, bindMoleKeys } from '../../../app/src/three/mole'
import { gradientEnv, ROOM_ENV } from '../../../app/src/three/lighting'
import { roomGradePass } from '../../../app/src/three/post'
import { approach, createRenderer, destroyRenderer, disposeObject, frameCamera, startLoop, type SceneHandle } from '../../../app/src/three/engine'

/*
 * 땅굴 방 장면. explore/3d/room.html 을 옮김 (비교 UI·OrbitControls 는 뺌).
 * 구도: 4:3 "가상 화면"이 장면 높이의 106.5%, 위에서 1% 내려와 있고 가로 가운데가 focusX.
 * (Figma 내 땅굴 화면과 비교해서 돔 꼭대기·두더지 발 높이를 맞춤)
 */

export interface RoomSceneOptions {
  ownerId?: string
  interests?: string[]
  focusX?: number
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

/* ===== 벤치용 마운트: 품질 손잡이를 쿼리로 받음 (앱 roomScene.ts 의 mountRoomScene 을 옮겨 고침) ===== */
export interface Quality {
  ao: boolean; grade: boolean; composer: boolean; shadow: number; shadowType: 'soft' | 'pcf' | 'basic'
  pr: number; aa: boolean; env: boolean; points: boolean; shells: number; msaa: number
}
export function mountBench(container: HTMLElement, q: Quality, interests?: string[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: q.aa, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false })
  renderer.setPixelRatio(q.pr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.shadowMap.enabled = q.shadow > 0
  renderer.shadowMap.type = q.shadowType === 'soft' ? THREE.PCFSoftShadowMap : q.shadowType === 'pcf' ? THREE.PCFShadowMap : THREE.BasicShadowMap
  renderer.setClearColor(0x000000, 0)
  const el = renderer.domElement
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  container.appendChild(el)

  const scene = new THREE.Scene()
  if (q.env) { scene.environment = gradientEnv(renderer, ROOM_ENV); scene.environmentIntensity = 0.7 }
  else scene.add(new THREE.AmbientLight('#ffe8d8', 0.9))
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 200)
  camera.position.set(0, 4.4, 21.5); camera.lookAt(0, 3.45, 0)
  buildShell(scene)
  scene.add(new THREE.HemisphereLight('#ffe4cc', '#a85a3c', 0.25))
  const key = new THREE.DirectionalLight('#ffe2c4', 1.5)
  key.position.set(-2, 16, 15); key.castShadow = q.shadow > 0
  if (q.shadow > 0) {
    key.shadow.mapSize.set(q.shadow, q.shadow); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 12, bottom: -4, near: 1, far: 40 })
  }
  scene.add(key)
  if (q.points) {
    const bulb = new THREE.PointLight('#ffdcb0', 14, 14, 1.6); bulb.position.set(0, DH - 3.2, -0.5); scene.add(bulb)
    const fill = new THREE.PointLight('#ffe0cc', 6, 16, 1.5); fill.position.set(0, 2.5, 6); scene.add(fill)
  } else {
    scene.add(new THREE.AmbientLight('#ffdcb0', 0.6))
  }
  buildCeiling(scene)
  const furniture = new THREE.Group()
  const wallAt = (y: number) => Math.min(prof(y) - .08, y < 1.3 ? R - .16 : 99)
  furnishRoom(furniture, { interests, wallAt, center: [0, .7] })
  scene.add(furniture)
  const mole = makeMole()
  mole.position.set(-.2, 0, .8); mole.scale.setScalar(1.9)
  scene.add(mole)
  const motion = createMoleMotion(mole, { ground: () => 0, startRest: 0, speed: .8, wander: { center: new THREE.Vector3(0, 0, 1.3), radius: 2, rest: [0.2, 0.5] } })

  let composer: EffectComposer | null = null, grade: ReturnType<typeof roomGradePass> | null = null, ao: GTAOPass | null = null
  if (q.composer) {
    const rt = q.msaa > 0 ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa }) : undefined
    composer = new EffectComposer(renderer, rt)
    composer.setPixelRatio(q.pr)
    composer.addPass(new RenderPass(scene, camera))
    if (q.ao) {
      ao = new GTAOPass(scene, camera, 1, 1)
      ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.2, scale: 1.25, samples: 16 })
      ao.blendIntensity = 0.95
      composer.addPass(ao)
    }
    composer.addPass(new OutputPass())
    if (q.grade) { grade = roomGradePass(); composer.addPass(grade) }
  }
  let W = 1, H = 1
  const resize = () => {
    W = container.clientWidth; H = container.clientHeight
    renderer.setSize(W, H, false)
    composer?.setSize(W, H); ao?.setSize(W, H); grade?.uniforms.uRes.value.set(W, H)
    const bh = H * 1.065, bw = bh * 4 / 3
    frameCamera(camera, W, H, { left: 0.5 * W - bw / 2, top: 0.01 * H, w: bw, h: bh })
  }
  resize()
  const render = (dt: number, t: number) => {
    motion.update(dt, t)
    if (grade) grade.uniforms.uTime.value = t % 10
    if (composer) composer.render(dt); else renderer.render(scene, camera)
  }
  const stats = () => {
    let tris = 0, meshes = 0
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 } })
    return { meshes, tris: Math.round(tris), programs: renderer.info.programs?.length ?? 0 }
  }
  return { renderer, render, stats, canvas: el }
}
