import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { N8AOPass } from 'n8ao'
import { noiseTex } from './clay'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { bindDriveKeys } from './keys'
import { loadGlb } from './glb'
import groundPropsUrl from '../assets/models/ground_props_v1.glb?url'
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
 *
 * 2026-11-12 (docs/field-move.md)
 * - 굴: 3D 핸드오프 v1 ground_props_v1.glb 의 burrow (흙더미 + 깊이 1.2m 굴, 버텍스 컬러). 땅에는 굴 중심 반지름 0.8m 구멍
 *   (ground_move_spec 7번의 burrow_ground_mask 와 같은 원을 땅 셰이더에서 discard. 후처리(N8AO)·배경 한 번(A) 렌더 타깃에는
 *   스텐실 버퍼가 없어서 스펙이 허락하는 "지면을 미리 잘라 둔 것"과 같은 방식으로 함. 마스크 노드는 숨김)
 * - 두더지 굴 나오기·들어가기 (moleActor enterBurrow / exitBurrow), 굴 사이는 땅속으로 이동 (들어가기 → 카메라 이동 → 나오기)
 * - 카메라: 휠·핀치로 로그 스케일 줌. 두더지가 화면에서 약 12px 이 될 때까지 멀리 빠지고, 멀어질수록 내려다봄.
 *   땅 1600×1600, 카메라 far·안개를 거리에 맞춰 늘림. 꽃은 멀리서 점 하나로 (LOD)
 * - 충돌: 표지판 기둥·굴 흙더미·큰 덤불·큰 돌에 원형 콜라이더. 카메라와 두더지 사이에 표지판이 끼면 반투명
 */

export interface FieldSceneOptions {
  focusX?: number
  /** 내 두더지 액세서리 (없으면 기본 착용) */
  worn?: string[]
  /** 이웃 굴 id (앞 2개는 Figma 둔덕 자리, 나머지는 멀리). 'me' = 내 굴은 따로 있음 */
  holes?: string[]
  /** 주면 이 굴에서 mole_burrow_exit 로 나오며 시작 (없으면 내 굴 앞에 서 있음) */
  startHole?: string
  /** 휠·핀치 줌 (탐색하기). 둘러보기(LookAround)는 화면 위 단추 자리가 고정이라 끔 */
  zoom?: boolean
}

/** 탐색하기에서 쓰는 장면 손잡이 */
export interface FieldHandle extends SceneHandle {
  /** 그 굴로 땅속 이동: 지금 굴로 걸어가 들어가기 → 카메라 이동 → 그 굴에서 나오기 */
  travelTo(id: string): void
  /** 굴에 들어가기 (id 굴이 가까우면 거기, 아니면 가장 가까운 굴). 다 들어가면 done (화면 전환) */
  enterHole(id: string | null, done: () => void): void
  /** 밭에서 흙더미를 눌러 굴을 고르거나 굴에 도착했을 때 */
  onHole(cb: ((id: string) => void) | null): void
}

export const MY_HOLE = 'me'

const SW = 1440, SH = 897 // 원본 장면 좌표계
// 원본 캡처(2000폭 표시 기준)의 좌표 → 장면 좌표
const D = (dx: number, dy: number): [number, number] => [dx * 0.72, (dy - 87) * 0.72]
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const smooth = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u) }

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
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public low: THREE.BufferGeometry, public shadow = true) {}
  push(matrix: THREE.Matrix4, color: string) { this.m.push(matrix.clone()); this.c.push(new THREE.Color(color)) }
  build(scene: THREE.Object3D, lite: boolean) {
    if (!this.m.length) return
    const im = this.im = new THREE.InstancedMesh(lite ? this.low : this.geo, this.mat, this.m.length)
    this.m.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, this.c[i]) })
    im.castShadow = this.shadow; im.receiveShadow = true; scene.add(im)
  }
  /** 자동으로 저사양이 됐을 때 지오메트리만 바꿔 끼움 */
  useLow() { if (this.im && this.im.geometry !== this.low) { this.im.geometry = this.low; this.geo.dispose() } }
  set visible(on: boolean) { if (this.im) this.im.visible = on }
}

interface Hole { id: string; c: THREE.Vector3; group?: THREE.Object3D }
interface Collider { x: number; z: number; r: number }
interface Fader { box: THREE.Box3; mats: THREE.Material[]; op: number }

export function mountFieldScene(container: HTMLElement, opts: FieldSceneOptions = {}): FieldHandle {
  // 품질 (engine.ts). 저사양: 후처리(N8AO·색보정) 없이 renderer.render, 해 그림자 맵 대신 발밑 그림자 판, 해상도 0.55배, 15fps, 쉬면 멈춤
  const q = quality()
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  /*
   * A 배경 한 번 + 두더지만 (lib/lowLab.ts, staticBackdrop.ts): 저사양이고 실험실 A 가 켜져 있으면
   * 밭(움직이지 않는 것 전부)은 렌더 타깃에 한 번만 그리고, 매 프레임은 그것을 붙인 뒤 두더지 층만 그림.
   * 저사양으로 시작했으면 지난 그림을 남겨 두고(preserveDrawingBuffer) 두더지 둘레 사각형만 다시 그림 (땅굴 부분 그리기와 같은 방식)
   * 카메라가 움직이면(줌·굴 이동) 배경을 다시 찍음
   */
  const useBackdrop = () => q.level === 'low' && !!q.lab?.A
  const scissorOk = useBackdrop()
  const renderer = createRenderer(container, { exposure: 1.0, shadowType: THREE.PCFShadowMap, quality: q, preserve: scissorOk })
  let backdrop: Backdrop | null = useBackdrop() ? createBackdrop(renderer) : null
  /*
   * E 2D 두더지 (시험판, moleSprites.ts): 두더지를 그림으로 한 번 찍어 두고, 밭은 바뀔 때만 3D로 그리고
   * 매 프레임은 위에 얹은 2D 캔버스에 두더지 그림만 붙임 (3D 그리기 0). 가림(꽃 뒤로 지나가기)은 없어짐.
   * 굴 나오기·들어가기 동작은 그림이 없어서 건너뜀 (걷기·돌기만 하고 바로 사라지거나 착지점에 나타남)
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
  const FOG_NEAR = 30, FOG_FAR = 150
  const fog = new THREE.Fog('#c4e3a4', FOG_NEAR, FOG_FAR)
  scene.fog = fog

  // 배치 계산용 카메라: 원본 비율 그대로 (화면 구도는 렌더할 때 view offset 으로 맞춤)
  const PITCH0 = THREE.MathUtils.degToRad(10.7)
  const CAM0 = new THREE.Vector3(0, 2.7, 8)
  const camera = new THREE.PerspectiveCamera(40, SW / SH, 0.1, 400)
  camera.position.copy(CAM0)
  camera.rotation.set(-PITCH0, 0, 0)
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
  // 해와 그림자 범위는 카메라가 보는 곳(굴 이동)을 따라감. 처음 자리: 해 (-11, 13, 4) → 과녁 (0, 0, -6)
  const SUN_OFF = new THREE.Vector3(-11, 13, 10)
  const sun = new THREE.DirectionalLight('#fff6e8', 2.3)
  sun.position.set(-11, 13, 4); sun.target.position.set(0, 0, -6)
  sun.layers.enable(1) // 두더지 층(layer 1)도 해를 받음
  sun.castShadow = q.shadows; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 })
  scene.add(sun, sun.target)

  /* ---------- 땅 ---------- */
  // 크기 1600 (멀리 빠져도 가장자리가 안개 밖). 분할 수: 원래 240. 저사양은 96 (먼 언덕만 굴곡이 있어서 차이가 거의 안 보임)
  const GROUND = 1600
  const groundGeo = (seg: number) => {
    const geo = new THREE.PlaneGeometry(GROUND, GROUND, seg, seg); geo.rotateX(-Math.PI / 2)
    const pa = geo.attributes.position
    for (let i = 0; i < pa.count; i++) pa.setY(i, groundHeight(pa.getX(i), pa.getZ(i)))
    geo.computeVertexNormals()
    return geo
  }
  // 굴 구멍 (최대 8개): xyz = (x, z, 반지름). 이 원 안쪽 땅은 그리지 않음 (= ground_move_spec 7번 마스크)
  const MAX_HOLES = 8
  const holeU = { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector3()) }
  const holeN = { value: 0 }
  let ground: THREE.Mesh
  {
    const c = document.createElement('canvas'); c.width = c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#9ccc58'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(170,225,95,.18)' : 'rgba(95,165,45,.14)'; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, 7); g.fill() }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30 * GROUND / 600, 30 * GROUND / 600)
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: '#f4f8e4' })
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHoles = holeU; sh.uniforms.uHoleN = holeN
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vHoleXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vHoleXZ;\nuniform vec3 uHoles[${MAX_HOLES}];\nuniform int uHoleN;`)
        .replace('void main() {', `void main() {\n  for (int i = 0; i < ${MAX_HOLES}; i++) { if (i >= uHoleN) break; vec2 dh = vHoleXZ - uHoles[i].xy; if (dot(dh, dh) < uHoles[i].z * uHoles[i].z) discard; }`)
    }
    mat.customProgramCacheKey = () => 'field-ground-holes'
    ground = new THREE.Mesh(groundGeo(q.post ? 240 : 96), mat)
    ground.name = 'ground'
    ground.receiveShadow = true; scene.add(ground)
  }

  /* ---------- 인스턴스 모음 (꽃·덤불·돌) ---------- */
  const white = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, ...o })
  const lowBall = () => new THREE.SphereGeometry(1, 8, 6)
  const I = {
    ball: new Inst(new THREE.SphereGeometry(1, 20, 14), white({ bumpMap: NOISE, bumpScale: .3 }), lowBall()),
    petal: new Inst(new THREE.SphereGeometry(1, 12, 8), white(), new THREE.SphereGeometry(1, 6, 3)),
    core: new Inst(new THREE.SphereGeometry(1, 14, 10), white(), new THREE.SphereGeometry(1, 7, 5)),
    stem: new Inst(new THREE.CylinderGeometry(1, 1, 1, 6), white(), new THREE.CylinderGeometry(1, 1, 1, 4, 1, true)),
    leaf: new Inst(new THREE.SphereGeometry(1, 10, 6), white(), new THREE.SphereGeometry(1, 5, 3)),
    // 멀리 빠졌을 때 꽃 대신 보이는 점 (꽃 머리 색 하나). 꽃잎·줄기·잎은 숨김 (LOD)
    dot: new Inst(lowBall(), white(), lowBall(), false),
    // 멀리 흩뿌린 것 (처음 구도에선 거의 안 보이고 줌아웃 때 보임): 처음부터 거친 지오메트리, 그림자 없음
    farBall: new Inst(lowBall(), white(), lowBall(), false),
    farDot: new Inst(lowBall(), white(), lowBall(), false),
  }
  const DETAIL = [I.petal, I.core, I.stem, I.leaf]
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
    place(I.dot, petalC, (p) => p.position.copy(pos), (c) => { c.position.y = h * .8; c.scale.set(s * .55, s * .5, s * .55) })
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

  /* ---------- 충돌: 원형 콜라이더 (표지판 기둥, 굴 흙더미, 큰 덤불, 큰 돌) ---------- */
  const colliders: Collider[] = []
  let moleR = .25   // 두더지 몸 반지름 (장면 단위, 두더지를 불러온 뒤 0.32 × scale)

  /* ---------- 나무 표지판 ---------- */
  const faders: Fader[] = []
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
    // 기둥 밑동 콜라이더: 기둥 두께(pw)의 반보다 조금 크게
    colliders.push({ x: base.x, z: base.z, r: pw * .75 })
    g.updateMatrixWorld(true)
    faders.push({ box: new THREE.Box3().setFromObject(g), mats: [post, board, cap].map((m) => m.material as THREE.Material), op: 1 })
    return g
  }

  /* ---------- 굴 자리 ---------- */
  // Figma 둔덕 자리 (원본 좌표의 왼쪽 끝·오른쪽 끝 → 가운데)
  const moundCenter = (lx: number, rx: number, y: number) => PD(lx, y).lerp(PD(rx, y), .5)
  // 두더지 자리: 발 위치와 머리 꼭대기를 원본에 맞춤 (두더지는 glb를 받은 뒤 놓음)
  const home = PD(986, 1128)
  const moleH = heightTo(home, D(0, 786)[1])   // 원본 그림에서 두더지 키 (장면 단위)
  // 핸드오프 두더지는 키 약 1.0 (glb 단위) → scale 추정. 불러온 뒤 실제 상자로 다시 잼 (굴 위치는 그대로, 크기만 맞춤)
  let S = moleH / 1.0
  const FRONT = 1.75   // 굴 중심 → 굴 앞 도착·착지점 (ground_move_spec 5번, glb 단위)
  // 이웃 굴 id 가 없으면(둘러보기) Figma 둔덕 자리 둘만 이름 없이
  const ids = opts.holes ?? ['_left', '_right']
  const farSpots = [new THREE.Vector3(-13, 0, -13), new THREE.Vector3(14, 0, -16), new THREE.Vector3(-2, 0, -27), new THREE.Vector3(-26, 0, -26), new THREE.Vector3(27, 0, -30)]
  const holes: Hole[] = [{ id: MY_HOLE, c: new THREE.Vector3(home.x, 0, home.z - FRONT * S) }]
  ids.slice(0, MAX_HOLES - 1).forEach((id, i) => {
    const c = i === 0 ? moundCenter(135, 700, 625) : i === 1 ? moundCenter(1330, 1915, 680) : home.clone().add(farSpots[(i - 2) % farSpots.length])
    holes.push({ id, c: c.setY(0) })
  })
  const holeById = (id: string) => holes.find((h) => h.id === id)
  const frontOf = (h: Hole) => new THREE.Vector3(h.c.x, 0, h.c.z + FRONT * S)
  const HOLE_R = 1.35   // 흙더미 콜라이더 반지름 (glb 단위. 흙더미 바깥 1.3~1.4, 도착점 1.75 보다 안쪽)

  sign(PD(740, 668), D(0, 478)[1], 1.7, .72, .05)
  sign(PD(1282, 700), D(0, 535)[1], 1.75, .72, -.12, .06)
  sign(PD(1488, 962), D(0, 708)[1], 1.3, .5, -.05)

  // 다닐 수 있는 곳: 굴들을 감싸는 네모 안, 콜라이더 밖
  const bounds = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: home.z + 1.6 }
  for (const h of holes) { bounds.x0 = Math.min(bounds.x0, h.c.x - 5); bounds.x1 = Math.max(bounds.x1, h.c.x + 5); bounds.z0 = Math.min(bounds.z0, h.c.z - 4) }
  bounds.x0 = Math.min(bounds.x0, home.x - 4.2); bounds.x1 = Math.max(bounds.x1, home.x + 4.2)
  const clampWalk = (p: THREE.Vector3) => {
    p.x = THREE.MathUtils.clamp(p.x, bounds.x0, bounds.x1)
    p.z = THREE.MathUtils.clamp(p.z, bounds.z0, bounds.z1)
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + moleR, d = Math.hypot(dx, dz)
        if (d < rr) { const k = rr / (d || 1); p.x = c.x + (d ? dx * k : rr); p.z = c.z + dz * k }
      }
    }
    return p
  }

  // 방 안과 같은 glb 두더지 (moleActor). 이동 속도 배율은 moleActor 의 MOVE_SPEED_MULT 로 같이 적용됨.
  // 정면 +Z = 카메라 쪽. 핸드오프 두더지는 키가 약 1.0 이라 원본 그림의 키(moleH)에 맞게 scale.
  let mole: MoleActor | null = null
  let disposed = false
  let busyMove = false             // 굴 이동·들어가기 중 (입력 막음)
  let queued: (() => void) | null = null
  let holeCb: ((id: string) => void) | null = null
  let curHole: Hole = holeById(opts.startHole ?? MY_HOLE) ?? holes[0]
  const pending: { enter?: { id: string | null; done: () => void } } = {}

  const placeBurrows = (props: GLTF) => {
    const src = props.scene.getObjectByName('burrow')
    if (!src) { console.warn('[3D] ground_props 에 burrow 가 없어요'); return }
    const signSrc = props.scene.getObjectByName('signpost')
    holes.forEach((h, i) => {
      const b = src.clone(true)
      b.scale.setScalar(S)
      // 굴 중심 = 지면 높이 - 0.033 (ground_move_spec 5·7번). 다이브 방향(로컬 -Z)이 카메라 반대쪽 = 회전 0
      b.position.set(h.c.x, groundHeight(h.c.x, h.c.z) - .033 * S, h.c.z)
      b.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        if (o.name === 'burrow_ground_mask') { o.visible = false; return }   // 땅은 셰이더에서 잘라서 마스크는 숨기기만
        m.castShadow = true; m.receiveShadow = true
        // 흙더미 안쪽이 어둡게 보이려면 버텍스 컬러가 켜져 있어야 함 (GLTFLoader 가 COLOR_0 이 있으면 켬. 확인 겸)
        if (o.name === 'burrow_mound' && m.geometry.getAttribute('color')) (m.material as THREE.MeshStandardMaterial).vertexColors = true
      })
      b.userData.hole = h.id
      scene.add(b)
      h.group = b
      if (i < MAX_HOLES) holeU.value[i].set(h.c.x, h.c.z, .8 * S)
      colliders.push({ x: h.c.x, z: h.c.z, r: HOLE_R * S })
      // 멀리 있는 굴(Figma 표지판이 없는 굴)에는 핸드오프 나무 표지판. 착지점(앞 1.75)을 막지 않게 왼쪽 앞에
      if (signSrc && i >= 3) {
        const sp = signSrc.clone(true)
        sp.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); m.castShadow = true; m.receiveShadow = true } })
        sp.scale.setScalar(S * 1.25)
        sp.position.set(h.c.x - 1.9 * S, groundHeight(h.c.x, h.c.z), h.c.z + .9 * S)
        sp.rotation.y = .35
        scene.add(sp)
        sp.updateMatrixWorld(true)
        colliders.push({ x: sp.position.x, z: sp.position.z, r: .1 * S * 1.25 })
        const mats: THREE.Material[] = []
        sp.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) mats.push(m.material as THREE.Material) })
        faders.push({ box: new THREE.Box3().setFromObject(sp), mats, op: 1 })
      }
    })
    holeN.value = Math.min(holes.length, MAX_HOLES)
    backdrop?.invalidate()
  }

  Promise.all([loadMoleGltf(), loadAccessories(), loadGlb(groundPropsUrl).catch((err) => { console.warn('[3D] 굴 모델을 못 불러왔어요', err); return null })]).then(([moleG, acc, props]) => {
    if (disposed) return
    // 동작 확인 (사용자 요청: 굴 나오기·들어가기가 안 보이면 이름 목록부터)
    const names = moleG.animations.map((a) => a.name)
    const need = ['mole_burrow_exit', 'mole_burrow_enter', 'mole_walk', 'mole_turn', 'mole_idle', 'mole_look_around', 'mole_ground_scratch']
    const missing = need.filter((n) => !names.includes(n))
    console.info(`[3D] 두더지 동작 ${names.length}개: ${names.join(', ')}${missing.length ? ` — 없음: ${missing.join(', ')}` : ''}`)
    const box = new THREE.Box3().setFromObject(moleG.scene)
    S = moleH / Math.max(box.max.y - box.min.y, 1e-3)
    moleR = .32 * S
    if (props) placeBurrows(props)
    const start = frontOf(curHole)
    const exitAnim = !!opts.startHole
    mole = createMoleActor(moleG, {
      scale: S, start, yaw: 0, drop: false, clamp: clampWalk, groundAt: groundHeight,
      lookEvery: [2.5, 5],   // 가만히 있으면 mole_idle 과 mole_look_around 를 번갈아
      acc, worn: opts.worn ?? getMyWorn(),
      simple: q.level === 'low' && !!q.lab?.F,   // F 단순한 두더지 (lib/lowLab.ts)
    })
    scene.add(mole.object)
    toDynamicLayer(mole.object)
    moleBlob.scale.set(moleH * .95, 1, moleH * .95); moleBlob.visible = true
    if (exitAnim && props) {
      busyMove = true
      mole.exitBurrow(curHole.c, { instant: reduce, skipClip: useSprite, done: finishMove })
    }
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
    // 불러오는 동안 눌린 것
    if (pending.enter) { const e = pending.enter; pending.enter = undefined; enterHole(e.id, e.done) }
  }).catch((err) => console.warn('[3D] 두더지를 못 불러왔어요', err))
  const unbindKeys = bindDriveKeys((x, z) => { if (busyMove) return; mole?.drive(x, z); loop.wake() }, { arrows: false })   // WASD로 조종 (←/→는 이웃 땅굴 넘기기)

  // 앞쪽 손으로 놓은 것들 (원본 위치). 큰 덤불·큰 돌은 콜라이더
  const bigBush = (p: THREE.Vector3, s: number) => { bush(p, s); colliders.push({ x: p.x, z: p.z, r: s * .95 }) }
  bigBush(PD(165, 1150), .45); bigBush(PD(1610, 1250), .42); bigBush(PD(1875, 905), .5); bigBush(PD(25, 905), .45); bigBush(PD(60, 735), .4)
  bigBush(PD(1065, 570), .45); bigBush(PD(1700, 505), .4)
  ;[[80, 1265, .32], [150, 1215, .26], [1945, 1260, .3], [440, 765, .32], [1370, 940, .33], [790, 615, .22], [1215, 685, .25], [1300, 712, .22], [1930, 560, .2]].forEach(([x, y, s]) => flower(PD(x, y), s, 'daisy'))
  ;[[165, 1265, .24], [1800, 1085, .22], [1890, 1100, .22], [1975, 775, .28], [10, 660, .25]].forEach(([x, y, s]) => flower(PD(x, y), s, 'coral'))
  pebble(PD(435, 1235), .2, '#7a5a4b'); pebble(PD(630, 1212), .14, '#f1e3c8'); pebble(PD(52, 993), .2, '#f1e3c8'); pebble(PD(590, 1218), .1, '#8a6a5a')
  ;[[480, 795, .32], [413, 853, .3], [540, 975, .34], [75, 655, .2], [1960, 722, .22], [612, 710, .14]].forEach(([x, y, s]) => {
    const p = PD(x, y); pebble(p, s, '#df7f43')
    if (s >= .3) colliders.push({ x: p.x, z: p.z, r: s * .8 })
  })

  // 멀리 흩뿌리기 (굴·두더지 자리는 비움)
  const blocked = (p: THREE.Vector3) => {
    for (const h of holes) { const dx = p.x - h.c.x, dz = p.z - h.c.z; if (dx * dx + dz * dz < (2.1 * S) ** 2) return true }
    if (Math.abs(p.x - home.x) < 1.6 && p.z > home.z - 3.5 && p.z < home.z + 2) return true // 두더지 주변
    return false
  }
  const inWedge = (x: number, z: number) => z < -4 && z > -95 && Math.abs(x) < (8 - z) * .62
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
    if (r < .4) { const s = rnd(.22, .42); bush(p, s); if (s > .36 && dist < 40) colliders.push({ x: p.x, z: p.z, r: s * .9 }) }
    else if (r < .72) flower(p, rnd(.18, .28), 'daisy')
    else if (r < .87) flower(p, rnd(.18, .26), 'coral')
    else pebble(p, rnd(.08, .18), Math.random() < .5 ? '#df7f43' : '#8a6a5a')
  }
  // 처음 구도 밖(옆·뒤·아주 먼 곳)은 줌아웃 때만 보임 → 거친 공 몇 개짜리 덤불과 점 꽃으로 가볍게
  {
    const n = q.post ? 1600 : 700
    const farCols = ['#5aae36', '#6abb40', '#7fc64e', '#97d062']
    for (let i = 0; i < n; i++) {
      const x = rnd(-170, 170), z = rnd(-190, 70)
      if (inWedge(x, z) || Math.hypot(x - home.x, z - home.z) < 6) continue
      const p = new THREE.Vector3(x, groundHeight(x, z), z)
      if (blocked(p)) continue
      const r = Math.random()
      if (r < .45) {
        const s = rnd(.25, .5)
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * 6.28, d = rnd(0, .6) * s, rr = s * rnd(.5, .8)
          place(I.farBall, farCols[Math.floor(Math.random() * farCols.length)], (o) => o.position.copy(p), (c) => { c.position.set(Math.cos(a) * d, rr * .75, Math.sin(a) * d * .7); c.scale.set(rr, rr * .9, rr) })
        }
        if (s > .4 && Math.hypot(x - home.x, z - home.z) < 45) colliders.push({ x, z, r: s * .9 })
      } else if (r < .9) {
        const s = rnd(.2, .3), col = Math.random() < .6 ? '#fff6e9' : '#f5837a'
        place(I.farDot, col, (o) => o.position.copy(p), (c) => { c.position.y = s * 1.3; c.scale.set(s * .6, s * .5, s * .6) })
      } else {
        const s = rnd(.1, .2)
        place(I.farBall, Math.random() < .5 ? '#df7f43' : '#8a6a5a', (o) => o.position.copy(p), (c) => { c.position.y = s * .25; c.scale.set(s, s * .45, s * .75) })
      }
    }
  }
  Object.values(I).forEach((i) => i.build(scene, !q.post))
  I.dot.visible = false

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

  /* ---------- 카메라: 줌(로그 스케일) + 굴 따라 이동 ---------- */
  // 처음 구도 = 카메라 (0, 2.7, 8), 10.7° 내려다봄. 그 시선이 땅에 닿는 점(T0)을 중심으로 뒤로·위로 빠짐
  const D0 = CAM0.y / Math.sin(PITCH0)
  const T0 = new THREE.Vector3(0, 0, CAM0.z - D0 * Math.cos(PITCH0))
  const PITCH_MAX = THREE.MathUtils.degToRad(50)
  const PITCH_FULL_ZL = Math.log(6)   // 6배 멀어지면 가장 많이 내려다봄
  const ZL_MIN = Math.log(.8)
  let zlMax = Math.log(30)        // 두더지가 약 12px 이 되는 거리 (resize 에서 다시 잼)
  let zl = 0, zlTarget = 0
  const pan = new THREE.Vector3()  // 굴 이동: 지금 굴 착지점 - 내 굴 착지점
  const panOf = (h: Hole) => new THREE.Vector3(h.c.x - holes[0].c.x, 0, h.c.z - holes[0].c.z)
  pan.copy(panOf(curHole))
  let camAnim: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done: () => void } | null = null
  let bump = 0
  let lodFar = false
  let camDirty = true
  const camTarget = new THREE.Vector3()
  const placeCamera = () => {
    const l = zl + bump
    const z = Math.exp(l)
    const pitch = PITCH0 + (PITCH_MAX - PITCH0) * smooth(l / PITCH_FULL_ZL)
    const dist = D0 * z
    camTarget.copy(T0).add(pan)
    camera.position.set(camTarget.x, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(pitch) * dist)
    camera.rotation.set(-pitch, 0, 0)
    // 안개·far 를 거리에 맞춰 (처음 구도에서는 원래 값 30 / 150 / 400)
    const extra = Math.max(0, dist - D0)
    fog.near = FOG_NEAR + extra * .8
    fog.far = FOG_FAR + extra * 1.8
    camera.near = .1 * Math.max(1, z * .5)
    camera.far = Math.max(400, fog.far * 1.4 + 100)
    camera.updateProjectionMatrix(); camera.updateMatrixWorld()
    // 해·그림자 범위도 따라감 (멀리 빠지면 범위를 조금 넓힘)
    sun.target.position.set(pan.x, 0, -6 + pan.z); sun.target.updateMatrixWorld()
    sun.position.copy(sun.target.position).add(SUN_OFF)
    const k = THREE.MathUtils.clamp(z, 1, 2.5) * 16, sc = sun.shadow.camera
    if (sc.right !== k) { Object.assign(sc, { left: -k, right: k, top: k, bottom: -k }); sc.updateProjectionMatrix() }
    // LOD: 두더지가 약 36px 보다 작아지면 꽃은 점 하나로
    const far = l > zlMax - Math.log(3)
    if (far !== lodFar) { lodFar = far; DETAIL.forEach((i) => { i.visible = !far }); I.dot.visible = far }
  }

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  const applyFrame = () => {
    // cover: 원본 1440×897 장면이 캔버스를 꽉 채우게 키우고, 가로 가운데를 focusX에
    const k = Math.max(W / SW, H / SH), bw = SW * k, bh = SH * k
    frameCamera(camera, W, H, { left: focus * W - bw / 2, top: (H - bh) / 2, w: bw, h: bh })
    // 두더지(내 굴 앞) 키가 화면에서 12px 이 되는 줌을 찾음 (멀어질수록 내려다봐서 계산 대신 실제로 투영해 봄)
    const keep = zl
    const pxAt = (l: number) => {
      zl = l; placeCamera()
      const a = corner.copy(home).project(camera).y, b = corner.copy(home).setY(moleH).project(camera).y
      return Math.abs(b - a) / 2 * H
    }
    let lo = 0, hi = Math.log(60)
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (pxAt(m) > 12) lo = m; else hi = m }
    zlMax = Math.max(Math.log(3), lo)
    zl = Math.min(keep, zlMax); zlTarget = Math.min(zlTarget, zlMax)
    placeCamera()
    camDirty = true
    backdrop?.invalidate()
  }

  /* ---------- 표지판 반투명 (카메라와 두더지 사이에 끼면) ---------- */
  const occRay = new THREE.Ray(), occHit = new THREE.Vector3(), moleHead = new THREE.Vector3()
  const updateFaders = (dt: number) => {
    if (!mole || !faders.length) return false
    moleHead.copy(mole.object.position); moleHead.y += moleH * .55
    occRay.origin.copy(camera.position); occRay.direction.copy(moleHead).sub(camera.position)
    const toMole = occRay.direction.length(); occRay.direction.normalize()
    let changed = false
    for (const f of faders) {
      const hit = !mole.isHidden() && occRay.intersectBox(f.box, occHit) && occHit.distanceTo(camera.position) < toMole - moleH * .3
      const want = hit ? .3 : 1
      if (Math.abs(f.op - want) < .005) continue
      f.op = dt === 0 || reduce ? want : approach(f.op, want, dt, .08)
      if (Math.abs(f.op - want) < .01) f.op = want
      for (const m of f.mats) {
        const tr = f.op < .999
        if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true }
        m.opacity = f.op
      }
      changed = true
    }
    return changed
  }

  /* ---------- A: 배경 한 번 + 두더지 둘레만 ---------- */
  let fullNext = true
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  let prevRect: Rect | null = null
  const corner = new THREE.Vector3()
  const moleRect = (): Rect | null => {
    if (!mole) return null
    const p = mole.object.position, h = moleH * .75, r: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    // 굴 동작 중에는 뼈대가 굴 중심에서 1.75 앞까지 움직이므로 상자를 그만큼 넓힘
    const ext = mole.isIdle() ? 0 : FRONT * S
    for (let i = 0; i < 8; i++) {
      corner.set(p.x + (i & 1 ? h : -h) + moleH * .1, p.y + (i & 2 ? moleH * 1.45 : -.05), p.z + (i & 4 ? h + ext : -h - ext)).project(camera)
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
    if (mole.isHidden()) return
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
    const i = walk ? Math.floor(spriteT * 9) % 6 : Math.floor(spriteT * 2) % 4
    const c = sprites.cell(dir, walk, i)
    ctx.drawImage(sprites.atlas, c.sx, c.sy, sprites.S, sprites.S, fx - drawH / 2, fy - sprites.footY * drawH, drawH, drawH)
  }

  const camMoving = () => !!camAnim || Math.abs(zl - zlTarget) > 1e-4
  const frame = (dt: number) => {
    let full = fullNext || dt === 0
    fullNext = false
    if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); full = true }
    // 줌: 로그 공간에서 목표로 다가감 → 화면에서 보이는 속도가 거리에 비례
    if (Math.abs(zl - zlTarget) > 1e-4) { zl = Math.abs(zl - zlTarget) < 2e-4 ? zlTarget : approach(zl, zlTarget, dt, .1); camDirty = true }
    if (camAnim) {
      const a = camAnim
      a.t += dt
      const u = a.dur > 0 ? Math.min(1, a.t / a.dur) : 1
      pan.lerpVectors(a.from, a.to, smooth(u))
      // 멀리 갈수록 살짝 멀어졌다가 다시 가까워짐
      bump = Math.sin(Math.PI * u) * Math.min(.45, a.from.distanceTo(a.to) / 30)
      camDirty = true
      if (u >= 1) { bump = 0; camAnim = null; a.done() }
    }
    if (camDirty) { placeCamera(); camDirty = false; full = true; backdrop?.invalidate() }
    mole?.update(dt)
    if (updateFaders(dt)) { full = true; backdrop?.invalidate() }
    // 발밑 그림자 판: 숨었거나 굴 동작 중(두더지 원점이 굴 중심)이면 숨김
    if (mole) moleBlob.visible = !sprites && !mole.isHidden() && !holes.some((h) => Math.hypot(h.c.x - mole!.object.position.x, h.c.z - mole!.object.position.z) < .5 * S)
    if (mole) moleBlob.position.set(mole.object.position.x + moleH * .1, groundHeight(mole.object.position.x, mole.object.position.z) + .025, mole.object.position.z - moleH * .08)
    if (sprites) { if (full) renderer.render(scene, camera); drawSprite(dt) }
    else if (post) post.composer.render(dt)
    else if (backdrop) drawBackdrop(full)
    else renderer.render(scene, camera)
  }
  const loop = startLoop(container, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      post?.setSize(w, h)
      applyFrame()
      fullNext = true
    },
    frame,
    busy: () => (!!mole && !mole.isResting()) || focus !== focusTarget || camMoving() || busyMove,
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

  /* ---------- 굴 이동 ---------- */
  const nearestHole = () => {
    if (!mole) return curHole
    const p = mole.object.position
    let best = holes[0], bd = Infinity
    for (const h of holes) { const f = frontOf(h), d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = h } }
    return best
  }
  function finishMove() {
    busyMove = false
    const next = queued; queued = null
    next?.()
    loop.wake()
  }
  function travelTo(id: string) {
    const to = holeById(id)
    if (!to) return
    if (!mole) { curHole = to; pan.copy(panOf(to)); camDirty = true; loop.wake(); return }
    if (busyMove) { queued = () => travelTo(id); return }
    const from = nearestHole()
    if (from === to && mole.object.position.distanceTo(frontOf(to).setY(mole.object.position.y)) < 1.2 * S) { curHole = to; return }
    busyMove = true
    const skipClip = !!sprites
    // 1) 지금 굴로 걸어가 들어가기  2) 카메라가 대상 굴로  3) 대상 굴에서 나오기
    mole.enterBurrow(from.c, {
      instant: reduce, skipClip,
      done: () => {
        camAnim = {
          from: pan.clone(), to: panOf(to), t: 0,
          dur: reduce ? 0 : THREE.MathUtils.clamp(.6 + from.c.distanceTo(to.c) / 18, .8, 2),
          done: () => { curHole = to; mole?.exitBurrow(to.c, { instant: reduce, skipClip: !!sprites, done: finishMove }) },
        }
        loop.wake()
      },
    })
    loop.wake()
  }
  function enterHole(id: string | null, done: () => void) {
    if (reduce || disposed) { done(); return }
    if (!mole) { pending.enter = { id, done }; return }
    if (busyMove) { queued = () => enterHole(id, done); return }
    const want = id ? holeById(id) : undefined
    const p = mole.object.position
    const h = want && Math.hypot(frontOf(want).x - p.x, frontOf(want).z - p.z) < 6 * S ? want : nearestHole()
    busyMove = true
    let called = false
    const once = () => { if (!called) { called = true; done() } }
    // 혹시 걷다가 막혀 멈춰도 화면은 넘어가게
    window.setTimeout(once, 15000)
    mole.enterBurrow(h.c, { skipClip: !!sprites, done: once })
    loop.wake()
  }

  /* ---------- 입력: 땅·흙더미 누르기, 휠·핀치 줌 ---------- */
  const el = renderer.domElement
  const ndc = new THREE.Vector2()
  let down: { x: number; y: number } | null = null
  const pts = new Map<number, { x: number; y: number }>()
  let pinch = 0
  const onDown = (e: PointerEvent) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); down = null; return }
    down = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (opts.zoom && pts.size === 2 && pinch > 0) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 0) { zlTarget = THREE.MathUtils.clamp(zlTarget - Math.log(d / pinch), ZL_MIN, zlMax); pinch = d; loop.wake() }
    }
  }
  const onUp = (e: PointerEvent) => {
    pts.delete(e.pointerId)
    if (pts.size < 2) pinch = 0
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    if (busyMove || !mole || mole.isHidden()) return
    const rect = el.getBoundingClientRect()
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    // 흙더미를 누르면 그 굴로 (탐색하기만)
    if (opts.zoom) {
      const groups = holes.map((h) => h.group).filter((g): g is THREE.Object3D => !!g)
      const hit = ray.intersectObjects(groups, true)[0]
      if (hit) {
        let o: THREE.Object3D | null = hit.object
        while (o && o.userData.hole === undefined) o = o.parent
        const id = o?.userData.hole as string | undefined
        if (id) { holeCb?.(id); travelTo(id); return }
      }
    }
    const hit = ray.intersectObject(ground, false)[0]
    if (hit) mole.walkTo(hit.point.clone(), { scratch: true })   // 잔디를 누르면 걸어가서 땅 긁기 한 번
  }
  const onCancel = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; down = null }
  const onWheel = (e: WheelEvent) => {
    if (!opts.zoom) return
    e.preventDefault()
    // 로그 스케일: 한 칸(100)에 약 16%. 트랙패드 핀치(ctrl+wheel)는 값이 작아서 더 크게
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)
    zlTarget = THREE.MathUtils.clamp(zlTarget + dy * (e.ctrlKey ? .01 : .0015), ZL_MIN, zlMax)
    loop.wake()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!opts.zoom || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    if (e.key === '-' || e.key === '_') zlTarget = Math.min(zlMax, zlTarget + .45)
    else if (e.key === '=' || e.key === '+') zlTarget = Math.max(ZL_MIN, zlTarget - .45)
    else return
    loop.wake()
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onCancel)
  el.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKey)
  el.style.cursor = 'pointer'
  if (opts.zoom) el.style.touchAction = 'none'

  // 확인용 (?fielddebug 또는 개발 서버): 콘솔·헤드리스 스크린샷에서 장면을 직접 움직임
  if (import.meta.env.DEV || /[?&]fielddebug\b/.test(location.search + location.hash)) {
    (window as unknown as { __field?: unknown }).__field = {
      get mole() { return mole }, camera, holes, colliders, moleH, get S() { return S }, home,
      zoom(z: number) { zlTarget = zl = THREE.MathUtils.clamp(Math.log(z), ZL_MIN, zlMax); camDirty = true; loop.redraw() },
      zoomMax: () => Math.exp(zlMax),
      /** 장면 시간을 sec 초만큼 고정 간격으로 진행하고 그림 (헤드리스는 rAF 가 느려서) */
      step(sec: number, fps = 30) { for (let t = 0; t < sec - 1e-6; t += 1 / fps) frame(1 / fps) },
      moleScreenH() { if (!mole) return 0; const a = mole.object.position.clone().project(camera), b = mole.object.position.clone().setY(mole.object.position.y + moleH).project(camera); return Math.abs(a.y - b.y) / 2 * H },
      travelTo, enterHole, walkTo: (x: number, z: number) => mole?.walkTo(new THREE.Vector3(x, 0, z)),
      busy: () => busyMove,
      freeze: (on: boolean) => loop.setFrozen(on),
      anim: () => mole ? { hidden: mole.isHidden(), pos: mole.object.position.toArray().map((v) => +v.toFixed(3)), yaw: +mole.object.rotation.y.toFixed(3) } : null,
    }
  }

  return {
    resize: () => loop.resize(),
    setFrozen: (on) => loop.setFrozen(on),
    setFocusX(x) {
      focusTarget = x
      if (document.hidden) { focus = x; applyFrame() }
      loop.wake()
    },
    travelTo,
    enterHole,
    onHole(cb) { holeCb = cb },
    dispose() {
      disposed = true
      loop.stop()
      mole?.dispose()
      unbindKeys()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      disposeObject(scene)
      Object.values(I).forEach((i) => { i.geo.dispose(); i.low.dispose() })
      post?.dispose()
      backdrop?.dispose()
      overlay?.remove()
      destroyRenderer(renderer)
    },
  }
}
