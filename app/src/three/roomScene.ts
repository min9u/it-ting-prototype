import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import shellUrl from '../assets/models/room_shell_v3_draco_webp.glb?url'
import holeUrl from '../assets/models/room_ceiling_hole.glb?url'
import dustUrl from '../assets/models/dust_puff_v1.glb?url'
import { BLOCK_COLORS, FURNITURE_CATALOG, planRoom, type FurnitureRow, type PlannedItem } from '../data/roomPlan'
import { loadGlb } from './glb'
import { DROP_DURATION, DUST_AT, dustOpacity, furnitureDrop } from './furnitureDrop'
import { bindDriveKeys } from './keys'
import { createMoleActor, loadMoleGltf, REACTIONS, type FurnitureData, type MoleActor, type Seat } from './moleActor'
import { loadAccessories } from './moleDress'
import { blobShadow } from './roomLook'
import { approach, createRenderer, destroyRenderer, frameCamera, quality, startLoop, testParam, type SceneHandle } from './engine'
import { createBackdrop, toDynamicLayer } from './staticBackdrop'
import { WALLPAPER_REPEAT, tileUrl, wallpaperForPicks, wallpaperOf } from '../data/wallpapers'

/*
 * 땅굴 방 장면 — 3D 핸드오프 v2 (design/digul_3d_handoff_v2, docs/room_spec.md) + v3 (design/digul_3d_handoff_v3)
 * - 껍데기·소품: 조명을 구운 텍스처(emissive)라 실시간 조명을 받지 않음. 가구·두더지는 실시간 조명
 * - 기본 가구·장식·벽 선반: furniture_catalog.json(app/src/data/furnitureCatalog.json)의 type base·deco 행 glb 를 방 원점에 그대로
 * - 관심사 가구·소품: data/roomPlan.ts 가 slots.json 기준으로 자리를 정함. glb 가 없으면(todo) 카테고리 색 둥근 블록
 *   모델 파일은 assets/models/room/ 에 카탈로그의 glb_compressed 이름 그대로 두면 코드 변경 없이 쓰임
 * - 가구 낙하 "또로로록" + 착지 먼지: furniture_drop_spec.md (값은 slots.json 의 drop). 두더지가 내려온 뒤 시작
 * - 좌표: 1 unit = 1m, 방 중심 바닥 = 원점, 방 지름 6.5m, 돔은 뒤쪽 절반만
 * - 들어올 때: 천장 구멍 열림(0.417초) → 두더지 떨어짐 → 1.5초에 구멍 닫힘 (HANDOFF_v2 2번)
 * - 구도: 스펙 카메라(위치 (0,1.56,6.37), target (0,2.04,0), 세로 FOV 48.5° @4:3)를 4:3 "가상 화면"에 그리고,
 *   가상 화면 높이 = 장면 높이의 114.5%, 위로 5.4% 올림, 가로 가운데 = focusX (Figma 내 땅굴 화면과 돔 크기·위치를 맞춤)
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
  /** 벽지 id (data/wallpapers.ts, 프로필 wallpaper_id). 없으면 관심사로 정함 */
  wallpaper?: string
  /** D 시험판: Worker 안에서 그릴 때 넘겨받은 캔버스 (three/worker/roomWorker.ts) */
  canvas?: OffscreenCanvas
}

/** 방 모델 glb (파일 이름 = 카탈로그의 glb_compressed). 두더지·껍데기는 따로 불러서 여기엔 없음 */
const MODEL_URLS = import.meta.glob<string>('../assets/models/room/*.glb', { eager: true, query: '?url', import: 'default' })
/** sit_clip_set(v3.3) 또는 옛 seat_type → 앉는 동작 묶음. 모르는 값은 방석 */
const seatKind = (v?: string): Seat['kind'] => (v === 'beanbag' || v === 'chair' ? v : 'cushion')
const urlOf = (r: FurnitureRow) => { const f = r.glb_compressed ?? r.glb; return f ? MODEL_URLS[`../assets/models/room/${f}`] : undefined }
/** 가구별 동작 (카탈로그에 없는 정보). 원탁엔 찻주전자·컵이 있어서 커피 */
const ACTS: Record<string, FurnitureData['act']> = { round_table: 'drink' }

const ROOM_R = 3.25            // 방 반지름
const FLOOR_Y = .03            // 러그 위 (두더지 기본 자리)
const MOLE_R = .36             // 두더지 몸 반지름 (폭 약 0.8m)
const HOLE_OPEN = .417, HOLE_CLOSE = 1.5
/** 가구 낙하 시작 (방에 들어온 뒤 초). 천장 구멍이 닫히고(1.5) 숨은 뒤(2.2) 두더지가 착지한 다음 */
const FURN_T0 = 2.4
/*
 * 휠 확대·축소 (2026-11-11 사용자 요청: "스크롤로 확대/축소, 어느 정도 제한")
 * - 기본 거리는 스펙 그대로 (카메라 (0, 1.56, 6.37) → target (0, 2.04, 0), 약 6.39m)
 * - 확대: 스펙 최소 3.2m. 축소: 돔 바깥 흙이 조금 보이는 7.6m 까지
 * - OrbitControls 기본 휠 줌은 끄고 직접 처리: 한 칸에 약 9%씩, 목표 거리로 부드럽게 따라감 (damping)
 *   (원래 문제: 기본 거리 = 최대 거리라 축소가 아예 안 됐고, zoomSpeed .6 이라 한 칸에 3%만 움직여 거의 안 느껴졌음)
 */
const ZOOM_MIN = 3.2, ZOOM_MAX = 7.6
// 확대할수록 바라보는 높이를 천장(2.04)에서 두더지·가구 높이(1.0)로 내림 → 가까이 가도 두더지가 화면에 남음
const TARGET_Y = 2.04, TARGET_Y_NEAR = 1.0

/** 접촉 그림자 판(shadow_*): 깊이를 안 써서 위에 놓인 것을 가리지 않게, 먼저 그림 */
function markShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && /^shadow_/.test(m.name)) { (m.material as THREE.Material).depthWrite = false; m.renderOrder = 1 }
  })
}

/** 모델이 아직 없는 행(status todo)을 대신하는 둥근 블록 (HANDOFF_v3 3번). 원점 = 바닥 가운데, 동물은 알 모양 */
function makeBlock(row: FurnitureRow, size: { w: number; d: number; h: number }, color: string) {
  const { w, d, h } = size
  const geo = row.type === 'pet'
    ? new THREE.SphereGeometry(0.5, 24, 16).scale(w, h, d)
    : new RoundedBoxGeometry(w, h, d, 4, Math.min(w, d, h) * 0.12)
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
  m.name = `block_${row.id}`
  m.position.y = h / 2
  return m
}

export function mountRoomScene(container: HTMLElement, opts: RoomSceneOptions = {}): SceneHandle {
  // 품질 (engine.ts): 저사양이면 해상도 0.55배·안티앨리어싱 끔·15fps·가만히 있으면 멈춤. 그림자·후처리는 원래 안 씀
  const q = quality()
  /*
   * 부분 그리기 (저사양으로 시작했을 때만, 2026-11-11 사용자 제안 "방은 한 번 그려 두고 캐릭터만 움직이게"):
   * 카메라·줌·패널 이동·크기 변경·천장 구멍·가구 낙하·먼지가 없을 때는 두더지(들)가 차지하는 화면 사각형만
   * 지우고 다시 그림 (scissor). 장면 전체를 그 사각형 안에서 그리므로 가구 뒤로 가는 가림은 그대로 맞음.
   * 지난 프레임 그림을 남겨야 해서 preserveDrawingBuffer. 시험용 ?partial=0 으로 끔
   */
  const partial = q.level === 'low' && (q.lab?.P ?? true) && testParam('partial') !== '0'
  // C 저사양 카메라 고정 (lib/lowLab.ts): 돌리기·휠 확대를 끔 → 부분 그리기가 거의 항상 적용됨
  let camLock = q.level === 'low' && !!q.lab?.C
  // F 단순한 두더지 (moleActor simple)
  const simpleMole = q.level === 'low' && !!q.lab?.F
  const renderer = createRenderer(container, { alpha: true, exposure: 1, shadowType: THREE.PCFSoftShadowMap, quality: q, preserve: partial, canvas: opts.canvas })
  renderer.toneMapping = THREE.AgXToneMapping   // Blender 기본(AgX)과 맞춤
  renderer.shadowMap.enabled = false             // 바닥·벽은 그림자가 구워져 있음. 두더지는 발밑 그림자 판
  /*
   * A 배경 한 번 + 움직이는 것만 (lib/lowLab.ts, staticBackdrop.ts. 탐색하기와 같은 방식):
   * 움직이는 것(두더지·집주인·발밑 그림자·천장 구멍·떨어지는 중인 가구·먼지)은 layer 1, 나머지(껍데기·가구·착지한 가구)는 layer 0.
   * layer 0 은 렌더 타깃에 한 번 그려 두고, 매 프레임은 붙인 뒤 layer 1 만 그림 → 방 전체 정점 처리가 매 프레임에서 빠짐.
   * 가구가 착지하면 layer 0 으로 옮기고 배경을 다시 찍음. 카메라·줌·크기가 바뀌어도 다시 찍음
   */
  const backdrop = q.level === 'low' && q.lab?.A ? createBackdrop(renderer) : null
  /*
   * S 방은 선명하게 (2026-11-12 사용자 요청 "두더지 화질은 낮아져도 괜찮은데 방은 GPU 켰을 때처럼"):
   * 방(layer 0)이 멈춰 있으면 고해상도(기기 배율 × 1.5 슈퍼샘플)로 한 번 그려서 WebGL 캔버스 뒤 2D 캔버스에 깔아 둠.
   * WebGL 캔버스(0.55배)는 투명하게 지우고 배경 깊이만 써서 두더지(layer 1)만 그림 → 방은 선명, 두더지만 저해상도.
   * 카메라·패널 이동·천장 구멍·가구 낙하·먼지 중에는 예전처럼 전부 저해상도로 그리고, 끝나고 0.35초 조용하면 다시 찍음.
   * Worker(D)에는 DOM 이 없어서 안 씀. 시험용 ?sharp=0 으로 끔
   */
  const sharp = !!backdrop && !opts.canvas && (q.lab?.S ?? true) && testParam('sharp') !== '0'
  let sharpCv: HTMLCanvasElement | null = null
  /** 2D 캔버스 그림이 지금 구도와 맞음 (보이는 중) */
  let sharpOk = false
  /** 방이 바뀐 뒤 조용히 지난 시간 (초) */
  let settle = 0
  const sharpOff = () => { settle = 0; if (sharpOk) { sharpOk = false; if (sharpCv) sharpCv.style.visibility = 'hidden' } }
  /** 방(layer 0)을 고해상도로 그려 2D 캔버스에 옮김. 끝나면 원래 해상도로 */
  const captureSharp = () => {
    if (!sharpCv) {
      sharpCv = document.createElement('canvas')
      sharpCv.setAttribute('aria-hidden', 'true')
      sharpCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
      container.insertBefore(sharpCv, renderer.domElement)
    }
    const out = Math.min(window.devicePixelRatio || 1, 2)
    // 슈퍼샘플 1.5배, 다만 한 번 그리는 픽셀이 400만을 넘지 않게 (CPU 렌더러에서 한 번에 0.5초 안쪽)
    const ss = Math.max(out, Math.min(out * 1.5, Math.sqrt(4e6 / (W * H))))
    const prevPR = renderer.getPixelRatio()
    renderer.setPixelRatio(ss)
    renderer.setScissorTest(false); renderer.autoClear = true
    camera.layers.set(0)
    renderer.render(scene, camera)
    camera.layers.enable(1)
    sharpCv.width = Math.round(W * out); sharpCv.height = Math.round(H * out)
    const ctx = sharpCv.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, sharpCv.width, sharpCv.height)
    ctx.drawImage(renderer.domElement, 0, 0, sharpCv.width, sharpCv.height)
    renderer.setPixelRatio(prevPR)
    sharpCv.style.visibility = 'visible'
    sharpOk = true
  }
  const scene = new THREE.Scene()
  // 배경은 투명 (페이지 흙색이 보임. 스펙 배경 0x805B38 대신 Figma 화면색을 따름)

  const camera = new THREE.PerspectiveCamera(48.5, 4 / 3, 0.1, 100)
  camera.position.set(0, 1.56, 6.37)
  camera.layers.enable(1) // 평소에는 두 층 모두 그림
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2.04, 0)
  controls.minDistance = ZOOM_MIN; controls.maxDistance = ZOOM_MAX
  controls.enableZoom = false   // 휠은 아래 onWheel 에서 (부드럽게, 범위 제한)
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-15); controls.maxAzimuthAngle = THREE.MathUtils.degToRad(15)
  controls.minPolarAngle = THREE.MathUtils.degToRad(75); controls.maxPolarAngle = THREE.MathUtils.degToRad(94.3)
  controls.enablePan = false
  // 감속: 프레임마다 적용되는 값이라 15fps(저사양)에서는 크게 해야 60fps 때와 비슷한 시간에 멈춤 (그래야 루프도 빨리 쉼)
  const damping = () => (q.maxFps ? .4 : .12)
  controls.enableDamping = true; controls.dampingFactor = damping()
  controls.rotateSpeed = .5; controls.zoomSpeed = .6
  controls.enabled = !camLock
  controls.update()

  // 조명 (room_spec 3번. glTF 와트 변환 ×683 쓰지 않음)
  const amb = new THREE.AmbientLight(0xF0B47A, 0.785); scene.add(amb)
  const bulb = new THREE.PointLight(0xFFDDB3, 48.4, 0, 2); bulb.position.set(0, 2.436, -0.455); scene.add(bulb)
  const fill = new THREE.DirectionalLight(0xFFE7CB, 1.8); fill.position.set(0, 2.86, 4.55); fill.target.position.set(0, 1, 0); scene.add(fill, fill.target)
  for (const l of [amb, bulb, fill]) l.layers.enable(1) // 움직이는 층도 같은 조명

  const furniture = new THREE.Group(); furniture.name = 'furniture'; scene.add(furniture)
  /** 두더지가 못 들어가는 가구 바닥 영역 (월드 xz 사각형, 두더지 반지름만큼 넓힘) */
  const feet: { x0: number; x1: number; z0: number; z1: number }[] = []

  const clampRoom = (p: THREE.Vector3) => {
    const fr = ROOM_R - .5, d = Math.hypot(p.x, p.z)
    if (d > fr) { p.x *= fr / d; p.z *= fr / d }
    for (let k = 0; k < 2; k++) for (const f of feet) {
      if (p.x <= f.x0 || p.x >= f.x1 || p.z <= f.z0 || p.z >= f.z1) continue
      // 가장 가까운 변으로 밀어냄
      const out = [p.x - f.x0, f.x1 - p.x, p.z - f.z0, f.z1 - p.z], m = Math.min(...out), i = out.indexOf(m)
      if (i === 0) p.x = f.x0; else if (i === 1) p.x = f.x1; else if (i === 2) p.z = f.z0; else p.z = f.z1
    }
    if (host) {
      const h = host.object.position, dx = p.x - h.x, dz = p.z - h.z, dd = Math.hypot(dx, dz), need = MOLE_R * 2.1
      if (dd < need) { p.x = h.x + dx / (dd || 1) * need; p.z = h.z + dz / (dd || 1) * need }
    }
    return p
  }

  let host: MoleActor | null = null
  let mole: MoleActor | null = null
  let disposed = false
  let worn = opts.worn ?? []
  const shadows = new Map<MoleActor, THREE.Mesh>()
  let holeMixer: THREE.AnimationMixer | null = null
  let holeObj: THREE.Object3D | null = null, holeClosing = false
  let holeT = -1, holeOpen: THREE.AnimationAction | null = null, holeClose: THREE.AnimationAction | null = null
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // 관심사 → 가구 배치 (data/roomPlan.ts). 진짜 모델이 있는 행의 glb 만 받음
  const plan = planRoom(opts.interests ?? [])
  const wall = wallpaperOf(opts.wallpaper ?? wallpaperForPicks(opts.interests ?? []))
  const tileSrc = tileUrl(wall.id, q.level === 'low' ? 512 : 1024)
  let wallMat: THREE.MeshBasicMaterial | null = null
  const fixedRows = FURNITURE_CATALOG.filter((r) => (r.type === 'base' || r.type === 'deco') && urlOf(r))
  const fixedUrls = [...new Set(fixedRows.map((r) => urlOf(r)!))]
  const planUrls = [...new Set(plan.items.filter((it) => it.built).map((it) => urlOf(it.row)).filter((u): u is string => !!u))]
  const softLoad = (u: string) => loadGlb(u).catch((e) => { console.warn('[3D] 관심사 가구 모델을 못 불러와서 블록으로 대신해요', u, e); return null })

  /** 떨어지는 가구 하나 (슬롯 자리에 놓인 묶음) */
  interface Drop { g: THREE.Group; it: PlannedItem; pos: [number, number, number]; dir: THREE.Vector3; ry: number; dustDone: boolean }
  const drops: Drop[] = []
  let seqT = -1                      // 가구 낙하 연출 경과 (−1 = 안 함)
  const blockGeos: THREE.BufferGeometry[] = [], blockMats: THREE.Material[] = []
  let dustG: GLTF | null = null
  const dusts: { o: THREE.Object3D; mixer: THREE.AnimationMixer; act: THREE.AnimationAction; mats: THREE.Material[]; t: number }[] = []

  Promise.all([
    loadGlb(shellUrl), loadGlb(holeUrl), loadMoleGltf(), loadAccessories(),
    Promise.all(fixedUrls.map((u) => loadGlb(u))),
    Promise.all(planUrls.map(softLoad)),
    loadGlb(dustUrl).catch(() => null),
    tileSrc ? loadTile(tileSrc) : Promise.resolve(null),
  ]).then(([shell, hole, moleG, acc, fixedG, planG, dust, tile]) => {
    if (disposed) { tile?.dispose(); return }
    dustG = dust
    // glb 는 캐시를 같이 씀 → 장면마다 복제 (재질·텍스처는 공유)
    const shellS = shell.scene.clone(), holeS = hole.scene.clone()
    scene.add(shellS, holeS)
    wallMat = applyWallpaper(shellS, tile, wall.solid_color)
    toDynamicLayer(holeS)
    const roots = new Map<string, THREE.Object3D>()
    fixedUrls.forEach((u, i) => {
      const root = fixedG[i].scene.clone()
      roots.set(u, root)
      // 기본 가구(base)는 누를 수 있게 furniture 묶음에, 장식·벽 선반(deco)은 장면에
      const isBase = fixedRows.some((r) => r.type === 'base' && urlOf(r) === u)
      ;(isBase ? furniture : scene).add(root)
      markShadows(root)
    })
    scene.updateMatrixWorld(true)
    for (const c of fixedRows) {
      if (c.type !== 'base') continue
      const node = roots.get(urlOf(c)!)?.getObjectByName(c.node)
      if (!node) continue
      const box = new THREE.Box3().setFromObject(node)
      if (box.min.y > 1) continue // 천장 램프처럼 매달린 것: 누를 수 없고 걸리지도 않음
      const data: FurnitureData = { id: c.id, label: c.name_ko, act: ACTS[c.id], stand: Math.max(c.size_m.w, c.size_m.d) / 2 + .55 }
      if (c.sit_point) {
        // sit_point_cushion_01(하늘색)·02(노란, v3에서 원탁 앞으로 옮기고 +90°): 방석의 자식 노드. 위치 = 엉덩이 자리, 방향 = 앉아서 보는 쪽
        const sp = node.getObjectByName(c.sit_point)
        if (sp) {
          const ex = sp.userData as { seat_type?: string; sit_clip_set?: string; seat_height_m?: number }
          data.seat = { kind: seatKind(ex.sit_clip_set ?? (c as { sit_clip_set?: string }).sit_clip_set ?? ex.seat_type), h: ex.seat_height_m ?? sp.getWorldPosition(new THREE.Vector3()).y }
          data.sitAt = sp
        }
      }
      node.userData.furniture = data
      // 방석처럼 앉는 낮은 가구는 발자리를 조금 작게 (앞까지 걸어와야 해서)
      const pad = c.sit_point ? MOLE_R * .6 : MOLE_R
      feet.push({ x0: box.min.x - pad, x1: box.max.x + pad, z0: box.min.z - pad, z1: box.max.z + pad })
    }

    // 관심사 가구·소품: 슬롯 자리에 묶음(g)을 두고 그 안에 모델 또는 블록
    const planRoots = new Map(planUrls.map((u, i) => [u, planG[i]?.scene ?? null]))
    for (const it of plan.items) {
      const { row, slot } = it
      const g = new THREE.Group(); g.name = `slot:${slot.name}`
      const ry = THREE.MathUtils.degToRad(slot.ry_deg)
      // 선반 소품: 카탈로그 shelf_offset_forward_m 만큼 칸의 앞쪽(슬롯 +Z = 방 쪽)으로 (HANDOFF_v3_2 3번)
      const fwd = slot.kind === 'shelf' ? row.shelf_offset_forward_m ?? 0 : 0
      const pos: [number, number, number] = [slot.pos_three[0] + Math.sin(ry) * fwd, slot.pos_three[1], slot.pos_three[2] + Math.cos(ry) * fwd]
      g.position.set(...pos)
      g.rotation.order = 'YXZ'; g.rotation.y = ry
      const src = it.built ? planRoots.get(urlOf(row)!)?.getObjectByName(row.node) : null
      let size = row.size_m
      if (src) {
        const m = src.clone(true); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(1)
        markShadows(m)
        g.add(m)
      } else {
        // 블록: 크기는 size_m 을 슬롯 최대 크기 안으로 (선반 칸보다 큰 소품 행이 있어서)
        size = { w: Math.min(row.size_m.w, slot.max_m.w), d: Math.min(row.size_m.d, slot.max_m.d), h: Math.min(row.size_m.h, slot.max_m.h) }
        const b = makeBlock(row, size, BLOCK_COLORS[it.category] ?? '#F7E6C8')
        blockGeos.push(b.geometry); blockMats.push(b.material)
        g.add(b)
      }
      const hung = slot.mount === 'wall_hung' || slot.kind === 'shelf'
      const data: FurnitureData = {
        id: row.id, label: row.name_ko, hint: it.built ? row.name_ko : `${row.name_ko} · 3D 모델 준비 중`,
        // 벽에 걸린 것·선반 소품은 두더지가 앞까지 걸어가지 않음 (앞이 다른 가구일 수 있음)
        stand: hung ? undefined : Math.max(size.w, size.d) / 2 + .55, noWalk: hung,
      }
      // 앉는 자리가 있는 관심사 가구 (M3 빈백 sit_point_chair_01 등): 모델 안 노드 extras 의 seat_type 으로
      const sp = row.sit_point ? g.getObjectByName(row.sit_point) : undefined
      const spx = sp?.userData as { seat_type?: string; sit_clip_set?: string; seat_height_m?: number } | undefined
      if (sp && (spx?.sit_clip_set || row.sit_clip_set || spx?.seat_type)) {
        data.seat = { kind: seatKind(spx?.sit_clip_set ?? row.sit_clip_set ?? spx?.seat_type), h: spx?.seat_height_m ?? sp.position.y }
        data.sitAt = sp; data.hint = undefined
      }
      g.userData.furniture = data
      furniture.add(g)
      if (!hung) {
        // 발자리: 회전한 사각형의 축 정렬 경계 + 두더지 반지름
        const c = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry))
        const hx = c * size.w / 2 + sn * size.d / 2 + MOLE_R, hz = sn * size.w / 2 + c * size.d / 2 + MOLE_R
        feet.push({ x0: g.position.x - hx, x1: g.position.x + hx, z0: g.position.z - hz, z1: g.position.z + hz })
      }
      drops.push({ g, it, pos, ry, dir: new THREE.Vector3(-g.position.x, 0, -g.position.z).normalize(), dustDone: false })
      if (!reduce) toDynamicLayer(g) // 떨어지는 동안은 움직이는 층, 착지하면 layer 0 (stepDrops)
    }

    // 천장 구멍
    holeObj = holeS
    holeMixer = new THREE.AnimationMixer(holeS)
    const clip = (n: string) => THREE.AnimationClip.findByName(hole.animations, n)
    const once = (c: THREE.AnimationClip | null) => {
      if (!c || !holeMixer) return null
      const a = holeMixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; return a
    }
    holeOpen = once(clip('ceiling_hole_open')); holeClose = once(clip('ceiling_hole_close'))
    const drop = !reduce
    holeS.visible = drop
    if (drop && holeOpen) { holeOpen.play(); holeT = 0 }
    // 가구 낙하: 두더지가 떨어지는 연출을 할 때만 (모션 줄이기면 처음부터 제자리)
    if (drop && drops.length) { seqT = 0; for (const d of drops) d.g.visible = false }

    if (opts.hostName) {
      host = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(.75, FLOOR_Y, .7), yaw: -.45, drop: false, lookEvery: [5, 11], floorY: FLOOR_Y, acc, worn: opts.hostWorn, simple: simpleMole })
      scene.add(host.object)
    }
    mole = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(0, FLOOR_Y, 0), clamp: clampRoom, drop, dropDelay: HOLE_OPEN, floorY: FLOOR_Y, acc, worn, simple: simpleMole })
    scene.add(mole.object)
    for (const a of [host, mole]) if (a) { const sh = blobShadow(.9); scene.add(sh); shadows.set(a, sh); toDynamicLayer(a.object); toDynamicLayer(sh) }
    fullNext = true
    sharpOff()
    loop.ready()
  }).catch((err) => console.warn('[3D] 땅굴 모델을 못 불러왔어요', err))

  /*
   * 가구 낙하 (furniture_drop_spec.md): FURN_T0 부터 계획의 start 순서대로. 시작 전에는 숨김.
   * 선반 소품·벽걸이는 pop(제자리에서 커짐), 먼지는 slots.json drop.dust 배율 (null 이면 없음)
   */
  const stepDrops = (dt: number) => {
    const prev = seqT
    seqT += dt
    const t0 = FURN_T0
    // 첫 세트가 떨어질 때 두더지가 두리번 (영상 시나리오: mole_look_around)
    if (prev < t0 && seqT >= t0 && mole?.isIdle()) mole.react('look')
    let busy = false
    for (const d of drops) {
      const t = seqT - t0 - d.it.start
      const spec = d.it.slot.drop
      const [x, y, z] = d.pos
      if (t < 0) { d.g.visible = false; busy = true; continue }
      d.g.visible = true
      if (t >= DROP_DURATION) {
        if (d.g.scale.x !== 1 || d.g.position.y !== y) { d.g.position.set(x, y, z); d.g.rotation.y = d.ry; d.g.scale.setScalar(1) }
        // 착지: 움직이지 않는 층으로 옮기고 (누를 수 있게 됨) 배경을 다시 찍음
        if (!d.g.layers.isEnabled(0)) { d.g.traverse((o) => o.layers.set(0)); backdrop?.invalidate() }
        continue
      }
      busy = true
      const k = furnitureDrop(t, spec.H ?? 2, spec.S ?? 0, spec.mode)
      d.g.position.set(x + d.dir.x * k.side, y + k.y, z + d.dir.z * k.side)
      d.g.rotation.y = d.ry + THREE.MathUtils.degToRad(k.rotDeg)
      // 망원경은 벽에 붙어 있어 pop 1.08배 순간 뒷다리가 벽을 3.2cm 파고듦 → 이 가구만 최대 1.0 (HANDOFF_v3_2 2번)
      if (d.it.row.id === 'telescope') { k.scaleH = Math.min(k.scaleH, 1); k.scaleV = Math.min(k.scaleV, 1) }
      d.g.scale.set(k.scaleH, k.scaleV, k.scaleH)
      if (!d.dustDone && t >= DUST_AT) { d.dustDone = true; if (spec.dust) puff(x, y, z, d.ry, spec.dust) }
    }
    if (!busy) seqT = -1
  }
  /** 착지 먼지 dust_puff_v1.glb (spec 5번): 덩어리 5개 위치·크기 애니메이션 + 코드로 투명도. 다 끝난 것은 다시 씀 */
  const puff = (x: number, y: number, z: number, ry: number, scale: number) => {
    if (!dustG) return
    let d = dusts.find((q) => q.t < 0)
    if (!d) {
      const o = dustG.scene.clone(true)
      const mats: THREE.Material[] = []
      o.traverse((n) => {
        const m = n as THREE.Mesh
        if (!m.isMesh) return
        const mat = (m.material as THREE.Material).clone(); mat.transparent = true; mat.depthWrite = false
        m.material = mat; mats.push(mat)
      })
      const mixer = new THREE.AnimationMixer(o)
      const clip = THREE.AnimationClip.findByName(dustG.animations, 'dust_puff') ?? dustG.animations[0]
      const act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true
      d = { o, mixer, act, mats, t: -1 }
      dusts.push(d); scene.add(o); toDynamicLayer(o)
    }
    d.o.position.set(x, y, z); d.o.rotation.y = ry; d.o.scale.setScalar(scale); d.o.visible = true
    d.act.reset().play(); d.t = 0
  }
  const stepDust = (dt: number) => {
    for (const d of dusts) {
      if (d.t < 0) continue
      d.t += dt
      d.mixer.update(dt)
      const op = dustOpacity(d.t)
      for (const m of d.mats) (m as THREE.MeshStandardMaterial).opacity = op
      if (d.t > .45) { d.t = -1; d.o.visible = false; d.act.stop() }
    }
  }

  // 직접 조종: 방향키·WASD, 바닥을 누르면 그쪽으로, 동작이 있는 가구를 누르면 그 동작. 끌면 카메라가 돎
  const keyProxy = { drive: (x: number, z: number) => { mole?.drive(x, z); loop.wake() } }
  const unbindKeys = bindDriveKeys(keyProxy.drive)
  const el = renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  // 휠 확대·축소: 목표 거리만 바꾸고 프레임마다 따라감. 캔버스 위에서는 페이지가 스크롤되지 않게 막음.
  // 트랙패드 핀치는 브라우저가 ctrl+wheel 로 보내므로 같은 줌 (값이 작아서 더 크게 반영)
  let zoomGoal = camera.position.distanceTo(controls.target)
  const ZOOM_HOME = zoomGoal
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (camLock) return
    let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1)
    if (e.ctrlKey) dy *= 4
    dy = THREE.MathUtils.clamp(dy, -300, 300)
    zoomGoal = THREE.MathUtils.clamp(zoomGoal * Math.exp(dy * .00085), ZOOM_MIN, ZOOM_MAX)
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  const zoomOffset = new THREE.Vector3()
  const stepZoom = (dt: number) => {
    zoomOffset.copy(camera.position).sub(controls.target)
    const d = zoomOffset.length()
    if (Math.abs(d - zoomGoal) < 1e-3) return false
    const k = dt > 0 ? 1 - Math.exp(-dt * 10) : 1   // 루프가 안 도는 환경(dt 0)에서는 바로
    const nd = d + (zoomGoal - d) * k
    zoomOffset.setLength(nd)
    controls.target.y = THREE.MathUtils.lerp(TARGET_Y_NEAR, TARGET_Y, THREE.MathUtils.smoothstep(nd, ZOOM_MIN, ZOOM_HOME))
    camera.position.copy(controls.target).add(zoomOffset)
    return true
  }
  const furnitureOf = (o: THREE.Object3D | null) => {
    for (; o; o = o.parent) if (o.userData.furniture) return o
    return null
  }
  const pick = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(furniture, true).find((h) => !/^shadow_/.test(h.object.name))
    // 집주인 두더지: 몸을 세로 막대(키 1m)로 보고 광선과의 거리로 판정
    let onHost = false
    if (host) {
      const hp = host.object.position, a = new THREE.Vector3(hp.x, hp.y + .1, hp.z), b2 = new THREE.Vector3(hp.x, hp.y + 1, hp.z)
      const pr = new THREE.Vector3(), ps = new THREE.Vector3()
      const d2 = ray.ray.distanceSqToSegment(a, b2, pr, ps)
      onHost = d2 < .45 ** 2 && (!hit || pr.distanceTo(ray.ray.origin) < hit.distance)
    }
    return { g: hit && !onHost ? furnitureOf(hit.object) : null, onHost }
  }
  const actionOf = (g: THREE.Object3D | null) => {
    const f = g?.userData.furniture as FurnitureData | undefined
    return f?.seat ? `${f.label}에 앉기` : f?.act === 'drink' ? '커피 마시기' : f?.hint ?? null
  }
  // 말풍선(리액션)·가구 이름표(마우스를 올렸을 때). 말풍선은 두더지 오른쪽 위, 꼬리는 왼쪽 아래
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
  const headV = new THREE.Vector3(), sideV = new THREE.Vector3()
  const drawBubbles = (t: number) => {
    for (const b of bubbles) {
      const on = !!b.who && t >= b.from && t < b.until
      if (on && b.who) {
        b.who.headTop(headV); headV.y -= .25
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
    const t = (FLOOR_Y - o.y) / dir.y; mole.walkTo(new THREE.Vector3(o.x + dir.x * t, FLOOR_Y, o.z + dir.z * t))
  }
  let moveQueued: PointerEvent | null = null
  const onMove = (e: PointerEvent) => {
    moveQueued = e
    // 루프가 쉬는 중(저사양)이면 다시 그리지 않고 이름표만 바로 갱신
    if (!loop.isRunning()) showHint()
  }
  const onLeave = () => { moveQueued = null; hint.style.opacity = '0'; el.style.cursor = 'pointer' }
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave)
  el.style.cursor = 'pointer'

  /** 마우스를 올린 가구 이름표 (프레임마다 한 번만 레이캐스트) */
  const showHint = () => {
    if (!moveQueued) return
    const e = moveQueued; moveQueued = null
    const pk = pick(e), rect = el.getBoundingClientRect()
    const label = pk.onHost ? opts.hostName ?? null : actionOf(pk.g)
    hint.textContent = label ?? ''
    hint.style.opacity = label ? '1' : '0'
    hint.style.left = `${e.clientX - rect.left}px`; hint.style.top = `${e.clientY - rect.top}px`
  }

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  const applyFrame = () => {
    if (W / H < 1) {
      // 세로 화면: 가로를 꽉 채움 (스펙: 가로 화각 유지 → 돔 양옆이 잘리지 않게)
      const bw = W * 1.02, bh = bw * 3 / 4
      frameCamera(camera, W, H, { left: (W - bw) / 2, top: (H - bh) * .62, w: bw, h: bh })
    } else {
      const bh = H * 1.145, bw = bh * 4 / 3
      frameCamera(camera, W, H, { left: focus * W - bw / 2, top: -0.054 * H, w: bw, h: bh })
    }
  }

  let camMoving = false
  /** 다음 프레임은 전체를 그림 (처음·크기 변경·모델 다 받음·액세서리 변경) */
  let fullNext = true
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  let prevRect: Rect | null = null
  const corner = new THREE.Vector3()
  /** 두더지 + 발밑 그림자 + 모자를 덮는 상자(가로·깊이 ±0.62m, 높이 1.5m)를 화면에 투영한 사각형 (CSS px, 아래가 0) */
  const actorRect = (a: MoleActor, r: Rect) => {
    const p = a.object.position, s = a.object.scale.x, h = .62 * s
    for (let i = 0; i < 8; i++) {
      corner.set(p.x + (i & 1 ? h : -h), p.y + (i & 2 ? 1.5 * s : -.05), p.z + (i & 4 ? h : -h)).project(camera)
      const x = (corner.x * .5 + .5) * W, y = (corner.y * .5 + .5) * H
      r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y)
    }
  }
  const drawFull = () => {
    renderer.setScissorTest(false); renderer.autoClear = true
    renderer.render(scene, camera)
  }
  /** A: 배경을 붙이고 움직이는 층만. 부분 그리기가 되면 두더지 둘레 사각형 안에서만 */
  const drawBackdrop = (full: boolean) => {
    const bd = backdrop!
    if (bd.isDirty()) { bd.capture(scene, camera); full = true }
    if (sharp && !sharpOk && mole && settle >= .35) { captureSharp(); full = true }
    const cur: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (const a of [mole, host]) if (a && a.object.visible) actorRect(a, cur)
    const prev = prevRect
    prevRect = cur
    let scissor = false
    if (partial && !full && prev && cur.x1 > cur.x0) {
      const pad = 12
      const x0 = Math.max(0, Math.floor(Math.min(cur.x0, prev.x0) - pad)), x1 = Math.min(W, Math.ceil(Math.max(cur.x1, prev.x1) + pad))
      const y0 = Math.max(0, Math.floor(Math.min(cur.y0, prev.y0) - pad)), y1 = Math.min(H, Math.ceil(Math.max(cur.y1, prev.y1) + pad))
      if (x1 <= x0 || y1 <= y0) return
      renderer.setScissorTest(true); renderer.setScissor(x0, y0, x1 - x0, y1 - y0); scissor = true
    }
    renderer.autoClear = false
    if (sharpOk) { renderer.clear(true, true, false); bd.blitDepth() } else bd.blit()
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    renderer.autoClear = true
    if (scissor) renderer.setScissorTest(false)
  }
  const draw = (full: boolean) => {
    if (backdrop) { drawBackdrop(full); return }
    if (!partial || !mole) { drawFull(); return }
    const cur: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (const a of [mole, host]) if (a && a.object.visible) actorRect(a, cur)
    const prev = prevRect
    prevRect = cur
    if (full || !prev) { drawFull(); return }
    // 지난 자리(지울 곳) ∪ 지금 자리, 12px 여유
    const pad = 12
    const x0 = Math.max(0, Math.floor(Math.min(cur.x0, prev.x0) - pad)), x1 = Math.min(W, Math.ceil(Math.max(cur.x1, prev.x1) + pad))
    const y0 = Math.max(0, Math.floor(Math.min(cur.y0, prev.y0) - pad)), y1 = Math.min(H, Math.ceil(Math.max(cur.y1, prev.y1) + pad))
    if (x1 <= x0 || y1 <= y0) return
    renderer.autoClear = false
    renderer.setScissorTest(true)
    renderer.setScissor(x0, y0, x1 - x0, y1 - y0)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setScissorTest(false)
    renderer.autoClear = true
  }
  const loop = startLoop(container, {
    resize(w, h) {
      W = w; H = h
      sharpOff()
      renderer.setSize(w, h, false)
      applyFrame()
      fullNext = true
    },
    frame(dt, t) {
      // 이번 프레임에 전체를 그려야 하는지 (부분 그리기일 때만 의미 있음)
      let full = fullNext || dt === 0
      fullNext = false
      // 카메라 구도가 바뀌는 것 (A 배경을 다시 찍어야 함)
      let camChanged = full
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); full = camChanged = true }
      clock = t
      if (stepZoom(dt)) full = camChanged = true
      camMoving = controls.update()
      if (camMoving) camChanged = true
      if (camChanged) backdrop?.invalidate()
      if (camMoving || holeT >= 0 || seqT >= 0 || dusts.some((d) => d.t >= 0)) full = true
      // S: 방이 바뀌는 중이면 선명한 그림을 내리고 저해상도로, 조용하면 시간을 셈 (dt 0 인 깨우기 프레임은 구도 변화가 아님)
      if (sharp) {
        const moving = focus !== focusTarget || camMoving || Math.abs(camera.position.distanceTo(controls.target) - zoomGoal) > 1e-3 || holeT >= 0 || seqT >= 0 || dusts.some((d) => d.t >= 0)
        if (moving) { if (sharpOk) full = true; sharpOff() } else settle += dt
      }
      showHint()
      // 천장 구멍: 열림 → (두더지 떨어짐) → 1.5초에 닫힘
      if (holeMixer && holeT >= 0) {
        holeT += dt
        if (!holeClosing && holeT >= HOLE_CLOSE) { holeClosing = true; holeOpen?.stop(); holeClose?.play() }
        holeMixer.update(dt)
        if (holeT > HOLE_CLOSE + .7 && holeObj) { holeT = -1; holeMixer.stopAllAction(); holeObj.visible = false }
      }
      if (seqT >= 0) stepDrops(dt)
      stepDust(dt)
      host?.update(dt)
      mole?.update(dt)
      for (const [a, sh] of shadows) {
        sh.visible = a.object.visible
        sh.position.set(a.object.position.x, .012, a.object.position.z)
      }
      drawBubbles(t)
      draw(full)
    },
    // 저사양에서 루프를 멈춰도 되는지: 두더지 동작·구멍·가구 낙하·먼지·줌·카메라 감속·패널 이동·말풍선이 모두 끝났을 때
    busy() {
      if (mole && !mole.isResting()) return true
      if (host && !host.isResting()) return true
      if (holeT >= 0 || seqT >= 0 || dusts.some((d) => d.t >= 0)) return true
      if (camMoving || focus !== focusTarget) return true
      if (Math.abs(camera.position.distanceTo(controls.target) - zoomGoal) > 1e-3) return true
      return bubbles.some((b) => b.who && clock < b.until + .3)
    },
    downgrade(nq) {
      renderer.setPixelRatio(nq.pixelRatio)
      controls.dampingFactor = damping()
      camLock = !!nq.lab?.C
      controls.enabled = !camLock
    },
  }, q)

  return {
    resize: () => loop.resize(),
    setFocusX(x) {
      focusTarget = x
      // 루프가 안 도는 환경(헤드리스·숨은 탭)에서도 최종 위치는 맞게
      if (document.hidden) { focus = x; applyFrame() }
      loop.wake()
    },
    setWorn(ids) { worn = ids; mole?.setWorn(ids); if (mole) toDynamicLayer(mole.object); loop.wake() },
    setFrozen: (on) => loop.setFrozen(on),
    react(kind) {
      if (!mole) return
      loop.wake()
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
      controls.dispose()
      unbindKeys()
      mole?.dispose(); host?.dispose()
      holeMixer?.stopAllAction()
      for (const d of dusts) d.mixer.stopAllAction()
      // 이 장면에서 만든 블록·먼지 재질만 해제 (glb 것은 캐시가 다시 씀)
      blockGeos.forEach((g) => g.dispose()); blockMats.forEach((m) => m.dispose())
      wallMat?.map?.dispose(); wallMat?.dispose()
      for (const d of dusts) d.mats.forEach((m) => m.dispose())
      bubbles.forEach((b) => b.el.remove()); hint.remove()
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave)
      // glb 지오메트리·텍스처는 캐시가 다음 장면에서 다시 쓰므로 해제하지 않음 (GPU 쪽은 렌더러·컨텍스트와 함께 풀림)
      for (const sh of shadows.values()) { sh.geometry.dispose(); (sh.material as THREE.Material).dispose() }
      backdrop?.dispose(); sharpCv?.remove()
      destroyRenderer(renderer)
    },
  }
}

/*
 * 벽지 (3D 핸드오프 v3.5.1 HANDOFF_v3_5_1.md, shell v3)
 * 돔 room_dome 의 안쪽 면 재질 wall_inner 만 바꿈 (wall_outer·바닥·갈비대는 그대로).
 * 결과 = 타일 × 음영. 음영은 wall_inner 의 emissive 텍스처(T_room_wall_shade, UV0, 값 = 음영÷4)를 lightMap 으로.
 * three r165 MeshBasicMaterial 은 lightMap 에 1/π 를 곱해서 문서의 세기 4 에 π 를 곱함 (Blender 렌더와 밝기 맞춤)
 * 타일은 두 번째 UV(wall_uv, channel 1), 둘레 N번 반복. 01 기본은 타일 없이 단색 (#F0B47A = v2 렌더와 같음)
 * glb 재질은 장면끼리 공유하므로 이 장면 복제본의 메시에만 새 재질을 끼움
 */
const SHADE_INTENSITY = 4 * Math.PI
function applyWallpaper(root: THREE.Object3D, tile: THREE.Texture | null, solid?: string): THREE.MeshBasicMaterial | null {
  let made: THREE.MeshBasicMaterial | null = null
  root.traverse((o) => {
    const m = o as THREE.Mesh
    const src = m.isMesh ? (m.material as THREE.MeshStandardMaterial) : null
    if (!src || src.name !== 'wall_inner') return
    if (!made) {
      const shade = src.emissiveMap
      if (shade) shade.channel = 0
      made = new THREE.MeshBasicMaterial({ name: 'wall_inner_wallpaper', side: src.side, lightMap: shade, lightMapIntensity: SHADE_INTENSITY })
      if (tile) {
        tile.colorSpace = THREE.SRGBColorSpace
        tile.wrapS = tile.wrapT = THREE.RepeatWrapping
        tile.channel = 1
        tile.repeat.set(WALLPAPER_REPEAT, WALLPAPER_REPEAT)
        tile.anisotropy = 4
        made.map = tile
      } else made.color.set(solid ?? '#F0B47A')
    }
    m.material = made
  })
  if (!made) tile?.dispose()
  return made
}

/** 벽지 타일 그림. 메인 스레드는 img, Worker(D 시험판)는 ImageBitmap. 둘 다 glTF UV 방향이라 flipY 끔 */
function loadTile(url: string): Promise<THREE.Texture | null> {
  const onFail = (e: unknown) => { console.warn('[3D] 벽지를 못 불러와서 단색으로 대신해요', url, e); return null }
  if (typeof document === 'undefined') {
    return new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none' }).loadAsync(url)
      .then((bmp) => { const t = new THREE.Texture(bmp as unknown as HTMLImageElement); t.flipY = false; t.needsUpdate = true; return t }, onFail)
  }
  return new THREE.TextureLoader().loadAsync(url).then((t) => { t.flipY = false; return t }, onFail)
}
