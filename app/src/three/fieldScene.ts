import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { N8AOPass } from 'n8ao'
import { noiseTex } from './clay'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { bindDriveKeys } from './keys'
import { getMyWorn } from '../data/moleItems'
import { gradientEnv, FIELD_ENV } from './lighting'
import { fieldGradePass } from './post'
import { blobShadow } from './roomLook'
import { approach, createRenderer, destroyRenderer, disposeObject, frameCamera, quality, startLoop, type SceneHandle } from './engine'
import { createBackdrop, toDynamicLayer, type Backdrop } from './staticBackdrop'
import { bakeMoleSprites, type MoleSprites } from './moleSprites'

/*
 * 탐색하기 밭 장면. explore/3d/field.html 을 옮김 ("PlayCanvas식 조명" 버전만, 비교 UI는 뺌).
 * 둔덕·표지판·꽃은 Figma 원본(1440×897 장면) 화면 좌표를 땅 위 위치로 바꿔 놓은 것.
 * 캔버스 비율이 달라도 object-fit: cover 처럼 잘라 보여 주고, 가로 가운데는 focusX.
 */

export interface FieldSceneOptions {
  focusX?: number
  /** 내 두더지 액세서리 (없으면 기본 착용) */
  worn?: string[]
}

const SW = 1440, SH = 897 // 원본 장면 좌표계
// 원본 캡처(2000폭 표시 기준)의 좌표 → 장면 좌표
const D = (dx: number, dy: number): [number, number] => [dx * 0.72, (dy - 87) * 0.72]
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** 땅 높이: 가까운 곳은 평평, 멀리 갈수록 완만한 언덕, 양옆이 조금 더 높음 */
export function groundHeight(x: number, z0: number) {
  const z = z0 - 8, r = Math.hypot(x, z)
  const far = THREE.MathUtils.smoothstep(r, 70, 200)
  return far * (2.2 + 3.2 * Math.abs(x) / Math.max(r, 1) + 1.2 * Math.sin(x * 0.03))
}

/** 꽃·덤불·돌을 InstancedMesh 하나로 모아 그림 */
class Inst {
  m: THREE.Matrix4[] = []
  c: THREE.Color[] = []
  im: THREE.InstancedMesh | null = null
  /** low = 저사양용 거친 지오메트리 (CPU 렌더러는 정점 수가 병목이라 꽃·덤불 구 분할을 줄임) */
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public low: THREE.BufferGeometry) {}
  push(matrix: THREE.Matrix4, color: string) { this.m.push(matrix.clone()); this.c.push(new THREE.Color(color)) }
  build(scene: THREE.Object3D, lite: boolean) {
    if (!this.m.length) return
    const im = this.im = new THREE.InstancedMesh(lite ? this.low : this.geo, this.mat, this.m.length)
    this.m.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, this.c[i]) })
    im.castShadow = true; im.receiveShadow = true; scene.add(im)
  }
  /** 자동으로 저사양이 됐을 때 지오메트리만 바꿔 끼움 */
  useLow() { if (this.im && this.im.geometry !== this.low) { this.im.geometry = this.low; this.geo.dispose() } }
}

function holeTex() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256
  const g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 0, 256)
  // v=0 바깥 아래 → v=1 구멍 바닥
  gr.addColorStop(1, '#d4783e'); gr.addColorStop(.8, '#e58c4c'); gr.addColorStop(.6, '#f1a061'); gr.addColorStop(.52, '#e08848')
  gr.addColorStop(.47, '#9a4f27'); gr.addColorStop(.42, '#4e2814'); gr.addColorStop(.35, '#1c0e07'); gr.addColorStop(0, '#0d0604')
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function mountFieldScene(container: HTMLElement, opts: FieldSceneOptions = {}): SceneHandle {
  // 품질 (engine.ts). 저사양: 후처리(N8AO·색보정) 없이 renderer.render, 해 그림자 맵 대신 발밑 그림자 판, 해상도 0.55배, 15fps, 쉬면 멈춤
  const q = quality()
  /*
   * A 배경 한 번 + 두더지만 (lib/lowLab.ts, staticBackdrop.ts): 저사양이고 실험실 A 가 켜져 있으면
   * 밭(움직이지 않는 것 전부)은 렌더 타깃에 한 번만 그리고, 매 프레임은 그것을 붙인 뒤 두더지 층만 그림.
   * 저사양으로 시작했으면 지난 그림을 남겨 두고(preserveDrawingBuffer) 두더지 둘레 사각형만 다시 그림 (땅굴 부분 그리기와 같은 방식)
   */
  const useBackdrop = () => q.level === 'low' && !!q.lab?.A
  const scissorOk = useBackdrop()
  const renderer = createRenderer(container, { exposure: 1.0, shadowType: THREE.PCFShadowMap, quality: q, preserve: scissorOk })
  let backdrop: Backdrop | null = useBackdrop() ? createBackdrop(renderer) : null
  /*
   * E 2D 두더지 (시험판, moleSprites.ts): 두더지를 그림으로 한 번 찍어 두고, 밭은 바뀔 때만 3D로 그리고
   * 매 프레임은 위에 얹은 2D 캔버스에 두더지 그림만 붙임 (3D 그리기 0). 가림(꽃 뒤로 지나가기)은 없어짐
   */
  const useSprite = q.level === 'low' && !!q.lab?.E
  let sprites: MoleSprites | null = null
  let overlay: HTMLCanvasElement | null = null
  const scene = new THREE.Scene()
  scene.environment = gradientEnv(renderer, FIELD_ENV)
  scene.environmentIntensity = .85

  // 하늘: 화면에 고정된 세로 그라데이션
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#a3d3f7'); gr.addColorStop(0.6, '#c2e2f8'); gr.addColorStop(1, '#dbeff9')
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t
  }
  scene.fog = new THREE.Fog('#c4e3a4', 30, 150)

  // 배치 계산용 카메라: 원본 비율 그대로 (화면 구도는 렌더할 때 view offset 으로 맞춤)
  const camera = new THREE.PerspectiveCamera(40, SW / SH, 0.1, 400)
  camera.position.set(0, 2.7, 8)
  camera.rotation.set(-THREE.MathUtils.degToRad(10.7), 0, 0)
  camera.updateMatrixWorld(); camera.updateProjectionMatrix()

  // 장면 좌표(px) → 땅(y=h) 위의 3D 점
  const ray = new THREE.Raycaster()
  const P = (sx: number, sy: number, h = 0) => {
    ray.setFromCamera(new THREE.Vector2(sx / SW * 2 - 1, -(sy / SH * 2 - 1)), camera)
    const o = ray.ray.origin, d = ray.ray.direction, t = (h - o.y) / d.y
    return new THREE.Vector3(o.x + d.x * t, h, o.z + d.z * t)
  }
  const PD = (dx: number, dy: number, h?: number) => P(...D(dx, dy), h)
  // 3D 점이 화면에서 어느 y에 오는지
  const screenY = (v: THREE.Vector3) => (1 - (v.clone().project(camera).y + 1) / 2) * SH
  // 바닥 점 base에서 위로 몇 높이여야 화면 y가 sy가 되는지
  const heightTo = (base: THREE.Vector3, sy: number) => { let lo = 0, hi = 30; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (screenY(base.clone().setY(m)) > sy) lo = m; else hi = m } return (lo + hi) / 2 }

  const NOISE = noiseTex()
  const clay = (hex: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, ...o })
  const add = <T extends THREE.Object3D>(m: T, p: THREE.Object3D = scene): T => { m.castShadow = true; m.receiveShadow = true; p.add(m); return m }

  /* ---------- 조명 (PlayCanvas식: 환경광 + 부드러운 그림자) ---------- */
  const sun = new THREE.DirectionalLight('#fff6e8', 2.3)
  sun.position.set(-11, 13, 4); sun.target.position.set(0, 0, -6)
  sun.layers.enable(1) // 두더지 층(layer 1)도 해를 받음
  sun.castShadow = q.shadows; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 })
  scene.add(sun, sun.target)

  /* ---------- 땅 ---------- */
  // 분할 수: 원래 240 (정점 5.8만). 저사양은 96 (먼 언덕만 굴곡이 있어서 차이가 거의 안 보임)
  const groundGeo = (seg: number) => {
    const geo = new THREE.PlaneGeometry(600, 600, seg, seg); geo.rotateX(-Math.PI / 2)
    const pa = geo.attributes.position
    for (let i = 0; i < pa.count; i++) pa.setY(i, groundHeight(pa.getX(i), pa.getZ(i)))
    geo.computeVertexNormals()
    return geo
  }
  let ground: THREE.Mesh
  {
    const c = document.createElement('canvas'); c.width = c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#9ccc58'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(170,225,95,.18)' : 'rgba(95,165,45,.14)'; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, 7); g.fill() }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30)
    ground = new THREE.Mesh(groundGeo(q.post ? 240 : 96), new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: '#f4f8e4' }))
    ground.name = 'ground'
    ground.receiveShadow = true; scene.add(ground)
  }

  /* ---------- 인스턴스 모음 (꽃·덤불·돌) ---------- */
  const white = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, ...o })
  const I = {
    ball: new Inst(new THREE.SphereGeometry(1, 20, 14), white({ bumpMap: NOISE, bumpScale: .3 }), new THREE.SphereGeometry(1, 8, 6)),
    petal: new Inst(new THREE.SphereGeometry(1, 12, 8), white(), new THREE.SphereGeometry(1, 6, 3)),
    core: new Inst(new THREE.SphereGeometry(1, 14, 10), white(), new THREE.SphereGeometry(1, 7, 5)),
    stem: new Inst(new THREE.CylinderGeometry(1, 1, 1, 6), white(), new THREE.CylinderGeometry(1, 1, 1, 4, 1, true)),
    leaf: new Inst(new THREE.SphereGeometry(1, 10, 6), white(), new THREE.SphereGeometry(1, 5, 3)),
  }
  const tmpP = new THREE.Object3D(), tmpC = new THREE.Object3D(); tmpP.add(tmpC)
  const place = (inst: Inst, color: string, parentFn: (o: THREE.Object3D) => void, childFn: (o: THREE.Object3D) => void) => {
    tmpP.position.set(0, 0, 0); tmpP.rotation.set(0, 0, 0); tmpP.scale.set(1, 1, 1)
    tmpC.position.set(0, 0, 0); tmpC.rotation.set(0, 0, 0); tmpC.scale.set(1, 1, 1)
    parentFn(tmpP); childFn(tmpC); tmpP.updateMatrixWorld(true); inst.push(tmpC.matrixWorld, color)
  }
  // 꽃: kind = 'daisy' | 'coral'
  const flower = (pos: THREE.Vector3, s: number, kind: 'daisy' | 'coral' = 'daisy') => {
    const h = s * rnd(1.4, 1.9), tilt = rnd(-.25, .25)
    spot(pos, s * .7, h * .6)
    place(I.stem, '#5fae3a', (p) => p.position.copy(pos), (c) => { c.position.y = h / 2; c.scale.set(s * .06, h, s * .06) })
    for (const side of [-1, 1]) place(I.leaf, '#6dbb3f', (p) => { p.position.copy(pos); p.rotation.y = rnd(0, 3) }, (c) => { c.position.set(side * s * .28, s * .25, 0); c.rotation.z = side * .9; c.scale.set(s * .32, s * .08, s * .14) })
    const face = (p: THREE.Object3D) => { p.position.copy(pos).add(new THREE.Vector3(0, h, 0)); p.rotation.set(-0.75 + tilt, rnd(-.4, .4), tilt * .5) }
    const n = kind === 'daisy' ? 9 : 6, petalC = kind === 'daisy' ? '#fff6e9' : (Math.random() < .5 ? '#f5837a' : '#f39a8c')
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; place(I.petal, petalC, face, (c) => { c.position.set(Math.cos(a) * s * .42, Math.sin(a) * s * .42, 0); c.rotation.z = a; c.scale.set(s * (kind === 'daisy' ? .36 : .4), s * (kind === 'daisy' ? .16 : .26), s * .07) }) }
    place(I.core, kind === 'daisy' ? '#f7b52c' : '#f9c33a', face, (c) => { c.position.z = s * .05; c.scale.set(s * .22, s * .22, s * .12) })
  }
  // 덤불: 연두 공 여러 개
  const bush = (pos: THREE.Vector3, s: number) => {
    spot(pos, s * 1.5, s)
    const n = 3 + Math.floor(Math.random() * 4)
    const cols = ['#5aae36', '#6abb40', '#7fc64e', '#97d062']
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = rnd(0, .7) * s, r = s * rnd(.45, .8)
      place(I.ball, cols[Math.floor(Math.random() * cols.length)], (p) => p.position.copy(pos), (c) => { c.position.set(Math.cos(a) * d, r * .75, Math.sin(a) * d * .7); c.scale.set(r, r * .9, r) })
    }
    place(I.ball, '#a9dc6e', (p) => p.position.copy(pos), (c) => { c.position.set(-s * .2, s * 1.0, s * .1); c.scale.setScalar(s * .45) })
  }
  /*
   * 발밑 그림자 판 자리 (저사양에서 해 그림자 대신). 해가 왼쪽 위 뒤(-11, 13, 4 → 과녁 (0,0,-6))에 있어서
   * 그림자는 오른쪽 앞으로 조금 밀림: 높이 h 의 물체면 (+0.42h, -0.38h) 정도
   */
  const spots: { x: number; z: number; r: number }[] = []
  const spot = (pos: THREE.Vector3, r: number, h: number) => { if (groundHeight(pos.x, pos.z) < .05) spots.push({ x: pos.x + h * .42, z: pos.z - h * .38, r }) }
  const pebble = (pos: THREE.Vector3, s: number, col: string) => (spot(pos, s * 1.1, s * .3), place(I.ball, col, (p) => p.position.copy(pos), (c) => { c.position.y = s * .25; c.rotation.y = rnd(0, 3); c.scale.set(s, s * .45, s * .75) }))

  /* ---------- 흙 둔덕 ---------- */
  const HOLE = holeTex()
  const moundMat = new THREE.MeshStandardMaterial({ map: HOLE, roughness: .95, bumpMap: NOISE, bumpScale: .5 })
  const mound = (center: THREE.Vector3, rx: number, rz: number, hgt: number) => {
    // 반지름 1, 높이 1 기준 단면 (바깥 → 꼭대기 → 안쪽 → 구멍 바닥)
    const prof = [[1.0, 0], [.97, .22], [.91, .58], [.82, .86], [.7, .99], [.6, 1.0], [.53, .92], [.48, .7], [.45, .4], [.43, 0], [.4, -.6], [.3, -1.2], [0, -1.4]]
    const m = add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72), moundMat))
    m.position.copy(center); m.scale.set(rx, hgt, rz)
    return m
  }

  /* ---------- 나무 표지판 ---------- */
  const rbox = (w: number, h: number, d: number, hex: string, r = .06) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r)
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: r * .6, bevelThickness: r * .6, bevelSegments: 3 }); g.translate(0, 0, -d / 2)
    return new THREE.Mesh(g, clay(hex, { bumpMap: NOISE, bumpScale: .4 }))
  }
  const sign = (base: THREE.Vector3, topY: number, boardW: number, boardH: number, ry = 0, rz = 0) => {
    const total = heightTo(base, topY)
    spot(base, boardW * .6, total * .5)
    const g = new THREE.Group(); g.position.copy(base); g.rotation.set(0, ry, rz); scene.add(g)
    const pw = boardW * .13
    const post = add(rbox(pw, total - boardH * .2, pw * .9, '#b0602f', pw * .3), g); post.position.y = (total - boardH * .2) / 2
    const board = add(rbox(boardW, boardH, boardW * .12, '#d9824a', boardH * .16), g); board.position.y = total - boardH / 2; board.position.z = pw * .5
    const cap = add(rbox(pw * .7, boardH * .18, pw * .6, '#b8612e', pw * .2), g); cap.position.y = total + boardH * .02
    return g
  }

  /* ---------- 배치: 원본 좌표 기준 ---------- */
  const moundAt = (lx: number, rx: number, y: number, rzK = 1) => {
    const a = PD(lx, y), b = PD(rx, y), c = a.clone().lerp(b, .5), r = a.distanceTo(b) / 2
    const m = mound(c, r, r * rzK, 1)
    m.scale.y = r * .36
    return { c, r, rz: r * rzK }
  }
  const mounds = [moundAt(545, 1380, 845, .78), moundAt(135, 700, 625, .7), moundAt(1330, 1915, 680, .7)]

  sign(PD(740, 668), D(0, 478)[1], 1.7, .72, .05)
  sign(PD(1282, 700), D(0, 535)[1], 1.75, .72, -.12, .06)
  sign(PD(1488, 962), D(0, 708)[1], 1.3, .5, -.05)

  // 두더지 자리: 발 위치와 머리 꼭대기를 원본에 맞춤 (두더지는 glb를 받은 뒤 놓음)
  const home = PD(986, 1128)
  const moleH = heightTo(home, D(0, 786)[1])   // 원본 그림에서 두더지 키 (장면 단위)
  // 다닐 수 있는 곳: 둔덕 안쪽은 밖으로 밀어내고, 화면 밖으로 너무 멀리 가지 않게
  const clampWalk = (p: THREE.Vector3) => {
    p.x = THREE.MathUtils.clamp(p.x, home.x - 4.2, home.x + 4.2)
    p.z = THREE.MathUtils.clamp(p.z, home.z - 6, home.z + 1.6)
    for (const m of mounds) {
      const dx = (p.x - m.c.x) / (m.r * 1.08), dz = (p.z - m.c.z) / (m.rz * 1.08), d = Math.hypot(dx, dz)
      if (d < 1) { p.x = m.c.x + dx / (d || 1) * m.r * 1.08; p.z = m.c.z + dz / (d || 1) * m.rz * 1.08 }
    }
    return p
  }
  // 방 안과 같은 glb 두더지 (moleActor). 이동 속도(보폭)는 moleActor 의 STRIDE 로 같이 적용됨.
  // 정면 +Z = 카메라 쪽. 핸드오프 두더지는 키가 약 0.5m라 원본 그림의 키(moleH)에 맞게 scale.
  let mole: MoleActor | null = null
  let disposed = false
  Promise.all([loadMoleGltf(), loadAccessories()]).then(([moleG, acc]) => {
    if (disposed) return
    const box = new THREE.Box3().setFromObject(moleG.scene)
    const S = moleH / Math.max(box.max.y - box.min.y, 1e-3)
    mole = createMoleActor(moleG, {
      scale: S, start: home.clone(), yaw: 0, drop: false, clamp: clampWalk, groundAt: groundHeight,
      wander: { center: home.clone(), radius: 1.6, rest: [3, 6] }, acc, worn: opts.worn ?? getMyWorn(),
      simple: q.level === 'low' && !!q.lab?.F,   // F 단순한 두더지 (lib/lowLab.ts)
    })
    scene.add(mole.object)
    toDynamicLayer(mole.object)
    moleBlob.scale.set(moleH * .95, 1, moleH * .95); moleBlob.visible = true
    fullNext = true
    loop.ready()
    if (useSprite) {
      const simple = q.level === 'low' && !!q.lab?.F
      bakeMoleSprites(renderer, moleG, { acc: simple ? undefined : acc, worn: opts.worn ?? getMyWorn(), environment: scene.environment, envIntensity: scene.environmentIntensity, sun, pitchDeg: 10.7 })
        .then((sp) => {
          if (disposed || !mole) return
          sprites = sp
          mole.object.visible = false; moleBlob.visible = false
          overlay = document.createElement('canvas')
          overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
          overlay.width = W; overlay.height = H
          container.appendChild(overlay)
          fullNext = true
          loop.wake()
        })
        .catch((err) => console.warn('[3D] 2D 두더지를 못 만들었어요', err))
    }
  }).catch((err) => console.warn('[3D] 두더지를 못 불러왔어요', err))
  const unbindKeys = bindDriveKeys((x, z) => { mole?.drive(x, z); loop.wake() }, { arrows: false })   // WASD로 조종 (←/→는 이웃 땅굴 넘기기)

  // 앞쪽 손으로 놓은 것들 (원본 위치)
  bush(PD(165, 1150), .45); bush(PD(1610, 1250), .42); bush(PD(1875, 905), .5); bush(PD(25, 905), .45); bush(PD(60, 735), .4)
  bush(PD(1065, 570), .45); bush(PD(1700, 505), .4)
  ;[[80, 1265, .32], [150, 1215, .26], [1945, 1260, .3], [440, 765, .32], [1370, 940, .33], [790, 615, .22], [1215, 685, .25], [1300, 712, .22], [1930, 560, .2]].forEach(([x, y, s]) => flower(PD(x, y), s, 'daisy'))
  ;[[165, 1265, .24], [1800, 1085, .22], [1890, 1100, .22], [1975, 775, .28], [10, 660, .25]].forEach(([x, y, s]) => flower(PD(x, y), s, 'coral'))
  pebble(PD(435, 1235), .2, '#7a5a4b'); pebble(PD(630, 1212), .14, '#f1e3c8'); pebble(PD(52, 993), .2, '#f1e3c8'); pebble(PD(590, 1218), .1, '#8a6a5a')
  ;[[480, 795, .32], [413, 853, .3], [540, 975, .34], [75, 655, .2], [1960, 722, .22], [612, 710, .14]].forEach(([x, y, s]) => pebble(PD(x, y), s, '#df7f43'))

  // 멀리 흩뿌리기
  const blocked = (p: THREE.Vector3) => {
    for (const m of mounds) { const dx = (p.x - m.c.x) / (m.r * 1.15), dz = (p.z - m.c.z) / (m.rz * 1.15); if (dx * dx + dz * dz < 1) return true }
    if (Math.abs(p.x) < 1.6 && p.z > -3.5) return true // 두더지 주변
    return false
  }
  for (let i = 0; i < 900; i++) {
    const z = -rnd(4, 95), dist = 8 - z, half = dist * .62
    const p = new THREE.Vector3(rnd(-half, half), 0, z)
    if (blocked(p)) continue
    const near = dist < 18
    if (near && Math.random() < .6) continue
    if (dist > 45 && Math.random() < .55) continue
    // 저사양으로 시작하면 먼 곳(안개 속)은 절반만 (삼각형 수가 CPU 렌더러의 병목)
    if (!q.post && dist > 26 && Math.random() < .5) continue
    const r = Math.random()
    if (r < .4) bush(p, rnd(.22, .42))
    else if (r < .72) flower(p, rnd(.18, .28), 'daisy')
    else if (r < .87) flower(p, rnd(.18, .26), 'coral')
    else pebble(p, rnd(.08, .18), Math.random() < .5 ? '#df7f43' : '#8a6a5a')
  }
  Object.values(I).forEach((i) => i.build(scene, !q.post))

  // 발밑 그림자 판: 소품은 InstancedMesh 하나, 두더지는 따라다니는 판 하나. 해 그림자가 켜져 있으면 숨김
  const blobs = new THREE.Group(); blobs.name = 'blob-shadows'; scene.add(blobs)
  const blobSrc = blobShadow(1)
  const blobMat = (blobSrc.material as THREE.MeshBasicMaterial).clone()
  blobSrc.geometry.dispose(); (blobSrc.material as THREE.Material).dispose()
  blobMat.color.set('#2c4a17'); blobMat.opacity = .3
  const blobGeo = new THREE.PlaneGeometry(1, .8).rotateX(-Math.PI / 2)
  {
    const im = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(spots.length, 1))
    const m = new THREE.Matrix4()
    spots.forEach((p, i) => im.setMatrixAt(i, m.makeScale(p.r * 2, 1, p.r * 2).setPosition(p.x, groundHeight(p.x, p.z) + .02, p.z)))
    im.count = spots.length; im.renderOrder = 1; im.frustumCulled = false
    blobs.add(im)
  }
  const moleBlob = new THREE.Mesh(blobGeo, blobMat); moleBlob.renderOrder = 1; moleBlob.visible = false; blobs.add(moleBlob)
  moleBlob.layers.set(1) // 두더지와 같이 움직이는 층
  blobs.visible = !q.shadows

  /* ---------- 후처리: N8AO 구석 그림자 + 색보정 ---------- */
  // 저사양이면 만들지 않음 (그때는 renderer.render 가 톤매핑·sRGB 까지 해서 색은 거의 같고 AO·그레인만 빠짐)
  const makePost = () => {
    const composer = new EffectComposer(renderer)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.addPass(new RenderPass(scene, camera))
    const ao = new N8AOPass(scene, camera, SW, SH)
    Object.assign(ao.configuration, { aoRadius: .9, distanceFalloff: .6, intensity: 2.2, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 10, halfRes: false, gammaCorrection: false })
    composer.addPass(ao)
    const output = new OutputPass()
    composer.addPass(output)
    const grade = fieldGradePass()
    composer.addPass(grade)
    return {
      composer,
      setSize(w: number, h: number) { composer.setSize(w, h); ao.setSize(w, h); grade.uniforms.uRes.value.set(w, h) },
      dispose() { (ao as unknown as { dispose?: () => void }).dispose?.(); output.dispose(); grade.dispose(); composer.dispose() },
    }
  }
  let post = q.post ? makePost() : null

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  const applyFrame = () => {
    // cover: 원본 1440×897 장면이 캔버스를 꽉 채우게 키우고, 가로 가운데를 focusX에
    const k = Math.max(W / SW, H / SH), bw = SW * k, bh = SH * k
    frameCamera(camera, W, H, { left: focus * W - bw / 2, top: (H - bh) / 2, w: bw, h: bh })
    backdrop?.invalidate()
  }

  /* ---------- A: 배경 한 번 + 두더지 둘레만 ---------- */
  let fullNext = true
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  let prevRect: Rect | null = null
  const corner = new THREE.Vector3()
  const moleRect = (): Rect | null => {
    if (!mole) return null
    const p = mole.object.position, h = moleH * .75, r: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (let i = 0; i < 8; i++) {
      corner.set(p.x + (i & 1 ? h : -h) + moleH * .1, p.y + (i & 2 ? moleH * 1.45 : -.05), p.z + (i & 4 ? h : -h)).project(camera)
      const x = (corner.x * .5 + .5) * W, y = (corner.y * .5 + .5) * H
      r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y)
    }
    return r
  }
  const drawBackdrop = (full: boolean) => {
    const bd = backdrop!
    if (bd.isDirty()) { bd.capture(scene, camera); full = true }
    const cur = moleRect(), prev = prevRect
    prevRect = cur
    let scissor = false
    if (scissorOk && !full && cur && prev) {
      const pad = 12
      const x0 = Math.max(0, Math.floor(Math.min(cur.x0, prev.x0) - pad)), x1 = Math.min(W, Math.ceil(Math.max(cur.x1, prev.x1) + pad))
      const y0 = Math.max(0, Math.floor(Math.min(cur.y0, prev.y0) - pad)), y1 = Math.min(H, Math.ceil(Math.max(cur.y1, prev.y1) + pad))
      if (x1 <= x0 || y1 <= y0) return
      renderer.setScissorTest(true); renderer.setScissor(x0, y0, x1 - x0, y1 - y0); scissor = true
    }
    renderer.autoClear = false
    bd.blit()
    const bg = scene.background
    scene.background = null
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    scene.background = bg
    renderer.autoClear = true
    if (scissor) renderer.setScissorTest(false)
  }
  camera.layers.enable(1) // 평소(고사양·A 끔)에는 두 층 모두 그림

  /* ---------- E: 2D 두더지 그리기 ---------- */
  const footV = new THREE.Vector3(), headV = new THREE.Vector3(), lastPos = new THREE.Vector3()
  let spriteT = 0
  const drawSprite = (dt: number) => {
    if (!sprites || !overlay || !mole) return
    if (overlay.width !== W || overlay.height !== H) { overlay.width = W; overlay.height = H }
    const ctx = overlay.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    const p = mole.object.position
    footV.copy(p).project(camera); headV.set(p.x, p.y + moleH, p.z).project(camera)
    const fx = (footV.x * .5 + .5) * W, fy = (1 - (footV.y * .5 + .5)) * H, hy = (1 - (headV.y * .5 + .5)) * H
    const drawH = (fy - hy) / sprites.heightFrac
    // 발밑 그림자 (해 쪽 반대로 조금 밀림)
    ctx.fillStyle = 'rgba(44,74,23,.3)'
    ctx.beginPath(); ctx.ellipse(fx + drawH * .05, fy - drawH * .01, (fy - hy) * .42, (fy - hy) * .1, 0, 0, Math.PI * 2); ctx.fill()
    // 방향 (yaw 0 = 카메라 쪽) 과 걷는지
    const yaw = mole.object.rotation.y
    const dir = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4
    const speed = dt > 0 ? lastPos.distanceTo(p) / dt : 0
    lastPos.copy(p)
    spriteT += dt
    const walk = speed > moleH * .05
    // 걷기 6장 = 동작 한 바퀴. 3D 와 같은 재생 속도(1.25바퀴/초)로 넘김
    const i = walk ? Math.floor(spriteT * 7.5) % 6 : Math.floor(spriteT * 2) % 4
    const c = sprites.cell(dir, walk, i)
    ctx.drawImage(sprites.atlas, c.sx, c.sy, sprites.S, sprites.S, fx - drawH / 2, fy - sprites.footY * drawH, drawH, drawH)
  }

  const loop = startLoop(container, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      post?.setSize(w, h)
      applyFrame()
      fullNext = true
    },
    frame(dt) {
      let full = fullNext || dt === 0
      fullNext = false
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); full = true }
      mole?.update(dt)
      if (mole) moleBlob.position.set(mole.object.position.x + moleH * .1, groundHeight(mole.object.position.x, mole.object.position.z) + .025, mole.object.position.z - moleH * .08)
      if (sprites) { if (full) renderer.render(scene, camera); drawSprite(dt) }
      else if (post) post.composer.render(dt)
      else if (backdrop) drawBackdrop(full)
      else renderer.render(scene, camera)
    },
    busy: () => (!!mole && !mole.isResting()) || focus !== focusTarget,
    downgrade(nq) {
      renderer.setPixelRatio(nq.pixelRatio)
      post?.dispose(); post = null
      sun.castShadow = false; renderer.shadowMap.enabled = false
      blobs.visible = true
      Object.values(I).forEach((i) => i.useLow())
      const g = ground.geometry; ground.geometry = groundGeo(96); g.dispose()
      // 자동으로 저사양이 됐을 때도 A 는 켬 (부분 사각형은 preserveDrawingBuffer 가 없어서 전체 붙이기만)
      if (useBackdrop() && !backdrop) backdrop = createBackdrop(renderer)
    },
  }, q)

  // 땅을 누르면 그 자리로 걸어감 (드래그는 무시)
  const el = renderer.domElement
  const ndc = new THREE.Vector2()
  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    const rect = el.getBoundingClientRect()
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(ground, false)[0]
    if (hit) mole?.walkTo(hit.point.clone(), { scratch: true })   // 잔디를 누르면 걸어가서 땅 긁기 한 번
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.style.cursor = 'pointer'

  return {
    resize: () => loop.resize(),
    setFrozen: (on) => loop.setFrozen(on),
    setFocusX(x) {
      focusTarget = x
      if (document.hidden) { focus = x; applyFrame() }
      loop.wake()
    },
    dispose() {
      disposed = true
      loop.stop()
      mole?.dispose()
      unbindKeys()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      disposeObject(scene)
      Object.values(I).forEach((i) => { i.geo.dispose(); i.low.dispose() })
      post?.dispose()
      backdrop?.dispose()
      overlay?.remove()
      destroyRenderer(renderer)
    },
  }
}
