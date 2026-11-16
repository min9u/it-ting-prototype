import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadGlb } from './glb'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { gradientEnv, FIELD_ENV } from './lighting'
import { blobShadow } from './roomLook'
import { approach, createRenderer, destroyRenderer, frameCamera, quality, startLoop, type SceneHandle } from './engine'
import groundUrl from '../assets/models/field/explore_ground_150.glb?url'
import holeUrl from '../assets/models/field/hole_v2.glb?url'
import haloUrl from '../assets/models/field/hole_mine_halo.glb?url'
import padUrl from '../assets/models/field/empty_pad.glb?url'
import pathUrl from '../assets/models/field/path_kit.glb?url'
import ladderUrl from '../assets/models/field/ladder_shaft.glb?url'
import fenceUrl from '../assets/models/field/fence.glb?url'
import grassUrl from '../assets/models/field/grass_patch.glb?url'
import vineUrl from '../assets/models/field/vine_patch.glb?url'
import flowersUrl from '../assets/models/field/flowers.glb?url'

/*
 * 탐색 들판 (3D 핸드오프 v3.9 층 단위 150자리 + v3.8 "두더지 잡기" 이동). 설명은 docs/explore-field-v3-9.md
 *
 * - 배치: data/fieldLayout150.json (원본 explore_field_layout_150.json 을 app/scripts/build-field-layout.mjs 로 줄인 것). 모든 좌표 절대값
 * - common(땅·사다리·울타리)은 항상, zones[k](구멍·길·잔디·작물·꽃·풀 뭉치)는 켜진 구역만. 경계 길은 구역 번호 순서로 links add/replace 적용
 * - 안 켠 구역은 잔디색 평면으로 덮고, 울타리는 켜진 구역 안에 있는 것만
 * - 인스턴싱: 노드(부품)마다, 12m 칸마다 InstancedMesh 하나 → 칸 단위로 화면 밖은 안 그림(frustum culling)
 * - 구멍: hole_inner 는 그대로, hole_rim 만 인스턴스 색. 내 구멍은 분홍 링 + 후광. 배정 안 된 자리는 빈 자리(empty_pad)
 * - 카메라: 세로 FOV 32.3°, 내려다보기 45°, 거리 12m 고정. 목표점은 켜진 구역 camRect 합집합 안
 * - 이동: mole_hop_down(0.42s) → 숨김 → 카메라 0.4s → 보임 + mole_hop_up(0.5s) → idle. 이동 중엔 입력 잠금
 */

type Item = [node: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number]
type Tile = { cell: string; t: Item }
interface Zone {
  zone: number; name: string; seats: [number, number]
  bounds: { x: [number, number]; z: [number, number] }
  camRect: { x: [number, number]; z: [number, number] }
  holes: [seat: number, x: number, z: number, ry: number, s: number, ring: number][]
  paths: Tile[]; linkAdd: Tile[]; linkReplace: Tile[]
  grass: Item[]; tufts: Item[]; crops: Item[]; flowers: Item[]
}
export interface FieldLayout {
  theme: { grass_color: string; crop_glb: string; crop_nodes: string[] }
  mineRing: string
  rings: string[]
  nodes: string[]
  ladder: Item
  fence: Item[]
  zones: Zone[]
}

export interface HoleInfo { seat: number; x: number; z: number }
export type Dir = 'up' | 'down' | 'left' | 'right'

export interface HoleFieldEvents {
  /** 두더지가 구멍에 섰을 때 (처음 + 이동 끝). seat = 그 자리 번호 */
  onStand?(seat: number): void
  /** 이동 시작 (입력 잠금 시작) */
  onMove?(from: number, to: number): void
  /** 마우스가 올라간 구멍 (없으면 null) + 화면 좌표 */
  onHover?(seat: number | null, x: number, y: number): void
  /** 사다리를 누름 */
  onLadder?(): void
  /** 서 있는 구멍의 화면 좌표 (두더지 머리 위). 카메라·크기가 바뀔 때마다 */
  onAnchor?(x: number, y: number, visible: boolean): void
}

export interface HoleFieldOptions {
  focusX: number
  /** 배정된 자리 (구멍이 있는 자리) */
  occupied: number[]
  /** 켤 구역 수 (1~6, 번호 순서대로) */
  zones: number
  /** 내 자리 (이 들판에 내 땅굴이 없으면 null) */
  mySeat: number | null
  /** 두더지가 처음 서는 자리 */
  startSeat: number
  worn: string[]
  events: HoleFieldEvents
}

export interface HoleFieldHandle extends SceneHandle {
  /** 방향키: 화면 기준 그 방향 ±45° 안에서 가장 가까운 구멍으로 점프. 없으면 false */
  move(dir: Dir): boolean
  /** 그 자리로 바로 점프 (사이 구멍을 거치지 않음) */
  goSeat(seat: number): boolean
  /** 지금 이동 중인지 */
  busy(): boolean
}

const CELL = 12 // 컬링 칸 크기 (구역 36m = 3칸)
const CAM_DIST = 12, CAM_PITCH = THREE.MathUtils.degToRad(45), FOV = 32.3
const ANCHOR_Y = 0.075 // 구멍 바닥 = 두더지 발
const HOP_CAM = 0.4 // 카메라 이동 시간
const HIT_R = 1.05 // 구멍 클릭 반지름 (테두리 지름 약 2m)
const LADDER_POS = new THREE.Vector3(0, 0, -2)

let layoutP: Promise<FieldLayout> | null = null
const loadLayout = () => (layoutP ??= import('../data/fieldLayout150.json').then((m) => m.default as unknown as FieldLayout))

const GLB: Record<string, string> = {
  path_kit: pathUrl, grass_patch: grassUrl, vine_patch: vineUrl, flowers: flowersUrl, ladder_shaft: ladderUrl, fence: fenceUrl,
}

/** 노드 하나 = 여러 재질 부분(primitive). 노드 자체 위치는 버리고(배치가 절대 좌표라) 자식 상대 위치만 */
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }
function partsOf(gltf: GLTF, node: string): Part[] {
  const root = gltf.scene.getObjectByName(node)
  if (!root) { console.warn(`[들판] 노드 없음: ${node}`); return [] }
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const out: Part[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    out.push({ geo: m.geometry, mat: m.material as THREE.Material, local: inv.clone().multiply(m.matrixWorld) })
  })
  return out
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0)
const itemMatrix = (it: Item, out = new THREE.Matrix4()) =>
  out.compose(tmpP.set(it[1], it[2], it[3]), tmpQ.setFromAxisAngle(UP, it[4]), tmpS.set(it[5], it[6], it[7]))
const cellKey = (x: number, z: number) => `${Math.floor((x + 54) / CELL)},${Math.floor(-z / CELL)}`

export function mountHoleField(container: HTMLElement, opts: HoleFieldOptions): HoleFieldHandle {
  const q = quality()
  const renderer = createRenderer(container, { exposure: 1.0, shadowType: THREE.PCFSoftShadowMap, quality: q })
  const scene = new THREE.Scene()
  scene.environment = gradientEnv(renderer, FIELD_ENV)
  scene.environmentIntensity = .55
  scene.background = new THREE.Color('#8CC56A')
  const ev = opts.events

  /* ---------- 카메라 ---------- */
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 120)
  const camOff = new THREE.Vector3(0, Math.sin(CAM_PITCH) * CAM_DIST, Math.cos(CAM_PITCH) * CAM_DIST)
  const target = new THREE.Vector3()
  const placeCamera = () => { camera.position.copy(target).add(camOff); camera.lookAt(target); camera.updateMatrixWorld() }

  /* ---------- 조명: 따뜻한 해 하나(위 48°, 왼쪽 앞) + 크림빛 환경광 ---------- */
  const sun = new THREE.DirectionalLight('#FFE3BD', 2.4)
  const sunDir = new THREE.Vector3(-Math.cos(THREE.MathUtils.degToRad(48)) * .6, Math.sin(THREE.MathUtils.degToRad(48)), Math.cos(THREE.MathUtils.degToRad(48)) * .8).normalize()
  sun.castShadow = q.shadows
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 })
  scene.add(sun, sun.target)
  scene.add(new THREE.HemisphereLight('#FFF4E0', '#7FA860', 1.1))
  const followSun = () => {
    // 그림자 상자를 화면 가운데에 따라 붙임 (들판 108×72 전체에 그림자 맵 하나를 펴면 너무 흐림)
    sun.target.position.set(target.x, 0, target.z - 1.5)
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 30)
    sun.target.updateMatrixWorld()
  }

  let disposed = false
  /** 이 장면에서 새로 만든 지오메트리·재질 (glb 원본은 캐시라 남김) */
  const own: { dispose(): void }[] = []
  let mole: MoleActor | null = null
  let moleBlob: THREE.Mesh | null = null
  const holes = new Map<number, HoleInfo>() // 구멍이 있는 자리만
  let camRects: Zone['camRect'][] = []
  let curSeat = opts.startSeat
  let anim: { from: number; to: number; t: number; phase: 'down' | 'cam' | 'up'; dur: number; camFrom: THREE.Vector3; camTo: THREE.Vector3 } | null = null

  // 하이라이트 링 (마우스를 올린 구멍 · 이동 목표)
  const ringGeo = new THREE.RingGeometry(1.02, 1.22, 48).rotateX(-Math.PI / 2)
  const hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75, depthWrite: false }))
  hoverRing.visible = false; hoverRing.renderOrder = 2; scene.add(hoverRing)
  const targetRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, opacity: .95, depthWrite: false }))
  targetRing.visible = false; targetRing.renderOrder = 2; scene.add(targetRing)
  let hoverSeat: number | null = null

  /** 카메라 목표점을 켜진 구역 camRect 합집합 안으로 (가장 가까운 사각형 안의 점) */
  const clampTarget = (p: THREE.Vector3) => {
    if (!camRects.length) return p
    let best: THREE.Vector3 | null = null, bd = Infinity
    for (const r of camRects) {
      const zlo = Math.min(r.z[0], r.z[1]), zhi = Math.max(r.z[0], r.z[1])
      const c = new THREE.Vector3(THREE.MathUtils.clamp(p.x, r.x[0], r.x[1]), 0, THREE.MathUtils.clamp(p.z, zlo, zhi))
      const d = c.distanceToSquared(p)
      if (d < bd) { bd = d; best = c }
    }
    return p.copy(best!)
  }
  const holeVec = (seat: number, y = 0) => { const h = holes.get(seat)!; return new THREE.Vector3(h.x, y, h.z) }

  /* ---------- 불러오기 ---------- */
  const loaded = (async () => {
    const [layout, ground, hole, halo, pad, moleG, acc] = await Promise.all([
      loadLayout(), loadGlb(groundUrl), loadGlb(holeUrl), loadGlb(haloUrl), loadGlb(padUrl), loadMoleGltf(),
      q.level === 'low' && q.lab?.F ? Promise.resolve(undefined) : loadAccessories().catch(() => undefined),
    ])
    const glbs: Record<string, GLTF> = {}
    await Promise.all(Object.entries(GLB).map(async ([k, url]) => { glbs[k] = await loadGlb(url) }))
    if (disposed) return
    build(layout, { ground, hole, halo, pad, glbs })
    // 두더지
    const start = holes.has(curSeat) ? holeVec(curSeat, ANCHOR_Y) : new THREE.Vector3(1.9, 0, -3.4) // 구멍이 하나도 없으면 사다리 옆 흙 위
    mole = createMoleActor(moleG, {
      scale: 1, start, yaw: 0, drop: false, lookEvery: [7, 14], floorY: ANCHOR_Y, acc, worn: opts.worn,
      simple: q.level === 'low' && !!q.lab?.F,
    })
    scene.add(mole.object)
    if (!q.shadows) {
      moleBlob = blobShadow(.9, .3)
      own.push(moleBlob.geometry, moleBlob.material as THREE.Material)
      moleBlob.position.set(start.x + .08, .085, start.z - .05)
      scene.add(moleBlob)
    }
    target.copy(start).setY(0); clampTarget(target); placeCamera(); followSun()
    ev.onStand?.(curSeat)
    markReady()
  })().catch((e) => { console.warn('[들판] 불러오지 못했어요', e) })

  function build(L: FieldLayout, m: { ground: GLTF; hole: GLTF; halo: GLTF; pad: GLTF; glbs: Record<string, GLTF> }) {
    const on = L.zones.filter((z) => z.zone <= Math.max(1, Math.min(6, opts.zones)))
    camRects = on.map((z) => z.camRect)
    const inOn = (x: number, z: number) => on.some((zn) => x >= zn.bounds.x[0] - .01 && x <= zn.bounds.x[1] + .01 && z <= zn.bounds.z[0] + .01 && z >= zn.bounds.z[1] - .01)

    // 땅: 흙 슬랩 + 바깥 잔디 (그림자 받기만)
    const g = m.ground.scene.clone(true)
    g.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.receiveShadow = true })
    scene.add(g)
    // 안 켠 구역은 잔디색 평면으로 덮음 (바깥 잔디 재질을 그대로 써서 색이 같게)
    const outer = m.ground.scene.getObjectByName('outer_grass') as THREE.Mesh | undefined
    const coverMat = (outer?.material as THREE.MeshStandardMaterial | undefined)?.clone() ?? new THREE.MeshStandardMaterial({ color: L.theme.grass_color, roughness: .95 })
    own.push(coverMat)
    for (const z of L.zones) {
      if (z.zone <= on.length) continue
      const w = z.bounds.x[1] - z.bounds.x[0], d = Math.abs(z.bounds.z[1] - z.bounds.z[0])
      // 슬랩 바깥 모서리(둥근 부분)까지 덮으려고 바깥쪽으로 조금 키움. 켜진 구역 쪽 경계는 그대로
      const pad = 1.5
      const growX0 = z.bounds.x[0] <= -54 ? pad : 0, growX1 = z.bounds.x[1] >= 54 ? pad : 0
      const growS = z.bounds.z[0] >= 0 ? pad : 0, growN = z.bounds.z[1] <= -72 ? pad : 0
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w + growX0 + growX1, d + growS + growN).rotateX(-Math.PI / 2), coverMat)
      own.push(plane.geometry)
      plane.position.set((z.bounds.x[0] - growX0 + z.bounds.x[1] + growX1) / 2, .004, (z.bounds.z[0] + growS + z.bounds.z[1] - growN) / 2)
      plane.receiveShadow = true
      scene.add(plane)
    }

    // 부품(노드) 재료
    const partCache = new Map<number, Part[]>()
    const parts = (node: number) => {
      let p = partCache.get(node)
      if (!p) {
        const [glb, name] = L.nodes[node].split(':')
        p = glbs(glb) ? partsOf(glbs(glb)!, name) : []
        partCache.set(node, p)
      }
      return p
    }
    const glbs = (k: string) => m.glbs[k]
    // 작물은 층 테마 설정값 (theme.crop_glb). 지금은 vine_patch 만 있음
    const crop = L.theme.crop_glb.replace('.glb', '')
    if (!m.glbs[crop]) console.warn(`[들판] 작물 glb 없음: ${crop}`)

    // 칸 × 노드별로 모음
    const buckets = new Map<string, { node: number; mats: THREE.Matrix4[]; cast: boolean }>()
    const put = (it: Item, cast: boolean) => {
      const k = `${cellKey(it[1], it[3])}|${it[0]}`
      let b = buckets.get(k)
      if (!b) buckets.set(k, (b = { node: it[0], mats: [], cast }))
      b.mats.push(itemMatrix(it))
    }
    // 길: 구역 번호 순서로 켜면서 경계 길 add/replace
    const tiles = new Map<string, Item>()
    for (const z of on) {
      z.paths.forEach((p) => tiles.set(p.cell, p.t))
      z.linkReplace.forEach((p) => tiles.set(p.cell, p.t))
      z.linkAdd.forEach((p) => tiles.set(p.cell, p.t))
    }
    tiles.forEach((t) => put(t, false))
    for (const z of on) {
      z.grass.forEach((it) => put(it, false))
      z.tufts.forEach((it) => put(it, false))
      z.crops.forEach((it) => put(it, q.shadows))
      z.flowers.forEach((it) => put(it, false))
    }
    L.fence.forEach((it) => { if (inOn(it[1], it[3])) put(it, q.shadows) })
    put(L.ladder, q.shadows)

    const insts: THREE.InstancedMesh[] = []
    const addInst = (pp: Part[], mats: THREE.Matrix4[], cast: boolean, colors?: THREE.Color[]) => {
      for (const p of pp) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length)
        mats.forEach((mm, i) => im.setMatrixAt(i, tmpM.multiplyMatrices(mm, p.local)))
        colors?.forEach((c, i) => im.setColorAt(i, c))
        im.computeBoundingSphere()
        im.castShadow = cast; im.receiveShadow = true
        scene.add(im); insts.push(im)
      }
    }
    buckets.forEach((b) => addInst(parts(b.node), b.mats, b.cast))

    // 구멍 · 빈 자리 · 내 후광
    const holeParts = { inner: partsOf(m.hole, 'hole_inner'), rim: partsOf(m.hole, 'hole_rim') }
    const occupied = new Set(opts.occupied)
    const hb = new Map<string, { mats: THREE.Matrix4[]; colors: THREE.Color[] }>()
    const pads = new Map<string, THREE.Matrix4[]>()
    for (const z of on) for (const [seat, x, zz, ry, s, ring] of z.holes) {
      const mat = itemMatrix([0, x, 0, zz, ry, s, 1, s])
      const k = cellKey(x, zz)
      if (occupied.has(seat) || seat === opts.mySeat) {
        holes.set(seat, { seat, x, z: zz })
        let b = hb.get(k); if (!b) hb.set(k, (b = { mats: [], colors: [] }))
        b.mats.push(mat)
        b.colors.push(new THREE.Color(seat === opts.mySeat ? L.mineRing : L.rings[ring]))
      } else {
        let b = pads.get(k); if (!b) pads.set(k, (b = []))
        b.push(itemMatrix([0, x, 0, zz, ry, 1, 1, 1]))
      }
    }
    hb.forEach((b) => { addInst(holeParts.inner, b.mats, false); addInst(holeParts.rim, b.mats, false, b.colors) })
    const padParts = partsOf(m.pad, 'empty_pad')
    pads.forEach((mats) => addInst(padParts, mats, false))
    if (opts.mySeat && holes.has(opts.mySeat)) {
      const h = holes.get(opts.mySeat)!
      const halo = m.halo.scene.clone(true)
      halo.position.set(h.x, 0, h.z)
      halo.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.receiveShadow = true })
      scene.add(halo)
    }
  }

  /* ---------- 화면 맞추기 ---------- */
  let W = 1, H = 1
  let focusTarget = opts.focusX, focus = focusTarget
  const applyFrame = () => { frameCamera(camera, W, H, { left: focus * W - W / 2, top: 0, w: W, h: H }); camera.updateProjectionMatrix() }
  const proj = new THREE.Vector3()
  const toScreen = (p: THREE.Vector3) => {
    proj.copy(p).project(camera)
    return { x: (proj.x * .5 + .5) * W, y: (1 - (proj.y * .5 + .5)) * H, ok: proj.z < 1 }
  }
  let lastAnchor = ''
  const emitAnchor = () => {
    if (!holes.has(curSeat) && !mole) return
    const p = mole ? mole.object.position.clone().setY(ANCHOR_Y + 1.12) : holeVec(curSeat, 1.2)
    const s = toScreen(p)
    const vis = !anim && !!mole?.object.visible
    const key = `${s.x.toFixed(1)},${s.y.toFixed(1)},${vis}`
    if (key === lastAnchor) return
    lastAnchor = key
    ev.onAnchor?.(s.x, s.y, vis)
  }
  const emitHover = () => {
    if (hoverSeat == null) return
    const s = toScreen(holeVec(hoverSeat, .3))
    ev.onHover?.(hoverSeat, s.x, s.y)
  }

  /* ---------- 점프 이동 ---------- */
  const ease = (t: number) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  function jump(to: number): boolean {
    if (anim || !mole || to === curSeat || !holes.has(to)) return false
    const from = curSeat
    const dur = mole.hop('down')
    anim = { from, to, t: 0, phase: 'down', dur, camFrom: target.clone(), camTo: clampTarget(holeVec(to)) }
    const h = holes.get(to)!
    targetRing.position.set(h.x, .06, h.z); targetRing.visible = true
    // 이동이 시작되면 마우스 표시는 지움 (도착하면 그 구멍이 서 있는 자리가 됨)
    hoverSeat = null; hoverRing.visible = false
    ev.onMove?.(from, to)
    loop.wake()
    return true
  }
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  function stepAnim(dt: number) {
    if (!anim || !mole) return
    anim.t += dt
    if (anim.phase === 'down' && anim.t >= anim.dur) {
      mole.object.visible = false
      if (moleBlob) moleBlob.visible = false
      anim.phase = 'cam'; anim.t = 0
    }
    if (anim.phase === 'cam') {
      const k = reduce ? 1 : Math.min(1, anim.t / HOP_CAM)
      target.lerpVectors(anim.camFrom, anim.camTo, ease(k))
      placeCamera(); followSun()
      if (k >= 1) {
        const p = holeVec(anim.to, ANCHOR_Y)
        mole.object.position.copy(p); mole.object.rotation.y = 0
        mole.object.visible = true
        if (moleBlob) { moleBlob.position.set(p.x + .08, .085, p.z - .05); moleBlob.visible = true }
        anim.dur = mole.hop('up'); anim.phase = 'up'; anim.t = 0
      }
    } else if (anim.phase === 'up' && anim.t >= anim.dur) {
      curSeat = anim.to
      anim = null
      targetRing.visible = false
      lastAnchor = ''
      ev.onStand?.(curSeat)
    }
  }

  function move(dir: Dir): boolean {
    if (anim || !holes.has(curSeat)) return false
    const c = holes.get(curSeat)!
    // 화면 기준 방향 = 들판 기준 (카메라가 좌우로 돌지 않음): 위 = -z, 오른쪽 = +x
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
    let best: number | null = null, bd = Infinity
    holes.forEach((h) => {
      if (h.seat === curSeat) return
      const vx = h.x - c.x, vz = h.z - c.z, len = Math.hypot(vx, vz)
      const cos = (vx * d[0] + vz * d[1]) / len
      if (cos < Math.SQRT1_2 - 1e-6) return // ±45° 밖
      // 가장 가까운 구멍. 거리가 비슷하면 방향이 더 곧은 쪽 (각도 1° 당 2cm 가산)
      const score = len + (1 - cos) * 6
      if (score < bd) { bd = score; best = h.seat }
    })
    return best != null && jump(best)
  }

  /* ---------- 마우스: 구멍 누르기·올리기, 사다리 누르기 ---------- */
  const el = renderer.domElement
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(UP, -.1), hit = new THREE.Vector3()
  const pickAt = (cx: number, cy: number): { seat?: number; ladder?: boolean } => {
    const r = el.getBoundingClientRect()
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    // 두더지 몸통을 눌러도 그 구멍 (두더지는 구멍 위에 서 있음)
    if (!ray.ray.intersectPlane(plane, hit)) return {}
    let best: number | undefined, bd = HIT_R
    holes.forEach((h) => { const dd = Math.hypot(h.x - hit.x, h.z - hit.z); if (dd < bd) { bd = dd; best = h.seat } })
    if (best != null) return { seat: best }
    if (Math.hypot(hit.x - LADDER_POS.x, hit.z - LADDER_POS.z) < 1.5) return { ladder: true }
    return {}
  }
  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    const p = pickAt(e.clientX, e.clientY)
    if (p.ladder) ev.onLadder?.()
    else if (p.seat != null) jump(p.seat)
  }
  const onMoveP = (e: PointerEvent) => {
    if (e.buttons) return
    const p = pickAt(e.clientX, e.clientY)
    const seat = p.seat ?? null
    el.style.cursor = seat != null && seat !== curSeat ? 'pointer' : p.ladder ? 'pointer' : 'default'
    if (seat === hoverSeat) return
    hoverSeat = seat
    if (seat != null && seat !== curSeat) {
      const h = holes.get(seat)!
      hoverRing.position.set(h.x, .055, h.z); hoverRing.visible = true
      emitHover()
    } else {
      hoverRing.visible = false
      ev.onHover?.(null, 0, 0)
    }
    loop.wake()
  }
  const onLeave = () => { if (hoverSeat != null) { hoverSeat = null; hoverRing.visible = false; ev.onHover?.(null, 0, 0); loop.wake() } }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMoveP)
  el.addEventListener('pointerleave', onLeave)

  /* ---------- 루프 ---------- */
  // 불러오기(위 async)가 끝나면 부름. 함수 선언이라 loop 보다 먼저 적어도 됨
  function markReady() { loop.ready() }
  let pulse = 0
  const loop = startLoop(container, {
    resize(w, h) { W = w; H = h; renderer.setSize(w, h, false); applyFrame(); lastAnchor = '' },
    frame(dt) {
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); lastAnchor = '' }
      stepAnim(dt)
      mole?.update(dt)
      if (targetRing.visible) { pulse += dt; (targetRing.material as THREE.MeshBasicMaterial).opacity = .65 + .3 * Math.sin(pulse * 9) }
      renderer.render(scene, camera)
      emitAnchor()
      if (anim || focus !== focusTarget) emitHover()
    },
    busy: () => !!anim || focus !== focusTarget || (!!mole && !mole.isResting()),
    downgrade(nq) {
      renderer.setPixelRatio(nq.pixelRatio)
      sun.castShadow = false; renderer.shadowMap.enabled = false
    },
  }, q)

  return {
    loaded: loaded.then(() => undefined),
    resize: () => loop.resize(),
    setFrozen: (on) => loop.setFrozen(on),
    setFocusX(x) {
      focusTarget = x
      if (document.hidden) { focus = x; applyFrame() }
      loop.wake()
    },
    move(dir) { const ok = move(dir); return ok },
    goSeat(seat) { return jump(seat) },
    busy: () => !!anim,
    dispose() {
      disposed = true
      loop.stop()
      mole?.dispose()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMoveP)
      el.removeEventListener('pointerleave', onLeave)
      // glb 원본(캐시)의 지오메트리·재질은 다른 장면이 다시 쓰므로 여기서 만든 것만 정리
      scene.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose() })
      ringGeo.dispose()
      own.forEach((x) => x.dispose())
      ;(hoverRing.material as THREE.Material).dispose(); (targetRing.material as THREE.Material).dispose()
      if (scene.environment) scene.environment.dispose()
      sun.shadow.dispose()
      destroyRenderer(renderer)
    },
  }
}
