import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadGlb } from './glb'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { gradientEnv, FIELD_ENV } from './lighting'
import { blobShadow } from './roomLook'
import { createBackdrop, toDynamicLayer, type Backdrop } from './staticBackdrop'
import { approach, createRenderer, destroyRenderer, frameCamera, quality, startLoop, testParam, type SceneHandle } from './engine'
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
 * - 저사양(그래픽 가속 꺼짐, docs/rendering-experiments-2.md):
 *   A 들판은 렌더 타깃에 한 번 그리고(staticBackdrop.ts) 매 프레임은 붙인 뒤 움직이는 층(두더지·발밑 그림자·링)만.
 *     CPU 렌더러(WARP)는 화면 가득한 땅·풀의 재질 계산이 병목이라(한 프레임 CPU 약 0.36초) 들판을 다시 안 그리는 게 가장 큼.
 *     카메라가 움직이는 0.4초(점프 이동)·패널 이동 중에만 전체를 그리고, 멈추면 다시 찍음
 *   P 두더지 둘레 사각형만 다시 그림 (지난 그림을 남겨 둠, 땅굴·옛 밭과 같은 방식)
 *   예열: 셰이더 미리 컴파일 + 물체마다 1×1 그리기를 나눠서 → 들어올 때 첫 프레임 0.5초 멈춤을 짧은 작업 여럿으로 (땅굴과 같은 방식)
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
/** S 선명한 배경을 끄는 기준 (ms, 두 번 넘으면). 16스레드 WARP 는 약 60~120ms, CPU 2코어는 300ms 넘음 (docs/rendering-experiments-2.md) */
const SHARP_SLOW_MS = 200
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
  // A·P (위 설명). 저사양으로 시작했을 때만 부분 그리기(지난 그림을 남기는 preserveDrawingBuffer 는 나중에 못 바꿈). 시험용 ?fa=0 · ?partial=0
  const useA = () => q.level === 'low' && !!q.lab?.A && testParam('fa') !== '0'
  const scissorOk = useA() && (q.lab?.P ?? true) && testParam('partial') !== '0'
  /*
   * S 배경은 선명하게 (아래 captureSharp, 기본 켬 2026-11-16 docs/rendering-experiments-2.md): WebGL 캔버스를 투명하게 두고
   * 뒤 2D 캔버스에 1배(기기 배율) 배경, 두더지·링만 0.55배. 실험실 S 를 따름. 시험용 ?fsharp=0 끔,
   * ?fss= 배경 배율(기본 1, 0 이면 땅굴처럼 1.5배 슈퍼샘플), ?fsasync=0 이면 그림을 그 자리에서 읽어 옴(메인 스레드가 기다림)
   */
  let sharpField = useA() && (q.lab?.S ?? true) && testParam('fsharp') !== '0'
  const sharpSS = +(testParam('fss') ?? '1').replace('_', '.')
  const sharpAsync = testParam('fsasync') !== '0'
  const renderer = createRenderer(container, { alpha: sharpField, exposure: 1.0, shadowType: THREE.PCFSoftShadowMap, quality: q, preserve: scissorOk })
  // 배경 렌더 타깃 배율 (?bdscale=2 → 캔버스의 2배로 그려 붙일 때 2×2 평균 = 안티앨리어싱)
  const bdScale = +(testParam('bdscale') ?? '1').replace('_', '.')
  let backdrop: Backdrop | null = useA() ? createBackdrop(renderer, { scale: bdScale }) : null
  // R 카메라가 움직이는 동안 낮은 해상도 배경 (캔버스 대비 배율, 0 = 끔, 기본 0.6 → 0.33배). 시험용 ?panscale=0_6
  const panScale = +(testParam('panscale') ?? '0_6').replace('_', '.')
  let panBd: Backdrop | null = null
  // 예열 (아래 warm). 기본 켬. 시험용 ?compile=0 으로 끔
  const precompile = testParam('compile') !== '0'
  let warming = false
  const scene = new THREE.Scene()
  scene.environment = gradientEnv(renderer, FIELD_ENV)
  scene.environmentIntensity = .55
  scene.background = new THREE.Color('#8CC56A')
  const ev = opts.events
  // 측정용 손잡이 (docs/rendering-experiments-2.md): ?spin=1 쉬지 않고 계속 그림, ?fhide=flowers_tufts 종류 빼기, ?fmat=std|lambert|basic 재질 바꾸기
  const spin = testParam('spin') === '1'
  // ?qshot=1: 같은 장면 스크린샷용 (두더지 자세 고정 + window.__moleRect, cdp-quality.mjs)
  const qshot = testParam('qshot') === '1'
  const hide = new Set((testParam('fhide') ?? '').split('_').filter(Boolean))
  const fmat = testParam('fmat')
  // ?fenv=0: 들판은 환경맵(IBL) 대신 반구광 하나로 비슷하게 (두더지는 재질을 복제해 환경맵 그대로)
  const noEnv = testParam('fenv') === '0'
  const envTex = scene.environment
  if (noEnv) {
    scene.environment = null
    // FIELD_ENV 위(하늘)·아래(땅) 색을 environmentIntensity 만큼
    const envHemi = new THREE.HemisphereLight('#dde9f0', '#c2bba3', .55)
    envHemi.layers.enable(1)
    scene.add(envHemi)
  }
  const matSwap = new Map<THREE.Material, THREE.Material>()
  const swapMat = (m: THREE.Material): THREE.Material => {
    if (!fmat) return m
    let o = matSwap.get(m)
    if (!o) {
      const src = m as THREE.MeshStandardMaterial
      const base = { color: src.color, map: src.map, side: src.side, transparent: src.transparent, opacity: src.opacity, vertexColors: src.vertexColors }
      o = fmat === 'lambert' ? new THREE.MeshLambertMaterial(base) : fmat === 'basic' ? new THREE.MeshBasicMaterial(base) : new THREE.MeshStandardMaterial({ ...base, roughness: src.roughness, metalness: src.metalness })
      matSwap.set(m, o); own.push(o)
    }
    return o
  }

  /* ---------- 카메라 ---------- */
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 120)
  camera.layers.enable(1)
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
  const hemi = new THREE.HemisphereLight('#FFF4E0', '#7FA860', 1.1)
  scene.add(hemi)
  // 움직이는 층(layer 1: 두더지·발밑 그림자·링)도 빛을 받게. 카메라는 평소 두 층 모두 봄
  sun.layers.enable(1); hemi.layers.enable(1)
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
  hoverRing.visible = false; hoverRing.renderOrder = 2; hoverRing.layers.set(1); scene.add(hoverRing)
  const targetRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, opacity: .95, depthWrite: false }))
  targetRing.visible = false; targetRing.renderOrder = 2; targetRing.layers.set(1); scene.add(targetRing)
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
    toDynamicLayer(mole.object)
    if (qshot) mole.update(0) // 측정용: 자세 고정 (아래 루프에서 update 를 안 함)
    if (noEnv && envTex) {
      const cl = new Map<THREE.Material, THREE.Material>()
      mole.object.traverse((o) => {
        const mm = o as THREE.Mesh
        if (!mm.isMesh) return
        const src = mm.material as THREE.MeshStandardMaterial
        let c = cl.get(src)
        if (!c) { c = src.clone(); if ((c as THREE.MeshStandardMaterial).isMeshStandardMaterial) { (c as THREE.MeshStandardMaterial).envMap = envTex; (c as THREE.MeshStandardMaterial).envMapIntensity = .55 } cl.set(src, c); own.push(c) }
        mm.material = c
      })
    }
    scene.add(mole.object)
    if (!q.shadows) {
      moleBlob = blobShadow(.9, .3)
      own.push(moleBlob.geometry, moleBlob.material as THREE.Material)
      moleBlob.position.set(start.x + .08, .085, start.z - .05)
      moleBlob.layers.set(1)
      scene.add(moleBlob)
    }
    target.copy(start).setY(0); clampTarget(target); placeCamera(); followSun()
    if (precompile) await warm()
    if (disposed) return
    ev.onStand?.(curSeat)
    markReady()
  })().catch((e) => { console.warn('[들판] 불러오지 못했어요', e) })

  function build(L: FieldLayout, m: { ground: GLTF; hole: GLTF; halo: GLTF; pad: GLTF; glbs: Record<string, GLTF> }) {
    const on = L.zones.filter((z) => z.zone <= Math.max(1, Math.min(6, opts.zones)))
    camRects = on.map((z) => z.camRect)
    const inOn = (x: number, z: number) => on.some((zn) => x >= zn.bounds.x[0] - .01 && x <= zn.bounds.x[1] + .01 && z <= zn.bounds.z[0] + .01 && z >= zn.bounds.z[1] - .01)

    // 땅: 흙 슬랩 + 바깥 잔디 (그림자 받기만)
    const g = m.ground.scene.clone(true)
    g.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.receiveShadow = true; mm.material = swapMat(mm.material as THREE.Material) } })
    if (!hide.has('ground')) scene.add(g)
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
    if (!hide.has('paths')) tiles.forEach((t) => put(t, false))
    for (const z of on) {
      if (!hide.has('grass')) z.grass.forEach((it) => put(it, false))
      if (!hide.has('tufts')) z.tufts.forEach((it) => put(it, false))
      if (!hide.has('crops')) z.crops.forEach((it) => put(it, q.shadows))
      if (!hide.has('flowers')) z.flowers.forEach((it) => put(it, false))
    }
    if (!hide.has('fence')) L.fence.forEach((it) => { if (inOn(it[1], it[3])) put(it, q.shadows) })
    put(L.ladder, q.shadows)

    const insts: THREE.InstancedMesh[] = []
    const addInst = (pp: Part[], mats: THREE.Matrix4[], cast: boolean, colors?: THREE.Color[]) => {
      for (const p of pp) {
        const im = new THREE.InstancedMesh(p.geo, swapMat(p.mat), mats.length)
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
  /** 이번 프레임에 카메라가 움직였으면 true (A: 들판을 다시 찍어야 함) */
  function stepAnim(dt: number): boolean {
    if (!anim || !mole) return false
    anim.t += dt
    if (anim.phase === 'down' && anim.t >= anim.dur) {
      mole.object.visible = false
      if (moleBlob) moleBlob.visible = false
      anim.phase = 'cam'; anim.t = 0
    }
    let moved = false
    if (anim.phase === 'cam') {
      const k = reduce ? 1 : Math.min(1, anim.t / HOP_CAM)
      target.lerpVectors(anim.camFrom, anim.camTo, ease(k))
      placeCamera(); followSun()
      moved = true
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
    return moved
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

  /* ---------- 예열 (들어올 때 멈춤 나누기, docs/rendering-experiments.md 2번 · -2.md) ---------- */
  /*
   * WARP(ANGLE D3D11)는 셰이더를 미리 컴파일해도 물체를 처음 그릴 때 파이프라인을 만드느라 멈춤 →
   * 메시 몇 개씩만 보이게 해서 1×1 영역에 그리고 쉬기를 반복 (짧은 작업 여럿으로). 배경(A) 렌더 타깃과 캔버스 두 군데 다 (셰이더가 다름)
   */
  async function warm() {
    warming = true
    const w0 = performance.now()
    try {
      if (backdrop) await backdrop.precompile(scene, camera)
      await renderer.compileAsync(scene, camera).catch(() => {})
      const texs = new Set<THREE.Texture>()
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        for (const mm of m ? (Array.isArray(m) ? m : [m]) : []) for (const v of Object.values(mm)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture)
      })
      for (const t of texs) { if (disposed) return; renderer.initTexture(t); await new Promise((r) => setTimeout(r, 0)) }
      // 같은 셰이더·같은 정점 형식이면 첫 그리기 한 번으로 충분 → 그 묶음마다 하나씩만 (인스턴스 칸이 130개 넘어서)
      const meshes: THREE.Object3D[] = [], seen = new Set<string>()
      scene.traverse((o) => {
        const m = o as THREE.InstancedMesh
        if (!m.isMesh || !o.visible) return
        const attrs = Object.entries(m.geometry.attributes).map(([k, a]) => `${k}:${a.itemSize}:${(a as THREE.BufferAttribute).array?.constructor.name}`).sort().join()
        const mats = ([] as THREE.Material[]).concat(m.material).map((x) => x.uuid).join()
        const key = `${mats}|${m.isInstancedMesh ? 1 : 0}|${m.instanceColor ? 1 : 0}|${(m as unknown as THREE.SkinnedMesh).isSkinnedMesh ? 1 : 0}|${m.geometry.index?.array.constructor.name}|${attrs}`
        if (seen.has(key)) return
        seen.add(key); meshes.push(o)
      })
      const all: THREE.Object3D[] = []
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) all.push(o) })
      const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
      const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), scOn = renderer.getScissorTest()
      const mask = camera.layers.mask
      for (const m of all) m.visible = false
      let i = 0
      try {
        while (i < meshes.length) {
          if (disposed) return
          const t0 = performance.now()
          while (i < meshes.length && performance.now() - t0 < 25) {
            const m = meshes[i++]; m.visible = true
            camera.layers.enableAll()
            renderer.autoClear = false
            for (const rt of backdrop ? [backdrop.target(), null] : [null]) {
              renderer.setRenderTarget(rt)
              if (rt) { rt.viewport.set(0, 0, 1, 1); rt.scissor.set(0, 0, 1, 1); rt.scissorTest = true }
              else { renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true) }
              renderer.render(scene, camera)
              if (rt) { rt.viewport.set(0, 0, rt.width, rt.height); rt.scissor.set(0, 0, rt.width, rt.height); rt.scissorTest = false }
            }
            m.visible = false
          }
          await new Promise((r) => setTimeout(r, 0))
        }
      } finally {
        for (const m of all) m.visible = true
        camera.layers.mask = mask
        renderer.setRenderTarget(prevTarget); renderer.autoClear = prevAuto
        renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scOn)
        backdrop?.invalidate(); sharpOff(); fullNext = true
      }
    } finally {
      warming = false
      ;(window as unknown as { __warmMs?: number }).__warmMs = Math.round(performance.now() - w0) // 측정용
    }
  }

  /* ---------- A: 들판은 한 번 + 움직이는 층만, P: 그 둘레 사각형만 ---------- */
  let fullNext = true
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  let prevRect: Rect | null = null
  const corner = new THREE.Vector3(), boneP = new THREE.Vector3()
  let moleBones: THREE.Object3D[] | null = null
  const addBox = (r: Rect, cx: number, y0: number, y1: number, cz: number, h: number) => {
    for (let i = 0; i < 8; i++) {
      corner.set(cx + (i & 1 ? h : -h), i & 2 ? y1 : y0, cz + (i & 4 ? h : -h)).project(camera)
      const x = (corner.x * .5 + .5) * W, y = (corner.y * .5 + .5) * H
      r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y)
    }
  }
  /** 움직이는 층 전체를 덮는 화면 사각형 (CSS px, 아래가 0): 두더지(기준점 상자 + 뼈대마다 ±0.5m. 점프 중엔 뼈대만 구멍 속으로 움직임) + 링 */
  const dynRect = (): Rect => {
    const r: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    if (mole && mole.object.visible) {
      const p = mole.object.position
      mole.object.updateMatrixWorld(true)
      addBox(r, p.x, p.y - .3, p.y + 1.5, p.z, .62)
      if (!moleBones) { const list: THREE.Object3D[] = []; mole.object.traverse((o) => { if ((o as THREE.Bone).isBone) list.push(o) }); moleBones = list }
      for (const b of moleBones) { b.getWorldPosition(boneP); addBox(r, boneP.x, boneP.y - .5, boneP.y + .5, boneP.z, .5) }
    }
    for (const ring of [hoverRing, targetRing]) if (ring.visible) addBox(r, ring.position.x, 0, .12, ring.position.z, 1.26)
    return r
  }
  /*
   * 그리는 방식 (저사양, A 일 때):
   * - 평소: 배경(bd, layer 0)을 붙이고 움직이는 층(layer 1: 두더지·발밑 그림자·링)만. P 면 그 둘레 사각형만
   * - S(기본, ?fsharp=0 끔): 배경은 1배로 한 번 그려 뒤 2D 캔버스에 깔고(땅굴 S 와 같은 방식), WebGL 캔버스는 투명하게 지운 뒤
   *   bd 의 깊이만 써서 움직이는 층만 낮은 해상도로 → 배경은 선명, 두더지만 0.55배
   * - 카메라가 움직이는 동안(점프 0.4초·패널 이동): R(panScale>0, 기본 0.6)이면 낮은 해상도 렌더 타깃(panBd)에 배경을 그려 늘려 붙이고,
   *   도착한 뒤 두더지 점프가 끝나 조용해질 때까지 그 그림을 그대로 씀. 조용해지면 bd(·S)를 다시 찍음 → 다시 찍는 멈춤이
   *   두더지가 튀어 오르는 동안이 아니라 가만히 서 있을 때 생김. panScale 0 이면 이동 중엔 전체를 그대로 그리고 도착하자마자 다시 찍음
   */
  const drawWith = (bd: Backdrop, full: boolean, sharpLayer: boolean) => {
    const cur = dynRect(), prev = prevRect
    prevRect = cur
    let scissor = false
    if (scissorOk && !full && prev) {
      const pad = 12
      const x0 = Math.max(0, Math.floor(Math.min(cur.x0, prev.x0) - pad)), x1 = Math.min(W, Math.ceil(Math.max(cur.x1, prev.x1) + pad))
      const y0 = Math.max(0, Math.floor(Math.min(cur.y0, prev.y0) - pad)), y1 = Math.min(H, Math.ceil(Math.max(cur.y1, prev.y1) + pad))
      if (x1 <= x0 || y1 <= y0) return // 움직이는 것이 이번에도 지난번에도 안 보임
      renderer.setScissorTest(true); renderer.setScissor(x0, y0, x1 - x0, y1 - y0); scissor = true
    }
    renderer.autoClear = false
    if (sharpLayer) { renderer.clear(true, true, false); bd.blitDepth() } else bd.blit()
    const bg = scene.background
    scene.background = null
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    scene.background = bg
    renderer.autoClear = true
    if (scissor) renderer.setScissorTest(false)
  }

  /* ---------- S 배경은 선명하게 (기본, 땅굴 S 와 같은 방식) ---------- */
  let sharpCv: HTMLCanvasElement | null = null
  let sharpOk = false
  /*
   * 비동기로 읽어 오는 중 (기본, ?fsasync=0 끔). 고해상도 그림을 GPU 버퍼(PBO)로 복사만 걸어 두고(fence), 다 되면 다음 프레임들에서 꺼내
   * 2D 캔버스에 넣음 → 그림을 다 그릴 때까지 메인 스레드가 기다리지 않음. 그동안은 낮은 해상도 배경.
   * (createImageBitmap(WebGL 캔버스) 도 시험했지만 부르는 순간 그림을 기다려서 멈춤이 같았음)
   * 카메라가 움직이면(sharpOff) 걸어 둔 읽기는 버림
   */
  let sharpPending: { pbo: WebGLBuffer; sync: WebGLSync; w: number; h: number; cw: number; ch: number; t0: number } | null = null
  const dropPending = () => {
    if (!sharpPending) return
    const gl = renderer.getContext() as WebGL2RenderingContext
    gl.deleteSync(sharpPending.sync); gl.deleteBuffer(sharpPending.pbo)
    sharpPending = null
  }
  const sharpOff = () => { dropPending(); if (sharpOk) { sharpOk = false; if (sharpCv) sharpCv.style.visibility = 'hidden' } }
  /** 비동기 읽기가 끝났으면 2D 캔버스로 옮김 (매 프레임 확인). 옮겼으면 true */
  const pollSharp = (): boolean => {
    const pd = sharpPending
    if (!pd || !sharpCv) return false
    const gl = renderer.getContext() as WebGL2RenderingContext
    const st = gl.clientWaitSync(pd.sync, 0, 0)
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return false
    noteCapture('sharpWait', pd.t0) // 걸어 둔 뒤 그림이 다 그려지기까지 (그동안 3D 캔버스가 밀림)
    const t0 = performance.now()
    const data = new Uint8Array(pd.w * pd.h * 4)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pd.pbo)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    dropPending()
    // GL 은 아래가 0 → 위아래 뒤집어 ImageData 로
    const img = new ImageData(pd.w, pd.h), row = pd.w * 4
    for (let y = 0; y < pd.h; y++) img.data.set(data.subarray((pd.h - 1 - y) * row, (pd.h - y) * row), y * row)
    const cv = sharpCv
    cv.width = pd.cw; cv.height = pd.ch
    const ctx = cv.getContext('2d')!
    if (pd.w === pd.cw && pd.h === pd.ch) ctx.putImageData(img, 0, 0)
    else {
      const tmp = document.createElement('canvas'); tmp.width = pd.w; tmp.height = pd.h
      tmp.getContext('2d')!.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(tmp, 0, 0, pd.cw, pd.ch)
    }
    cv.style.visibility = 'visible'
    sharpOk = true
    noteCapture('sharpPut', t0)
    return true
  }
  /** 배경(layer 0)을 고해상도로 그려 2D 캔버스에 옮김. 끝나면 원래 해상도 (그리기 버퍼를 다시 잡으므로 다음 프레임은 전체) */
  const captureSharp = () => {
    if (!sharpCv) {
      sharpCv = document.createElement('canvas')
      sharpCv.setAttribute('aria-hidden', 'true')
      sharpCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
      container.insertBefore(sharpCv, renderer.domElement)
    }
    const t0 = performance.now()
    const out = Math.min(window.devicePixelRatio || 1, 2)
    // 슈퍼샘플: 기본은 땅굴과 같이 1.5배, 한 번에 그리는 픽셀이 400만을 넘지 않게. ?fss=1 처럼 고정 가능
    const ss = sharpSS > 0 ? sharpSS * out : Math.max(out, Math.min(out * 1.5, Math.sqrt(4e6 / (W * H))))
    const prevPR = renderer.getPixelRatio()
    renderer.setPixelRatio(ss)
    renderer.setScissorTest(false); renderer.autoClear = true
    const mask = camera.layers.mask
    camera.layers.set(0)
    renderer.render(scene, camera)
    camera.layers.mask = mask
    const cw = Math.round(W * out), ch = Math.round(H * out), cv = sharpCv
    const put = (src: CanvasImageSource) => {
      cv.width = cw; cv.height = ch
      const ctx = cv.getContext('2d')!
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src, 0, 0, cw, ch)
      cv.style.visibility = 'visible'
      sharpOk = true
    }
    // 비동기(기본): 읽기를 걸어 두고 바로 돌아감 (pollSharp 가 나중에 옮김)
    const gl = renderer.getContext() as WebGL2RenderingContext
    if (sharpAsync && typeof gl.fenceSync === 'function') {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const pbo = gl.createBuffer()!
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo)
      gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!
      gl.flush()
      sharpPending = { pbo, sync, w, h, cw, ch, t0 }
      renderer.setPixelRatio(prevPR)
      noteCapture('sharp', t0)
      return
    }
    put(renderer.domElement)
    renderer.setPixelRatio(prevPR)
    noteCapture('sharp', t0)
  }
  /** 측정용: 배경을 다시 찍는 데 든 시간 (메인 스레드, ms) */
  const noteCapture = (kind: string, t0: number) => {
    const ms = performance.now() - t0
    const w = window as unknown as { __captures?: [string, number][] }
    ;(w.__captures ??= []).push([kind, Math.round(ms)])
    // 느린 PC 는 S 를 끔: 선명한 배경이 준비되기까지 SHARP_SLOW_MS 를 넘은 적이 두 번이면 이 장면에서는 0.55배 배경만 (A_R).
    // 비동기면 걸어 둔 뒤 그림이 다 그려지기까지(sharpWait, 그동안 3D 가 밀림), 아니면 메인 스레드가 막힌 시간(sharp)
    if (kind === (sharpAsync ? 'sharpWait' : 'sharp') && ms > SHARP_SLOW_MS && ++sharpStrikes >= 2 && sharpField) {
      sharpField = false
      console.info(`[3D] 선명한 배경을 찍는 데 ${Math.round(ms)}ms 걸려서 이 PC 에서는 끔`)
    }
  }
  let sharpStrikes = 0

  /** 조용해진 시각 (카메라·점프가 끝난 뒤). 이때부터 interimFor 초가 지나면 bd(·S)를 다시 찍음 */
  let lowActive = false
  let quietT = 0
  const drawStatic = (full: boolean, dt: number) => {
    const bd = backdrop!
    const quiet = !anim && focus === focusTarget
    quietT = quiet ? quietT + dt : 0
    if (lowActive && panBd && quietT < .12) { drawWith(panBd, full, false); return }
    if (lowActive) { lowActive = false; full = true }
    if (bd.isDirty()) { const t0 = performance.now(); bd.capture(scene, camera); noteCapture('bd', t0); full = true }
    if (sharpPending && pollSharp()) full = true
    else if (sharpField && !sharpOk && !sharpPending && quiet && mole) { captureSharp(); full = true } // 다 불러온 뒤에만 (빈 장면을 찍지 않게)
    drawWith(bd, full, sharpOk)
  }
  const drawMoving = () => {
    sharpOff()
    backdrop!.invalidate(); prevRect = null; fullNext = true
    if (panScale > 0) {
      // 낮은 해상도 배경 + 움직이는 층(목표 링). 도착하면 이 그림을 잠깐 그대로 씀 (lowActive)
      panBd ??= createBackdrop(renderer, { scale: panScale })
      panBd.capture(scene, camera)
      drawWith(panBd, true, false)
      lowActive = true
    } else renderer.render(scene, camera)
  }

  /* ---------- 측정용: 같은 장면 스크린샷 (?qshot=1): 두더지 자세 고정 + 화면 위치 알림 ---------- */
  const reportMole = () => {
    if (!mole) return
    const box = new THREE.Box3().setFromObject(mole.object)
    const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
      const x = (corner.x * .5 + .5) * W, y = (1 - (corner.y * .5 + .5)) * H
      r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y)
    }
    const c = container.getBoundingClientRect()
    ;(window as unknown as { __moleRect?: unknown }).__moleRect = { x0: Math.round(c.left + r.x0), y0: Math.round(c.top + r.y0), x1: Math.round(c.left + r.x1), y1: Math.round(c.top + r.y1), scene: { x0: Math.round(c.left), y0: Math.round(c.top), x1: Math.round(c.right), y1: Math.round(c.bottom) } }
  }

  /* ---------- 루프 ---------- */
  // 불러오기(위 async)가 끝나면 부름. 함수 선언이라 loop 보다 먼저 적어도 됨
  function markReady() { loop.ready() }
  let pulse = 0
  const loop = startLoop(container, {
    resize(w, h) { W = w; H = h; renderer.setSize(w, h, false); applyFrame(); lastAnchor = ''; backdrop?.invalidate(); sharpOff(); lowActive = false; fullNext = true },
    frame(dt) {
      if (warming) return
      const full = fullNext || dt === 0
      fullNext = false
      // 카메라 구도가 바뀌는 프레임(패널 이동·점프 카메라)은 따로 (drawMoving), 멈추면 A 배경을 다시 찍음
      let camMoved = false
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); lastAnchor = ''; camMoved = true }
      if (stepAnim(dt)) camMoved = true
      if (!qshot) mole?.update(dt)
      if (targetRing.visible) { pulse += dt; (targetRing.material as THREE.MeshBasicMaterial).opacity = .65 + .3 * Math.sin(pulse * 9) }
      if (camMoved && anim) (window as unknown as { __panT?: number[] }).__panT?.push(performance.now()) // 측정용 (cdp-scene.mjs 가 배열을 만들어 둔 경우만)
      if (!backdrop) renderer.render(scene, camera)
      else if (camMoved) drawMoving()
      else drawStatic(full, dt)
      emitAnchor()
      if (anim || focus !== focusTarget) emitHover()
      if (qshot) reportMole()
    },
    busy: () => spin || !!anim || focus !== focusTarget || (!!mole && !mole.isResting()) || (!!backdrop && (lowActive || (sharpField && !sharpOk && !!mole))),
    downgrade(nq) {
      renderer.setPixelRatio(nq.pixelRatio)
      sun.castShadow = false; renderer.shadowMap.enabled = false
      // 자동으로 저사양이 됐을 때도 A 는 켬 (부분 사각형은 preserveDrawingBuffer 가 없어서 전체 붙이기만)
      if (useA() && !backdrop) backdrop = createBackdrop(renderer, { scale: bdScale })
    },
  }, q)

  return {
    loaded: loaded.then(() => undefined),
    resize: () => loop.resize(),
    setFrozen: (on) => loop.setFrozen(on),
    setFocusX(x) {
      focusTarget = x
      if (document.hidden) { focus = x; applyFrame(); backdrop?.invalidate(); fullNext = true }
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
      dropPending()
      backdrop?.dispose(); panBd?.dispose()
      envTex?.dispose()
      sun.shadow.dispose()
      destroyRenderer(renderer)
    },
  }
}
