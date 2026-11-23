import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadGlb } from './glb'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { gradientEnv, FIELD_ENV } from './lighting'
import { blobShadow } from './roomLook'
import { createBackdrop, toDynamicLayer, type Backdrop } from './staticBackdrop'
import { createSharpBaker, type SharpBaker } from './sharpBake'
import { createGlSlide, createSlide, type GlSlide, type Slide } from './moveSlide'
import { waitGpu, warmScene } from './warm'
import { getCachedStill, peekCachedStill, putCachedStill, stillKey } from './stills'
import { approach, createRenderer, destroyRenderer, frameCamera, quality, startLoop, testParam, type SceneHandle } from './engine'
import { onLowTierChange } from '../lib/deviceTier'
import { createFieldFx, type FieldFx } from './interestFx/fieldFx'
import type { HoleFx } from '../data/interestFx'
import { CAM_FOV, CAM_PITCH, ZOOM_DIST, ZOOM_LEVELS, ZOOM_LOD, ZOOM_SEC, camTargetAt, distAt, dragLimits, dragTarget, easeStd, holeScaleAt, lodAt, moleScaleAt, type ZoomLevel } from './fieldCam'
import { clipRingPiece, closurePieces, ringOf } from './fieldFence'
import groundUrl from '../assets/models/field/explore_ground_150_v3.glb?url'
import holeUrl from '../assets/models/field/hole_v2.glb?url'
import haloUrl from '../assets/models/field/hole_mine_halo.glb?url'
import padUrl from '../assets/models/field/empty_pad.glb?url'
import pathUrl from '../assets/models/field/path_kit.glb?url'
import ladderUrl from '../assets/models/field/ladder_shaft.glb?url'
import fenceUrl from '../assets/models/field/fence.glb?url'
import tuftUrl from '../assets/models/field/grass_tuft_small.glb?url'
import flowersUrl from '../assets/models/field/flowers.glb?url'

/*
 * 탐색 들판 (3D 핸드오프 v3.11 층 단위 150자리 + v3.8 "두더지 잡기" 이동). 설명은 docs/explore-field-v3-9.md · docs/explore-field-v3-10.md
 *   v3.11 (시험 브랜치 try/explore-v3-11): 작물 9종 · 딸기 v3 · 카메라 v1.2(어느 단계에서도 구멍을 따라감, 구멍·작물 크기 거리에 연속)
 *
 * - 배치: data/fieldLayout150.json (원본 explore_field_layout_150_v3_11.json 을 app/scripts/build-field-layout.mjs 로 줄인 것). 모든 좌표 절대값
 * - common(땅·사다리·울타리)은 항상, zones[k](구멍·길·작물·꽃·풀 뭉치)는 켜진 구역만. 경계 길은 구역 번호 순서로 links add/replace 적용
 * - v3.10 바닥: 슬랩 전체가 잔디(정점 색). 흙은 노드로 따로: soil_zoneN 은 구역 N 이 켜질 때, soil_link_N_M 은 N·M 둘 다 켜졌을 때만.
 *   안 켠 구역은 아무것도 안 놓아서 잔디만 보임 (v3.9 의 잔디색 덮개 평면은 없앰). 울타리는 켜진 구역 안에 있는 것만
 * - 작물: 층마다 한 종류 (opts.crop = 테마 id, 층 → 작물은 data/field.ts cropOf). 호박은 구역 기본 슬롯, 다른 작물은 그 작물 전용 슬롯
 * - 인스턴싱: 노드(부품)마다, 12m 칸마다 InstancedMesh 하나 → 칸 단위로 화면 밖은 안 그림(frustum culling)
 * - 구멍: hole_inner 는 그대로, hole_rim 만 인스턴스 색. 내 구멍은 분홍 링 + 후광. 배정 안 된 자리는 빈 자리(empty_pad)
 * - 카메라: 세로 FOV 32.3°, 내려다보기 45°, 거리 near 12 / mid 24 / far 46m (줌, fieldCam.ts). 타깃은 어느 단계에서도 두더지가 있는 구멍을 따라감
 *   (구멍 중앙 정렬 허용, 한계는 바깥 잔디 안전 한계뿐). far 에서 켠 구역이 1개면 맞춤 타깃에서 ±9m 까지만 따라감
 * - 줌 전환 0.5초: 거리 로그 보간 + 타깃 같은 비율로. 단계별 표시(LOD: 꽃·풀 뭉치·작물·구멍·두더지 배율)는 거리 기준 히스테리시스로 한 번에 바꿈.
 *   저사양(M 이동 중 선명)은 도착 구도를 미리 굽고(점프와 같은 prep) 그동안 지금 그림을 옮겨 그림 → 도착 구도의 LOD 를 전환 시작에 바로 적용
 * - 이동: mole_hop_down(0.42s) → 숨김 → 카메라 0.4s(far 0.35s, 12m 넘으면 +0.1s) → 보임 + mole_hop_up(0.5s) → idle. 이동·줌 중엔 입력 잠금
 * - 저사양(그래픽 가속 꺼짐, docs/rendering-experiments-2.md):
 *   A 들판은 렌더 타깃에 한 번 그리고(staticBackdrop.ts) 매 프레임은 붙인 뒤 움직이는 층(두더지·발밑 그림자·링)만.
 *     CPU 렌더러(WARP)는 화면 가득한 땅·풀의 재질 계산이 병목이라(한 프레임 CPU 약 0.36초) 들판을 다시 안 그리는 게 가장 큼.
 *     카메라가 움직이는 0.4초(점프 이동)·패널 이동 중에만 전체를 그리고, 멈추면 다시 찍음
 *   P 두더지 둘레 사각형만 다시 그림 (지난 그림을 남겨 둠, 땅굴·옛 밭과 같은 방식)
 *   예열: 셰이더 미리 컴파일 + 물체마다 1×1 그리기를 나눠서 → 들어올 때 첫 프레임 0.5초 멈춤을 짧은 작업 여럿으로 (땅굴과 같은 방식)
 *   S 배경 선명: 1배 배경을 렌더 타깃에 띠로 나눠 여러 프레임에 굽고(MSAA) 비동기로 읽어 뒤 2D 캔버스에 (sharpBake.ts, docs/rendering-experiments-3.md)
 *   M 이동 중에도 선명 (2026-11-17, docs/explore-move-quality.md): 점프를 시작하면 도착할 자리를 미리 굽고(prep, 두더지가 땅속에 있는 동안),
 *     카메라가 움직이는 0.4초는 떠날 자리·도착할 자리 그림을 띠로 잘라 화면 합성기로 밀어 보여 줌(moveSlide.ts). 도착하면 미리 구운 그림이
 *     바로 선명한 배경이 됨 → 예전의 "이동 중 0.33배 → 도착 후 다시 굽기"가 없음. 움직이는 층(layer 1)은 굽지 않고 계속 3D 로 그림
 */

type Item = [node: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number]
type Tile = { cell: string; t: Item }
interface Zone {
  zone: number; name: string; seats: [number, number]
  bounds: { x: [number, number]; z: [number, number] }
  camRect: { x: [number, number]; z: [number, number] }
  holes: [seat: number, x: number, z: number, ry: number, s: number, ring: number][]
  paths: Tile[]; linkAdd: Tile[]; linkReplace: Tile[]
  /** 풀 뭉치 · 작물 기본 슬롯(호박) · 꽃 */
  tufts: Item[]; crops: Item[]; flowers: Item[]
}
/** 작물 테마 (v3.10 themes 5종 → v3.11 9종). crops = 구역마다 그 작물 전용 슬롯 (호박은 null = 구역 기본 슬롯) */
export interface CropTheme { id: string; glb: string; nodes: string[]; grass: string; soil: string; crops: Item[][] | null }
export interface FieldLayout {
  mineRing: string
  rings: string[]
  nodes: string[]
  /** 흙 노드 규칙: byZone[N] = 구역 N 안쪽 흙, links = 두 구역이 모두 켜졌을 때만 */
  soil: { byZone: Record<string, string>; links: { node: string; zones: [number, number] }[]; always: string[] }
  themes: CropTheme[]
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
  /** 줌 단계가 바뀜 (전환 시작 때. 전환 0.5초) */
  onZoom?(level: ZoomLevel): void
  /** 마우스로 끌어 카메라 타깃이 구멍에서 떨어졌을 때 지금 타깃 (three x·z, 끄는 동안 계속). 점프·줌이 시작되면 구멍으로 돌아가며 따로 알리지 않음 */
  onCamera?(x: number, z: number): void
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
  /** 관심사 이펙트 (three/interestFx/fieldFx.ts, docs/interest-effects.md): 자리마다 대표 관심사·겹침·드문 정도·접속 */
  fx?: HoleFx[]
  /** 이 층의 작물 테마 id (v3.11 themes 9종: pumpkin · apple · strawberry · sweetpotato · carrot · corn · tomato · sunflower · bread). 없으면 호박 */
  crop?: string
  /** 처음 줌 단계 (기본 near) */
  zoom?: ZoomLevel
}

export interface HoleFieldHandle extends SceneHandle {
  /** 방향키: 화면 기준 그 방향 ±45° 안에서 가장 가까운 구멍으로 점프. 없으면 false */
  move(dir: Dir): boolean
  /** 그 자리로 바로 점프 (사이 구멍을 거치지 않음) */
  goSeat(seat: number): boolean
  /** 지금 이동(점프·줌) 중인지 */
  busy(): boolean
  /** 줌 단계로 (0.5초 전환). 이동 중이거나 같은 단계면 false */
  zoom(level: ZoomLevel): boolean
  /** 한 단계 멀리(+1) / 가까이(−1) */
  zoomBy(step: 1 | -1): boolean
  zoomLevel(): ZoomLevel
}

const CELL = 12 // 컬링 칸 크기 (구역 36m = 3칸)
/**
 * S 선명한 배경을 끄는 기준 (ms, 두 번 넘으면). 한 번에 굽는 경우(?fstrips=1)만: 16스레드 WARP 는 약 60~120ms, CPU 2코어는 300ms 넘음 (docs/rendering-experiments-2.md).
 * 띠로 나눠 구우면(기본) 한 프레임 일이 작아서 끄지 않음 (docs/rendering-experiments-3.md)
 */
const SHARP_SLOW_MS = 200
const FOV = CAM_FOV
const ANCHOR_Y = 0.075 // 구멍 바닥 = 두더지 발 (구멍 배율만큼 높아짐: far ×1.25)
/** 카메라 이동 시간 (camera_zoom_spec 5: near·mid 0.4, far 0.35, 12m 넘는 점프 +0.1) */
const HOP_CAM = 0.4, HOP_CAM_FAR = 0.35, HOP_CAM_LONG = 0.1
/** M: 도착할 자리 그림이 아직이면 두더지가 땅속에서 이만큼(초)까지 더 기다림 (2코어급에서 굽기가 hop_down 0.42초보다 김) */
const HOLD_MAX = 0.9
/**
 * M: 줌 아웃 키를 누른 뒤 도착 구도 그림을 기다리는 최대 시간 (초, 강한 PC / 약한 PC). 그동안 화면은 그대로 (docs/explore-field-v3-10.md 저사양 측정).
 * 기다리지 않으면 지금 그림이 덮지 못하는 바깥을 매 프레임 3D 로 메우느라 2코어에서 4~5fps 였음
 */
const ZOOM_HOLD = 0.35, ZOOM_HOLD_WEAK = 1.2
/** M: 이동 중 빈 곳(두 그림 다 못 덮는 곳)이 화면의 이 비율보다 크면 메움을 낮은 해상도(panScale)로 */
const FILL_LOW_FRAC = 0.3
const HIT_R = 1.05 // 구멍 클릭 반지름 (테두리 지름 약 2m)
const LADDER_POS = new THREE.Vector3(0, 0, -2)

let layoutP: Promise<FieldLayout> | null = null
const loadLayout = () => (layoutP ??= import('../data/fieldLayout150.json').then((m) => m.default as unknown as FieldLayout))

const GLB: Record<string, string> = {
  path_kit: pathUrl, grass_tuft_small: tuftUrl, flowers: flowersUrl, ladder_shaft: ladderUrl, fence: fenceUrl,
}
/** 작물 glb 는 그 층 것 하나만 받음 (공유 빌드는 glb 가 JS 에 들어가서 아홉 개를 한 청크에 넣지 않게 따로 불러옴) */
const CROP_GLB: Record<string, () => Promise<{ default: string }>> = {
  vine_patch: () => import('../assets/models/field/vine_patch.glb?url'),
  apple_patch: () => import('../assets/models/field/apple_patch.glb?url'),
  strawberry_patch_v3: () => import('../assets/models/field/strawberry_patch_v3.glb?url'),
  sweetpotato_patch: () => import('../assets/models/field/sweetpotato_patch.glb?url'),
  carrot_patch_v2: () => import('../assets/models/field/carrot_patch_v2.glb?url'),
  corn_patch: () => import('../assets/models/field/corn_patch.glb?url'),
  tomato_patch: () => import('../assets/models/field/tomato_patch.glb?url'),
  sunflower_patch: () => import('../assets/models/field/sunflower_patch.glb?url'),
  bread_patch_v2: () => import('../assets/models/field/bread_patch_v2.glb?url'),
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
  const wantA = () => q.level === 'low' && !!q.lab?.A && testParam('fa') !== '0'
  const scissorOk = wantA() && (q.lab?.P ?? true) && testParam('partial') !== '0'
  /*
   * S 배경은 선명하게 (아래 baker, 기본 켬 2026-11-16 docs/rendering-experiments-2.md): WebGL 캔버스를 투명하게 두고
   * 뒤 2D 캔버스에 1배(기기 배율) 배경, 두더지·링만 0.55배. 실험실 S 를 따름. 시험용 ?fsharp=0 끔.
   * 2026-11-16 3차: 굽기는 sharpBake.ts (렌더 타깃에 띠로 나눠, MSAA, 비동기 읽기). 띠 수·MSAA 는 기기 단계(q.bakeStrips·bakeSamples),
   * 시험용 ?fstrips=1 (한 번에) ?fmsaa=0
   */
  let sharpField = wantA() && (q.lab?.S ?? true) && testParam('fsharp') !== '0'
  let bakeStrips = +(testParam('fstrips') ?? q.bakeStrips)
  let bakeSamples = +(testParam('fmsaa') ?? q.bakeSamples)
  const renderer = createRenderer(container, { alpha: sharpField, exposure: 1.0, shadowType: THREE.PCFSoftShadowMap, quality: q, preserve: scissorOk })
  // 배경 렌더 타깃 배율 (?bdscale=2 → 캔버스의 2배로 그려 붙일 때 2×2 평균 = 안티앨리어싱)
  const bdScale = +(testParam('bdscale') ?? '1').replace('_', '.')
  let backdrop: Backdrop | null = wantA() ? createBackdrop(renderer, { scale: bdScale, kind: 'hole' }) : null
  // R 카메라가 움직이는 동안 낮은 해상도 배경 (캔버스 대비 배율, 0 = 끔, 기본 기기 단계 strong 0.6 → 0.33배, weak 0.4 → 0.22배). 시험용 ?panscale=0_6
  let panScale = +(testParam('panscale') ?? String(q.panScale)).replace('_', '.')
  let panBd: Backdrop | null = null
  /** 기기 단계가 바뀌어 낮은 해상도 배경을 새 배율로 다시 만들어야 함 (다음 카메라 이동 때) */
  let panStale = false
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
  /** 지금 줌 단계(목표)와 카메라 거리 (전환 중엔 사이 값) */
  let level: ZoomLevel = opts.zoom && ZOOM_LEVELS.includes(opts.zoom) ? opts.zoom : 'near'
  let dist = ZOOM_DIST[level]
  const offFor = (d: number, out = new THREE.Vector3()) => out.set(0, Math.sin(CAM_PITCH) * d, Math.cos(CAM_PITCH) * d)
  const camOff = offFor(dist)
  /** 거리에 맞춘 near·far 면 (멀리서도 흙 띠 0.004m 가 잔디와 깊이 다툼 없게 near 를 거리에 비례) */
  const setPlanes = (cam: THREE.PerspectiveCamera, d: number) => { cam.near = 0.5 * d / ZOOM_DIST.near; cam.far = Math.max(120, d * 3); cam.updateProjectionMatrix() }
  setPlanes(camera, dist)
  const setDist = (d: number) => { if (d === dist) return; dist = d; offFor(d, camOff); setPlanes(camera, d) }
  const target = new THREE.Vector3()
  const placeCamera = () => { camera.position.copy(target).add(camOff); camera.lookAt(target); camera.updateMatrixWorld() }
  /** 지금 카메라(구도·화면 밀기)를 복제해 타깃 t·거리 d 에 놓은 것 (미리 굽기용) */
  const camAt = (t: THREE.Vector3, d: number) => {
    const c = camera.clone()
    setPlanes(c, d)
    c.position.copy(t).add(offFor(d)); c.lookAt(t); c.updateMatrixWorld()
    return c
  }

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
  let shadowHalf = 15
  const followSun = () => {
    // 그림자 상자를 화면 가운데에 따라 붙임 (들판 108×72 전체에 그림자 맵 하나를 펴면 너무 흐림). 멀리 볼수록 상자도 크게 (near 30m → far 약 115m)
    const half = Math.round(15 * dist / ZOOM_DIST.near)
    if (half !== shadowHalf) {
      shadowHalf = half
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: 60 + half * 2 })
      sun.shadow.camera.updateProjectionMatrix()
    }
    sun.target.position.set(target.x, 0, target.z - 1.5 * dist / ZOOM_DIST.near)
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 30 + half)
    sun.target.updateMatrixWorld()
  }

  let disposed = false
  /** 이 장면에서 새로 만든 지오메트리·재질 (glb 원본은 캐시라 남김) */
  const own: { dispose(): void }[] = []
  let mole: MoleActor | null = null
  let moleBlob: THREE.Mesh | null = null
  /** 관심사 이펙트 (3D 위 2D 겹 캔버스. 배경 굽기·이동 경로와 상관없음) */
  let fieldFx: FieldFx | null = null
  const holes = new Map<number, HoleInfo>() // 구멍이 있는 자리만
  /** 켜진 구역 (카메라 타깃 한계) */
  let zonesOn: Zone[] = []
  let curSeat = opts.startSeat
  /** 점프 이동. phase: down(두더지 들어감) → dig(M: 도착 그림을 기다림) → cam(카메라 이동) → up. slide = 카메라 이동을 띠 밀기로(M) */
  /** 마우스로 끌어 카메라가 구멍을 따라가는 타깃에서 떨어져 있음. 점프·줌이 시작되면 풀림 (그 뒤 camTarget 이 구멍 타깃으로 보간). 구운 배경 캐시를 읽고 쓰지 않는 조건 */
  let panned = false
  /** 끄는 중 (포인터를 잡은 때부터). active = 6px 넘게 움직여 실제로 끌기 시작. cam = 잡았을 때 카메라 복제(땅 위 점을 늘 같은 카메라로 계산), t0 = 그때 타깃, g0 = 잡은 땅 점 */
  let drag: { id: number; sx: number; sy: number; active: boolean; cam: THREE.PerspectiveCamera; t0: THREE.Vector3; g0: THREE.Vector3 } | null = null
  /** 끌어서 이번 프레임에 카메라가 움직임 (루프가 camMoved 로 다룸) */
  let panDirty = false
  let anim: { from: number; to: number; t: number; phase: 'down' | 'dig' | 'cam' | 'up'; dur: number; camFrom: THREE.Vector3; camTo: THREE.Vector3; camDur: number; still: boolean; slide?: boolean; k?: number } | null = null

  /** 줌 전환 (거리 d0 → d1, 타깃 t0 → t1). slide = 저사양 M: 지금 그림을 옮기며 도착 구도를 미리 굽는 중 */
  let zoomAnim: { d0: number; d1: number; t0: THREE.Vector3; t1: THREE.Vector3; t: number; slide: boolean; k: number; hold: number; holdMax: number } | null = null
  /** 줌은 끝났는데 도착 구도 그림이 아직 (저사양 M): 그동안 옮긴 그림을 계속 보여 줌 */
  let zoomWait = false
  /** 지금 장면에 적용된 단계별 표시 (LOD) */
  let lodLevel: ZoomLevel = level
  /** 지금 구멍 배율 (far 1.25): 두더지 높이·클릭 반지름·하이라이트 링 */
  let holeScale = ZOOM_LOD[lodLevel].hole

  // 하이라이트 링 (마우스를 올린 구멍 · 이동 목표)
  const ringGeo = new THREE.RingGeometry(1.02, 1.22, 48).rotateX(-Math.PI / 2)
  const hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75, depthWrite: false }))
  hoverRing.visible = false; hoverRing.renderOrder = 2; hoverRing.layers.set(1); scene.add(hoverRing)
  const targetRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, opacity: .95, depthWrite: false }))
  targetRing.visible = false; targetRing.renderOrder = 2; targetRing.layers.set(1); scene.add(targetRing)
  let hoverSeat: number | null = null

  /** 카메라 목표점: 그 구멍을 그대로 따라가고(안전 한계 안), far 에서 켠 구역이 1개면 맞춤 ±9m (fieldCam.ts camTargetAt) */
  const clampTarget = (p: THREE.Vector3, lv: ZoomLevel = level) => {
    const [x, z] = camTargetAt(lv, zonesOn, p.x, p.z)
    return p.set(x, 0, z)
  }
  const holeVec = (seat: number, y = 0) => { const h = holes.get(seat)!; return new THREE.Vector3(h.x, y, h.z) }
  /** 이 층 작물 테마 (없는 id 면 첫 테마 = 호박) */
  const themeOf = (L: FieldLayout) => L.themes.find((t) => t.id === (opts.crop ?? 'pumpkin')) ?? L.themes[0]

  /* ---------- 불러오기 ---------- */
  const loaded = (async () => {
    const lp = loadLayout()
    // 이 층 작물 glb 하나만 (배치의 테마 표에서 파일 이름을 찾음)
    const cropP = lp.then(async (L) => {
      const th = themeOf(L)
      const f = CROP_GLB[th.glb]
      if (!f) { console.warn(`[들판] 작물 glb 없음: ${th.glb}`); return null }
      return { key: th.glb, gltf: await loadGlb((await f()).default) }
    })
    const [layout, ground, hole, halo, pad, moleG, acc, cropG] = await Promise.all([
      lp, loadGlb(groundUrl), loadGlb(holeUrl), loadGlb(haloUrl), loadGlb(padUrl), loadMoleGltf(),
      q.level === 'low' && q.lab?.F ? Promise.resolve(undefined) : loadAccessories().catch(() => undefined),
      cropP,
    ])
    const glbs: Record<string, GLTF> = {}
    await Promise.all(Object.entries(GLB).map(async ([k, url]) => { glbs[k] = await loadGlb(url) }))
    if (cropG) glbs[cropG.key] = cropG.gltf
    if (disposed) return
    build(layout, { ground, hole, halo, pad, glbs })
    if (opts.fx) fieldFx = createFieldFx({ container, after: renderer.domElement, camera, holes, seats: opts.fx, here: () => ({ seat: anim ? anim.to : curSeat, moving: !!anim }), dist: () => dist })
    // 두더지 (배율은 줌 거리에 따라: near 1 · mid 1.15 · far 1.5)
    const start = holes.has(curSeat) ? holeVec(curSeat, anchorY()) : new THREE.Vector3(1.9, 0, -3.4) // 구멍이 하나도 없으면 사다리 옆 흙 위
    mole = createMoleActor(moleG, {
      scale: 1, start, yaw: 0, drop: false, lookEvery: [7, 14], floorY: ANCHOR_Y, acc, worn: opts.worn,
      simple: q.level === 'low' && !!q.lab?.F,
    })
    toDynamicLayer(mole.object)
    applyMoleScale()
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
      moleBlob.position.set(start.x + .08, .085 * holeScale, start.z - .05)
      moleBlob.layers.set(1)
      scene.add(moleBlob)
      applyMoleScale()
    }
    target.copy(start).setY(0); clampTarget(target); placeCamera(); followSun()
    if (precompile) await warm()
    if (disposed) return
    // M: 약한 PC(띠 밀기)면 띠 캔버스를 쉬는 틈에 미리 만들어 둠
    prebuildSoon(1500)
    ev.onStand?.(curSeat)
    markReady()
  })().catch((e) => { console.warn('[들판] 불러오지 못했어요', e) })

  function build(L: FieldLayout, m: { ground: GLTF; hole: GLTF; halo: GLTF; pad: GLTF; glbs: Record<string, GLTF> }) {
    const on = L.zones.filter((z) => z.zone <= Math.max(1, Math.min(6, opts.zones)))
    zonesOn = on
    const lit = new Set(on.map((z) => z.zone))
    const inOn = (x: number, z: number) => on.some((zn) => x >= zn.bounds.x[0] - .01 && x <= zn.bounds.x[1] + .01 && z <= zn.bounds.z[0] + .01 && z >= zn.bounds.z[1] - .01)

    // 땅: 잔디 슬랩 + 바깥 잔디는 항상, 흙은 규칙대로 (soil_zoneN = 구역 N 켜짐, soil_link_N_M = N·M 둘 다 켜짐). 그림자 받기만
    const g = m.ground.scene.clone(true)
    const soilOn = new Set<string>()
    for (const z of on) { const n = L.soil.byZone[String(z.zone)]; if (n) soilOn.add(n) }
    for (const l of L.soil.links) if (lit.has(l.zones[0]) && lit.has(l.zones[1])) soilOn.add(l.node)
    const soilNodes = new Set([...Object.values(L.soil.byZone), ...L.soil.links.map((l) => l.node)])
    const dropNodes: THREE.Object3D[] = []
    g.traverse((o) => {
      if (soilNodes.has(o.name) && (!soilOn.has(o.name) || hide.has('soil'))) { dropNodes.push(o); return }
      const mm = o as THREE.Mesh
      if (mm.isMesh) { mm.receiveShadow = true; mm.material = swapMat(mm.material as THREE.Material) }
    })
    dropNodes.forEach((o) => o.removeFromParent()) // 숨기기보다 빼는 쪽이 예열·굽기에서 건너뛰기 쉬움
    if (testParam('soilsplit') !== '0') {
      const soilMeshes: THREE.Mesh[] = []
      g.traverse((o) => { if (soilNodes.has(o.name) && (o as THREE.Mesh).isMesh) soilMeshes.push(o as THREE.Mesh) })
      soilMeshes.forEach(splitSoil)
    }
    matchOuterGrass(g)
    if (!hide.has('ground')) scene.add(g)

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
    // 작물은 층 테마 (opts.crop). 호박은 구역 기본 슬롯, 다른 작물은 그 작물 전용 슬롯
    const theme = themeOf(L)
    if (!m.glbs[theme.glb]) console.warn(`[들판] 작물 glb 없음: ${theme.glb}`)

    // 칸 × 노드별로 모음. kind = 단계별 표시(LOD)로 따로 다룰 묶음
    type Kind = 'base' | 'tuft' | 'crop' | 'flower'
    const buckets = new Map<string, { node: number; mats: THREE.Matrix4[]; cast: boolean; kind: Kind; even: number }>()
    const put = (it: Item, cast: boolean, kind: Kind = 'base', odd = false) => {
      const k = `${cellKey(it[1], it[3])}|${it[0]}|${kind}`
      let b = buckets.get(k)
      if (!b) buckets.set(k, (b = { node: it[0], mats: [], cast, kind, even: 0 }))
      // 꽃: mid 는 짝수 번째만 → 짝수 번째를 앞에 모아 두고 count 로 자름
      if (kind === 'flower' && !odd) { b.mats.splice(b.even, 0, itemMatrix(it)); b.even++ } else b.mats.push(itemMatrix(it))
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
      if (!hide.has('tufts')) z.tufts.forEach((it) => put(it, false, 'tuft'))
      if (!hide.has('crops')) (theme.crops ? theme.crops[z.zone - 1] ?? [] : z.crops).forEach((it) => put(it, q.shadows, 'crop'))
      if (!hide.has('flowers')) z.flowers.forEach((it, i) => put(it, false, 'flower', i % 2 === 1))
    }
    if (!hide.has('fence')) {
      if (testParam('fence') === '0') L.fence.forEach((it) => { if (inOn(it[1], it[3])) put(it, q.shadows) }) // 예전(켠 구역 안 조각만, 경계에서 끊김) 시험용
      else {
        // 켠 구역 둘레를 따라 닫음 (fieldFence.ts): 둘레 조각은 켠 구역을 1.5m 넓힌 범위 안만 (걸친 조각은 잘라서), 안 켠 쪽 경계엔 새 길을 세움
        const ring = ringOf(L.fence.map((it) => ({ x: it[1], z: it[3] })))
        const f0 = L.fence[0]
        for (const it of L.fence) for (const c of clipRingPiece({ x: it[1], z: it[3], ry: it[4], sx: it[5] }, on, ring)) put([it[0], c.x, it[2], c.z, c.ry, c.sx, it[6], it[7]], q.shadows)
        for (const c of closurePieces(on, ring)) put([f0[0], c.x, f0[2], c.z, c.ry, c.sx, f0[6], f0[7]], q.shadows)
      }
    }
    put(L.ladder, q.shadows)

    const addInst = (pp: Part[], mats: THREE.Matrix4[], cast: boolean, colors?: THREE.Color[], group?: LodGroup, even = 0) => {
      for (const p of pp) {
        const im = new THREE.InstancedMesh(p.geo, swapMat(p.mat), mats.length)
        mats.forEach((mm, i) => im.setMatrixAt(i, tmpM.multiplyMatrices(mm, p.local)))
        colors?.forEach((c, i) => im.setColorAt(i, c))
        im.computeBoundingSphere()
        im.castShadow = cast; im.receiveShadow = true
        scene.add(im)
        group?.push({ im, mats, local: p.local, n: mats.length, even })
      }
    }
    buckets.forEach((b) => addInst(parts(b.node), b.mats, b.cast, undefined, b.kind === 'base' ? undefined : lodGroups[b.kind], b.even))

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
    hb.forEach((b) => { addInst(holeParts.inner, b.mats, false, undefined, lodGroups.hole); addInst(holeParts.rim, b.mats, false, b.colors, lodGroups.hole) })
    const padParts = partsOf(m.pad, 'empty_pad')
    pads.forEach((mats) => addInst(padParts, mats, false))
    if (opts.mySeat && holes.has(opts.mySeat)) {
      const h = holes.get(opts.mySeat)!
      const halo = m.halo.scene.clone(true)
      halo.position.set(h.x, 0, h.z)
      halo.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.receiveShadow = true })
      scene.add(halo)
      haloObj = halo
    }
    applyLod(lodLevel, true)
  }

  /*
   * 바깥 잔디(outer_grass) 색을 잔디 바닥(field_slab) 가장자리 색에 맞춤 (2026-11-18 화면 확인).
   * v3.10 바닥은 정점 색 잔디(명암 있음)인데 바깥 잔디는 한 가지 색이라 약 8~10% 밝아서, far 에서 구역 하나만 켠 층(들판 남쪽 끝이 보임)은
   * 울타리 밖에 밝은 띠가 보였음. 바닥 가장자리 정점 색 평균 × 바닥 재질 색으로 바꿈 (재질은 복제, 원본 glb 캐시는 그대로). ?fouter=0 이면 원래대로
   */
  function matchOuterGrass(root: THREE.Object3D) {
    if (testParam('fouter') === '0') return
    const slab = root.getObjectByName('field_slab') as THREE.Mesh | undefined
    const outer = root.getObjectByName('outer_grass') as THREE.Mesh | undefined
    const col = slab?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    const pos = slab?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!slab || !outer || !col || !pos) return
    const sum = [0, 0, 0]
    let n = 0
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      // 윗면(평평한 곳)의 바깥 둘레 2m 띠
      if (y < -0.02 || (Math.abs(x) < 52 && z < -2 && z > -70)) continue
      sum[0] += col.getX(i); sum[1] += col.getY(i); sum[2] += col.getZ(i); n++
    }
    if (!n) return
    const sm = slab.material as THREE.MeshStandardMaterial
    const m = (outer.material as THREE.MeshStandardMaterial).clone()
    m.color.setRGB(sum[0] / n * sm.color.r, sum[1] / n * sm.color.g, sum[2] / n * sm.color.b, THREE.LinearSRGBColorSpace)
    outer.material = m
    own.push(m)
  }

  /*
   * 흙 노드를 12m 칸으로 나눔 (2026-11-18 측정, docs/explore-field-v3-10.md). 흙 메시는 구역마다 36m 한 덩어리(정점 약 5천)라
   * 가속 끈 PC 에서 띠로 나눠 굽기·빈 곳 메우기를 할 때마다 화면 밖 부분까지 통째로 그려서 2코어 점프가 28 → 20fps 로 떨어졌음.
   * 정점은 그대로 함께 쓰고 삼각형 목록(index)만 칸마다 나눠 칸 단위로 화면 밖은 안 그림 (다른 부품 인스턴싱 칸과 같은 크기). ?soilsplit=0 이면 안 나눔
   */
  function splitSoil(mesh: THREE.Mesh) {
    const geo = mesh.geometry, idx = geo.index, pos = geo.getAttribute('position') as THREE.BufferAttribute
    if (!idx || !mesh.parent) return
    mesh.updateMatrixWorld(true)
    const mw = mesh.matrixWorld
    const v = new THREE.Vector3()
    const cells = new Map<string, number[]>()
    for (let t = 0; t + 2 < idx.count; t += 3) {
      let cx = 0, cz = 0
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx.getX(t + k)).applyMatrix4(mw); cx += v.x; cz += v.z }
      const key = cellKey(cx / 3, cz / 3)
      let list = cells.get(key)
      if (!list) cells.set(key, (list = []))
      list.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2))
    }
    if (cells.size < 2) return
    const box = new THREE.Box3()
    cells.forEach((list, key) => {
      const g2 = new THREE.BufferGeometry()
      for (const [name, a] of Object.entries(geo.attributes)) g2.setAttribute(name, a)
      g2.setIndex(new THREE.BufferAttribute(pos.count < 65536 ? new Uint16Array(list) : new Uint32Array(list), 1))
      box.makeEmpty()
      for (const i of list) box.expandByPoint(v.fromBufferAttribute(pos, i))
      g2.boundingBox = box.clone()
      g2.boundingSphere = box.getBoundingSphere(new THREE.Sphere())
      own.push(g2)
      const part = new THREE.Mesh(g2, mesh.material)
      part.name = `${mesh.name}#${key}`
      part.position.copy(mesh.position); part.quaternion.copy(mesh.quaternion); part.scale.copy(mesh.scale)
      part.receiveShadow = true
      mesh.parent!.add(part)
    })
    mesh.removeFromParent()
  }

  /* ---------- 단계별 표시 (LOD, camera_zoom_spec 3) ---------- */
  /** 인스턴스 묶음 하나: 원래 행렬(배치) · 부품 상대 행렬 · 개수 · 꽃은 짝수 번째 개수 */
  type LodGroup = { im: THREE.InstancedMesh; mats: THREE.Matrix4[]; local: THREE.Matrix4; n: number; even: number }[]
  const lodGroups: Record<'tuft' | 'crop' | 'flower' | 'hole', LodGroup> = { tuft: [], crop: [], flower: [], hole: [] }
  let haloObj: THREE.Object3D | null = null
  let cropScale = 1
  const scaleM = new THREE.Matrix4()
  /** 묶음의 인스턴스를 제자리에서 k 배 (배치 행렬 × 배율 × 부품 행렬 → 각자 원점 기준) */
  const rescale = (grp: LodGroup, k: number) => {
    scaleM.makeScale(k, k, k)
    for (const g of grp) {
      for (let i = 0; i < g.n; i++) g.im.setMatrixAt(i, tmpM.multiplyMatrices(g.mats[i], scaleM).multiply(g.local))
      g.im.instanceMatrix.needsUpdate = true
      g.im.computeBoundingSphere()
    }
  }
  /**
   * 작물·구멍(후광·링·두더지 발 높이 포함)을 이 배율로. 단계 표 값(applyLod)이거나, 줌 전환 중 거리에 연속인 값(holeScaleAt, v3.11). 바뀐 게 있으면 true
   */
  function applyScales(cropK: number, holeK: number, force = false): boolean {
    let changed = false
    if (cropK !== cropScale || force) { cropScale = cropK; changed = true; if (cropK !== 1 || !force) rescale(lodGroups.crop, cropK) }
    if (holeK !== holeScale || force) {
      holeScale = holeK; changed = true
      if (holeK !== 1 || !force) rescale(lodGroups.hole, holeK)
      haloObj?.scale.setScalar(holeK)
      for (const ring of [hoverRing, targetRing]) ring.scale.setScalar(holeK)
      // 두더지 발 높이 = 구멍 바닥 (구멍 배율만큼)
      if (mole && !anim) mole.object.position.y = anchorY()
      if (moleBlob) moleBlob.position.y = .085 * holeScale
    }
    return changed
  }
  /** 단계별 표시를 그 단계로 (꽃·풀 뭉치 켜고 끄기, 작물·구멍 배율). 바뀐 게 있으면 true */
  function applyLod(lv: ZoomLevel, force = false): boolean {
    if (lv === lodLevel && !force) return false
    lodLevel = lv
    const L = ZOOM_LOD[lv]
    for (const g of lodGroups.flower) { g.im.visible = L.flowers > 0; g.im.count = L.flowers >= 1 ? g.n : g.even }
    for (const g of lodGroups.tuft) g.im.visible = L.tufts
    applyScales(L.crop, L.hole, force)
    // 저사양: 배경을 다시 찍어야 함
    backdrop?.invalidate(); fullNext = true
    return true
  }
  /** 두더지 발 높이 (구멍 바닥 0.075 × 구멍 배율) */
  function anchorY() { return ANCHOR_Y * holeScale }
  /** 두더지 배율: 거리에 따라 부드럽게 (fieldCam moleScaleAt) */
  function applyMoleScale() {
    const k = moleScaleAt(dist)
    mole?.object.scale.setScalar(k)
    moleBlob?.scale.setScalar(k)
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
    const p = mole ? mole.object.position.clone().setY(anchorY() + 1.12 * mole.object.scale.y) : holeVec(curSeat, 1.2)
    const s = toScreen(p)
    // 끌어서 두더지가 화면 밖에 있으면 안내판도 숨김 (위치가 화면 밖 좌표로 가서 가장자리에 걸쳐 보이는 것을 막음)
    const onScreen = s.x > -24 && s.x < W + 24 && s.y > -24 && s.y < H + 24
    const vis = !anim && !zoomAnim && !!mole?.object.visible && onScreen
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
    if (anim || zoomAnim || zoomWait || !mole || to === curSeat || !holes.has(to)) return false
    endDrag(); panned = false // 끌어 둔 카메라는 아래 camFrom(지금 타깃) → camTo(구멍 타깃) 보간으로 돌아옴
    const from = curSeat
    const dur = mole.hop('down')
    const camTo = clampTarget(holeVec(to))
    // 카메라 이동 시간: near·mid 0.4, far 0.35, 타깃이 12m 넘게 움직이면 +0.1 (camera_zoom_spec 5)
    const camDur = (level === 'far' ? HOP_CAM_FAR : HOP_CAM) + (camTo.distanceTo(target) >= 12 ? HOP_CAM_LONG : 0)
    // 카메라가 안 움직이는 점프(타깃이 같음: far 에서 구역 하나일 때 맞춤점 ±9m 한계에 걸린 구멍끼리 등) → 배경을 다시 그리거나 굽지 않음 (두더지만 들어갔다 나옴)
    const still = camTo.distanceTo(target) < 1e-3
    anim = { from, to, t: 0, phase: 'down', dur, camFrom: target.clone(), camTo, camDur, still }
    const h = holes.get(to)!
    if (baker && !still) void getCachedStill(seatKey(to)) // 도착할 자리의 구운 배경을 미리 읽어 둠
    if (slide && !still) {
      // M: 떠날 자리 그림(지금 선명한 배경)을 띠에 넣고, 도착할 자리를 미리 굽기 시작
      slideKind = wantGl() ? 'gl' : 'css'
      slideDrop()
      if (sharpOk && sharpCv) slideLoad(0, sharpCv, camera.clone())
      startPrep(camAt(anim.camTo, dist), seatKey(to))
    }
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
      // M: 도착할 자리 그림이 아직이면 땅속에서 조금 더 (HOLD_MAX 까지)
      anim.phase = prep && !prepReady() ? 'dig' : 'cam'; anim.t = 0
      if (anim.phase === 'cam') beginCam()
    }
    if (anim.phase === 'dig' && (!prep || prepReady() || anim.t >= HOLD_MAX)) {
      noteCapture('hold', performance.now() - anim.t * 1000)
      anim.phase = 'cam'; anim.t = 0
      beginCam()
    }
    let moved = false
    if (anim.phase === 'cam') {
      let k = reduce ? 1 : Math.min(1, anim.t / anim.camDur)
      // 측정용 ?movefreeze=0_5: 카메라 이동을 그 지점에서 멈춤 (이동 도중 화질 비교, explore/gpu/move/move-shots.mjs)
      if (moveFreeze != null && k >= moveFreeze) { k = moveFreeze; anim.t = k * anim.camDur }
      if (!anim.still) {
        target.lerpVectors(anim.camFrom, anim.camTo, ease(k))
        placeCamera(); followSun()
        moved = true
      }
      anim.k = k
      if (k >= 1) {
        const p = holeVec(anim.to, anchorY())
        mole.object.position.copy(p); mole.object.rotation.y = 0
        mole.object.visible = true
        if (moleBlob) { moleBlob.position.set(p.x + .08, .085 * holeScale, p.z - .05); moleBlob.visible = true }
        anim.dur = mole.hop('up'); anim.phase = 'up'; anim.t = 0
        // M: 미리 구운 도착 그림을 선명한 배경으로 바꿔 끼움 → 이 프레임부터 멈춰 있을 때와 같은 그리기
        if (prepReady()) { finishPrep(); moved = false }
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
    if (anim || zoomAnim || zoomWait || !holes.has(curSeat)) return false
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

  /* ---------- 줌 (near / mid / far, camera_zoom_spec 6) ---------- */
  /*
   * 0.5초 동안 거리는 로그 보간, 타깃은 지금 타깃 → 새 단계 타깃(같은 구멍을 그 단계 한계로)을 같은 곡선으로.
   * 단계별 표시(LOD)는 거리 기준 히스테리시스로 전환 도중 한 번에 (가속 켬·저사양 예전 길).
   * 저사양 M(선명한 배경 + 옮겨 그리기): 지금 그림을 칸 0 에 넣고, 도착 구도(새 LOD 적용)를 미리 굽기 시작 → 전환 동안 두 그림을
   * 바닥 평면 호모그래피로 옮겨 그리고 빈 곳만 낮은 해상도 3D 로 메움. 도착 그림이 늦으면 다 구워질 때까지 옮긴 그림을 그대로(zoomWait)
   */
  const zfP = testParam('zoomfreeze')
  const zoomFreeze = zfP != null ? +zfP.replace('_', '.') : null
  /** 저사양 M: 줌 키를 누른 뒤 도착 그림을 기다리는 최대 시간 (초). 시험용 ?zoomhold=0_35 */
  const zoomHold = +(testParam('zoomhold') ?? String(ZOOM_HOLD)).replace('_', '.')
  function zoomTo(lv: ZoomLevel): boolean {
    if (anim || zoomAnim || zoomWait || !mole || lv === level || !ZOOM_LEVELS.includes(lv)) return false
    endDrag(); panned = false // 줌도 지금 타깃 → 구멍 타깃 보간이라 끌어 둔 카메라가 두더지 쪽으로 돌아옴
    const d1 = ZOOM_DIST[lv]
    const t1 = holes.has(curSeat) ? clampTarget(holeVec(curSeat), lv) : clampTarget(target.clone(), lv)
    zoomAnim = { d0: dist, d1, t0: target.clone(), t1, t: 0, slide: false, k: 0, hold: 0, holdMax: 0 }
    level = lv
    hoverSeat = null; hoverRing.visible = false; ev.onHover?.(null, 0, 0)
    if (slide && wantGl() && sharpOk && sharpCv && !reduce) {
      // 도착 구도의 LOD 로 바로 바꿈 (미리 굽는 그림이 도착 모습이어야 함). 지금 그림(칸 0)은 이전 LOD 그대로라 전환 동안만 섞여 보임
      applyLod(lv)
      slideKind = 'gl'
      slideDrop()
      slideLoad(0, sharpCv, camera.clone())
      startPrep(camAt(t1, d1), seatKey(curSeat, focus, lv))
      if (prep) prep.zoom = true
      zoomAnim.slide = !!prep
      // 줌 아웃만 기다림 (지금 그림이 사이 화면의 가운데만 덮어서). 줌 인은 지금 그림이 다 덮어서 바로 움직임. 약한 PC 는 더 오래
      zoomAnim.holdMax = d1 > zoomAnim.d0 ? (testParam('zoomhold') != null ? zoomHold : fillLow ? ZOOM_HOLD_WEAK : ZOOM_HOLD) : 0
    }
    ev.onZoom?.(lv)
    loop.wake()
    return true
  }
  /** 이번 프레임에 카메라가 움직였으면 true */
  function stepZoom(dt: number): boolean {
    const z = zoomAnim
    if (!z) return false
    // 저사양 M: 도착 그림이 준비될 때까지 ZOOM_HOLD 초까지는 카메라를 움직이지 않고 지금 그림 그대로 (점프의 dig 와 같은 생각).
    // 준비된 뒤 움직이면 줌 아웃은 도착 그림이, 줌 인은 지금 그림이 사이 화면을 다 덮어서 3D 로 메울 곳이 없음 → 전환이 부드러움
    if (z.slide && z.t === 0 && prep && !prep.loaded && z.hold < z.holdMax) { z.hold += dt; return false }
    z.t += dt
    let k = reduce ? 1 : Math.min(1, z.t / ZOOM_SEC)
    // 측정용 ?zoomfreeze=0_5: 줌 전환을 그 지점에서 멈춤 (전환 도중 화질 보기, explore/gpu/zoom/zoom-shots.mjs)
    if (zoomFreeze != null && k >= zoomFreeze) { k = zoomFreeze; z.t = k * ZOOM_SEC }
    const e = easeStd(k)
    z.k = k
    setDist(distAt(z.d0, z.d1, e))
    target.lerpVectors(z.t0, z.t1, e)
    placeCamera(); followSun()
    applyMoleScale()
    if (!z.slide) {
      applyLod(lodAt(dist, lodLevel))
      // v3.11: 구멍·후광·작물 크기는 단계 경계에서 튀지 않게 거리에 연속 (옮겨 그리기 M 은 도착 구도를 미리 굽는 그림이라 단계 표 값 그대로)
      const hk = holeScaleAt(dist)
      if (applyScales(hk, hk)) { backdrop?.invalidate(); fullNext = true }
    }
    if (k >= 1) {
      setDist(z.d1)
      applyLod(level)
      if (!z.slide) { const hk = holeScaleAt(z.d1); if (applyScales(hk, hk)) { backdrop?.invalidate(); fullNext = true } }
      zoomAnim = null
      lastAnchor = ''
      // 저사양 M: 도착 그림이 아직이면 옮긴 그림을 그대로 두고 기다림 (아래 frame 에서 준비되면 바꿔 끼움)
      if (z.slide && prep && !prepReady()) zoomWait = true
    }
    return true
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
    let best: number | undefined, bd = HIT_R * holeScale
    holes.forEach((h) => { const dd = Math.hypot(h.x - hit.x, h.z - hit.z); if (dd < bd) { bd = dd; best = h.seat } })
    if (best != null) return { seat: best }
    if (Math.hypot(hit.x - LADDER_POS.x, hit.z - LADDER_POS.z) < 1.5) return { ladder: true }
    return {}
  }
  let down: { x: number; y: number } | null = null
  /* ---------- 마우스로 땅 잡고 끌기 (모든 줌 단계) ---------- */
  /*
   * 잡은 땅 위의 점이 포인터 밑에 그대로 있게 타깃을 옮김 (잡았을 때 카메라 복제로 포인터 → 땅 점을 계산해서 되먹임이 없음).
   * 한계는 fieldCam dragLimits (바깥 잔디 안, 화면 비율·카드 위치 반영). 6px 넘게 움직이기 전에는 그냥 클릭 (구멍 점프·사다리).
   * 돌아오기는 따로 없음: 점프·줌은 지금 타깃에서 구멍 타깃으로 보간하니까 두더지를 움직이면 자연스럽게 돌아옴
   */
  const DRAG_PX = 6
  // 측정용 ?camdbg=1: 지금 카메라 타깃·거리·끈 상태를 창에서 읽음 (cdp 시험)
  if (testParam('camdbg') === '1') {
    ;(window as unknown as { __holeCam?: (seat?: number) => unknown }).__holeCam = (seat) => {
      const r = el.getBoundingClientRect()
      const at = seat != null && holes.has(seat) ? toScreen(holeVec(seat)) : null
      return { x: target.x, z: target.z, dist, level, panned, dragging: !!drag?.active, seat: curSeat, W, H, focus, at: at && { x: r.left + at.x, y: r.top + at.y } }
    }
  }
  const groundPlane = new THREE.Plane(UP, 0), dragHit = new THREE.Vector3()
  const dragPoint = (cx: number, cy: number, cam: THREE.PerspectiveCamera, out: THREE.Vector3) => {
    const r = el.getBoundingClientRect()
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height * 2 - 1))
    ray.setFromCamera(ndc, cam)
    return !!ray.ray.intersectPlane(groundPlane, out)
  }
  const canDrag = () => !anim && !zoomAnim && !zoomWait && !prep && focus === focusTarget && !!mole && !warming
  function endDrag() {
    if (!drag) return
    const d = drag
    drag = null
    try { el.releasePointerCapture(d.id) } catch { /* 이미 놓음 */ }
    if (d.active) el.style.cursor = 'grab'
  }
  const onDragMove = (e: PointerEvent) => {
    const d = drag!
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <= DRAG_PX) return
      // 끌기 시작: 지금 포인터 밑 땅 점을 잡은 점으로 (6px 만큼 튀지 않게)
      if (!dragPoint(e.clientX, e.clientY, d.cam, d.g0)) return
      d.active = true
      el.style.cursor = 'grabbing'
      hoverSeat = null; hoverRing.visible = false; ev.onHover?.(null, 0, 0)
    }
    if (!dragPoint(e.clientX, e.clientY, d.cam, dragHit)) return
    const [x, z] = dragTarget([d.t0.x, d.t0.z], [d.g0.x, d.g0.z], [dragHit.x, dragHit.z], dragLimits(dist, W / H, focus))
    if (x === target.x && z === target.z) return
    target.set(x, 0, z)
    placeCamera(); followSun()
    panned = true; panDirty = true
    ev.onCamera?.(x, z)
    loop.wake()
  }
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY }
    if (e.button === 0 && e.isPrimary && canDrag()) {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, active: false, cam: camera.clone(), t0: target.clone(), g0: new THREE.Vector3() }
      try { el.setPointerCapture(e.pointerId) } catch { /* 잡을 수 없는 포인터 */ }
    }
  }
  const onUp = (e: PointerEvent) => {
    const wasDrag = !!drag?.active
    endDrag()
    if (wasDrag || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    const p = pickAt(e.clientX, e.clientY)
    if (p.ladder) ev.onLadder?.()
    else if (p.seat != null) jump(p.seat)
  }
  const onCancel = () => { down = null; endDrag() }
  const onMoveP = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) { onDragMove(e); return }
    if (e.buttons) return
    const p = pickAt(e.clientX, e.clientY)
    const seat = p.seat ?? null
    el.style.cursor = seat != null && seat !== curSeat ? 'pointer' : p.ladder ? 'pointer' : canDrag() ? 'grab' : 'default'
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
  el.addEventListener('pointercancel', onCancel)
  el.style.touchAction = 'none' // 터치로도 끌 수 있게 (페이지 스크롤로 안 넘어가게)
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
    // 3차 (warm.ts): 층마다 실제로 그려지는 곳만 컴파일·그리기, 하나 그릴 때마다 GPU 가 끝날 때까지 비동기로 기다림.
    // 셰이더가 다 준비된 뒤 S 굽기용 렌더 타깃·톤매핑 셰이더. 시험용 ?hwarm=0 예전 방식(아래)
    // GPU(가속 켬)는 2차 방식(아래) 그대로: 3차 예열은 WARP 의 동기 호출 멈춤용 (docs/rendering-experiments-3.md 6번)
    if (testParam('hwarm') !== '0' && q.level === 'low') {
      // 지난 그림을 남기지 않는 캔버스(GPU)는 1×1 그리기만 해도 지워진 화면이 보이므로 예열하는 동안 숨김
      const hide = !scissorOk
      if (hide) renderer.domElement.style.visibility = 'hidden'
      try {
        await warmScene(renderer, scene, camera, { split: backdrop ? backdrop.target() : null, extra: baker?.warmTarget() ?? null, dead: () => disposed })
        if (disposed) return
        if (baker) { baker.warm(scene, camera); await waitGpu(renderer) }
        // M: 구멍 뚫기·옮기기 셰이더 컴파일만 걸어 둠 (기다리지 않음, 첫 점프는 몇 초 뒤)
        if (!disposed) { slide?.prepare(renderer); glSlide?.prepare(renderer) }
      } finally {
        backdrop?.invalidate(); sharpOff(); fullNext = true
        warming = false
        if (hide) { renderer.domElement.style.visibility = ''; loop.redraw() }
        ;(window as unknown as { __warmMs?: number }).__warmMs = Math.round(performance.now() - w0) // 측정용
      }
      return
    }
    try {
      if (backdrop) await backdrop.precompile(scene, camera)
      await renderer.compileAsync(scene, camera).catch(() => {})
      const texs = new Set<THREE.Texture>()
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        for (const mm of m ? (Array.isArray(m) ? m : [m]) : []) for (const v of Object.values(mm)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture)
      })
      for (const t of texs) { if (disposed) return; renderer.initTexture(t); await new Promise((r) => setTimeout(r, 0)) }
      // S 굽기용 톤매핑 셰이더·MSAA 렌더 타깃 (작은 크기로 한 번)
      if (baker) { baker.warm(scene, camera); await new Promise((r) => setTimeout(r, 0)) }
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
          // 하나 그리고 GPU 프로세스가 끝낼 때까지 비동기로 기다림 (warm.ts waitGpu, 3차: 25ms 씩 묶으면 다음 묶음의 동기 호출이 앞 묶음의 셰이더 만들기를 기다려 멈췄음)
          {
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
          await waitGpu(renderer)
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
      const p = mole.object.position, ms = mole.object.scale.x // 줌 단계 배율 (far 1.5)
      mole.object.updateMatrixWorld(true)
      addBox(r, p.x, p.y - .3 * ms, p.y + 1.5 * ms, p.z, .62 * ms)
      if (!moleBones) { const list: THREE.Object3D[] = []; mole.object.traverse((o) => { if ((o as THREE.Bone).isBone) list.push(o) }); moleBones = list }
      for (const b of moleBones) { b.getWorldPosition(boneP); addBox(r, boneP.x, boneP.y - .5 * ms, boneP.y + .5 * ms, boneP.z, .5 * ms) }
    }
    for (const ring of [hoverRing, targetRing]) if (ring.visible) addBox(r, ring.position.x, 0, .12, ring.position.z, 1.26 * holeScale)
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
    // 투명하게 지움: 바로 앞에 배경색(scene.background)이 있는 장면을 그렸으면(깊이 굽기 등) GL 지우기 색이 그 잔디색으로 남아 있어서,
    // 같은 프레임에 선명한 배경으로 바꿔 끼우면 화면 전체가 진한 초록으로 덮였음 (2026-11-18 줌 뒤 깊이 굽기를 미뤘을 때) → 매번 투명으로 맞춤
    if (sharpLayer) { renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); bd.blitDepth() } else bd.blit()
    const bg = scene.background
    scene.background = null
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    scene.background = bg
    renderer.autoClear = true
    if (scissor) renderer.setScissorTest(false)
  }

  /* ---------- S 배경은 선명하게 (기본, 땅굴 S 와 같은 방식, 굽기는 sharpBake.ts) ---------- */
  let sharpCv: HTMLCanvasElement | null = null
  let sharpOk = false
  const makeSharpCv = () => {
    if (sharpCv) return sharpCv
    sharpCv = document.createElement('canvas')
    sharpCv.setAttribute('aria-hidden', 'true')
    sharpCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;visibility:hidden'
    container.insertBefore(sharpCv, renderer.domElement)
    return sharpCv
  }
  /** 시험용 ?bakelin=1 = 선형 렌더 타깃에 굽고 마지막에 톤매핑 (11-16 방식, sharpBake.ts) */
  const bakeLinear = testParam('bakelin') === '1'
  let baker: SharpBaker | null = sharpField ? createSharpBaker(renderer, { samples: bakeSamples, strips: bakeStrips, linear: bakeLinear }, makeSharpCv) : null
  /*
   * 기기 단계가 이 장면에서 정해지면(첫 방문, lib/deviceTier.ts) 그 자리에서 바꿈: 굽기 띠·MSAA(굽기가 쉬고 있을 때 baker 를 새로)·
   * 카메라 이동 해상도(다음 이동부터). 주소 손잡이로 고정한 값은 그대로 (docs/rendering-experiments-3.md, 2코어 첫 방문)
   */
  let bakerStale = false
  const unTier = q.level === 'low' ? onLowTierChange(() => {
    const nq = quality()
    if (testParam('fstrips') == null) bakeStrips = nq.bakeStrips
    if (testParam('fmsaa') == null) bakeSamples = nq.bakeSamples
    if (testParam('panscale') == null && nq.panScale !== panScale) { panScale = nq.panScale; panStale = true }
    fillLow = nq.tier === 'weak'
    prebuildSoon(500)
    bakerStale = !!baker
  }) : () => {}
  /** 카메라가 움직임: 선명한 그림을 내리고 굽던 것은 버림 (M 의 도착 자리 굽기는 그대로) */
  const sharpOff = () => { if (!prep) baker?.cancel(); if (sharpOk) { sharpOk = false; if (sharpCv) sharpCv.style.visibility = 'hidden' } }
  /*
   * 구운 배경 기억 (IndexedDB, three/stills.ts, docs/rendering-experiments-3.md 3·5번): 자리마다 키(구역 수·배정된 자리·내 자리·서 있는 자리·크기·구도)로 저장.
   * 같은 자리에 다시 오면(점프로 돌아오기·새로고침·다음 방문) 다시 굽지 않고, 들어올 때는 3D 가 준비되기 전부터 그 그림을 보여 줌.
   * 점프를 시작하면 도착할 자리 그림을 미리 읽어 둠. 시험용 ?stillcache=0 으로 끔
   */
  let occHash = 0
  for (const n of opts.occupied) occHash = (occHash * 31 + n) | 0
  /**
   * v3.10: 작물·줌 단계도 키에 (자리마다 단계별 타깃이 정해져 있어서 자리 + 단계면 같은 그림). 들어오기 전(배치를 읽기 전)에도 키를 알 수 있게 자리 기준 그대로.
   * 'f11f': 울타리를 켠 구역 둘레로 닫음(f11 의 그림은 끊긴 울타리). 'f11': v3.10 때 저장한 그림(카메라 타깃 규칙·딸기 모델이 달랐음)을 다시 쓰지 않게 (f10 ← v3.9 의 흙 바닥)
   */
  const seatKey = (seat: number, f = focus, lv: ZoomLevel = level) =>
    stillKey('hole', ['f11f', opts.crop ?? 'pumpkin', lv, opts.zones, occHash, opts.mySeat, seat], W, H, f)
  /** 그림 한 장을 선명한 배경으로 */
  const showSharp = (img: CanvasImageSource & { width: number; height: number }) => {
    const cv = makeSharpCv()
    if (cv.width !== img.width || cv.height !== img.height) { cv.width = img.width; cv.height = img.height }
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0)
    bumpCv(cv)
    cv.style.visibility = 'visible'
  }
  /** 굽기 한 걸음 (매 프레임). 이번에 다 됐으면 true (다음 그리기는 전체) */
  const stepSharp = (quiet: boolean): boolean => {
    if (!baker || prep) return false // M: 도착 자리 굽기(prep)가 굽기를 쓰는 중
    if (bakerStale && !baker.busy()) { baker.dispose(); baker = createSharpBaker(renderer, { samples: bakeSamples, strips: bakeStrips, linear: bakeLinear }, makeSharpCv); bakerStale = false }
    const st = baker.step()
    if (st === 'done') {
      bumpCv(sharpCv)
      sharpCv!.style.visibility = 'visible'
      sharpOk = true
      noteCapture('sharpWait', performance.now() - baker.lastMs) // 굽기 시작 → 2D 캔버스 (그동안 3D 는 띠마다 조금씩)
      if (bakeSeat != null) {
        const copy = document.createElement('canvas'); copy.width = sharpCv!.width; copy.height = sharpCv!.height
        copy.getContext('2d')!.drawImage(sharpCv!, 0, 0)
        putCachedStill(seatKey(bakeSeat), copy)
      }
      return true
    }
    if (st === 'idle' && sharpField && !sharpOk && quiet && mole && !baker.broken) {
      const saved = holes.has(curSeat) && !panned ? peekCachedStill(seatKey(curSeat)) : null
      if (saved) { showSharp(saved); sharpOk = true; noteCapture('sharpSaved', performance.now()); return true }
      bakeSeat = holes.has(curSeat) && !panned ? curSeat : null // 끌어 둔 구도는 그 자리의 배경이 아님 → 저장 안 함
      const out = Math.min(window.devicePixelRatio || 1, 2)
      const t0 = performance.now()
      baker.start(scene, camera, Math.max(1, Math.round(W * out)), Math.max(1, Math.round(H * out)), makeSharpCv())
      baker.step() // 첫 띠는 바로
      noteCapture('sharp', t0)
    }
    return false
  }
  /** 측정용: 배경을 다시 찍는 데 든 시간 (메인 스레드, ms) */
  const noteCapture = (kind: string, t0: number) => {
    const ms = performance.now() - t0
    const w = window as unknown as { __captures?: [string, number][]; __sharpAt?: number }
    ;(w.__captures ??= []).push([kind, Math.round(ms)])
    // 선명한 배경이 깔린 시각 (cdp-scene.mjs zoom: 줌 키 → 선명해질 때까지)
    if (kind === 'sharpWait' || kind === 'sharpSaved' || kind === 'swap') w.__sharpAt = performance.now()
    // 느린 PC 는 S 를 끔 (한 번에 굽는 경우만): 선명한 배경이 준비되기까지 SHARP_SLOW_MS 를 넘은 적이 두 번이면 이 장면에서는 0.55배 배경만 (A_R).
    // 띠로 나눠 구우면 한 프레임 일이 작아서 3D 가 크게 밀리지 않음
    if (kind === 'sharpWait' && bakeStrips <= 1 && ms > SHARP_SLOW_MS && ++sharpStrikes >= 2 && sharpField) {
      sharpField = false
      console.info(`[3D] 선명한 배경을 찍는 데 ${Math.round(ms)}ms 걸려서 이 PC 에서는 끔`)
    }
  }
  let sharpStrikes = 0
  /** 굽고 있는 그림의 자리 */
  let bakeSeat: number | null = null

  /* ---------- M 이동 중에도 선명 (docs/explore-move-quality.md) ---------- */
  /*
   * 기본 켬 (저사양 + S). 실험실 M, 시험용 ?fslide=0 끔(예전: 이동 중 0.33배, 도착 뒤 다시 굽기), ?slidey=0_06 바닥 평면 높이(m)
   * - prep: 점프를 시작하면 도착할 자리를 굽기(sharpBake, 두 번째 2D 캔버스 nextCv 에) + 그 자리 배경 깊이(bdNext, 0.55배).
   *   구운 그림 기억(IndexedDB)에 있으면 굽지 않음. 한 프레임에 한 가지씩 (굽기 띠 하나·읽기·깊이)
   * - 두더지가 들어간 뒤(hop_down 0.42초)에도 아직이면 땅속에서 HOLD_MAX 초까지 기다림 (dig)
   * - 카메라 이동(cam 0.4초): 떠날 자리·도착할 자리 그림을 띠로 밀기(moveSlide.ts). 빈 곳만 3D 로 메우고, 움직이는 층(layer 1)은 3D 로
   * - 도착(k = 1): nextCv ↔ sharpCv, bdNext ↔ bd 를 바꿔 끼움 → 그 프레임부터 멈춰 있을 때와 같은 선명한 배경 (다시 굽지 않음)
   * - 미리 못 구운 경우(첫 굽기 전에 점프 등)는 예전 길(이동 중 0.33배)로. 그래도 도착 그림이 준비되면 그때 바꿔 끼움
   * - 패널 열기·닫기(focusX, 화면 가로 밀기)도 같은 방식: 지금 그림을 밀고, 새 구도를 미리 구워 준비되면 바꿔 끼움 (focusTr).
   *   새로 드러나는 옆 띠만 그동안 3D(0.55배)로 메움
   */
  const slideY = +(testParam('slidey') ?? '0_06').replace('_', '.')
  const slideNs = testParam('slidens')
  const slide: Slide | null = baker && (q.lab?.M ?? true) && testParam('fslide') !== '0'
    ? createSlide(container, renderer.domElement, { yRef: slideY, ns: slideNs ? +slideNs : undefined }) : null
  /*
   * 옮기는 방법 두 가지 (moveSlide.ts, docs/explore-move-quality.md 3·5번). 기본은 gl: 이동 0.4초 동안만 WebGL 캔버스를 1배로 키워 셰이더로 옮김.
   * css(띠 밀기)는 시험에서는 2코어에 유리해 보였지만 앱 안에서는 띠 캔버스 384개(만들기·첫 합성)와 합성기 두 장 비용으로
   * 16스레드 37~42fps · 2코어 19fps 라 gl(16스레드 58fps · 2코어 25fps, 기준과 같음)보다 못했음 → 시험용 ?slidemode=css 로만
   */
  const glSlide: GlSlide | null = slide ? createGlSlide({ yRef: slideY }) : null
  const wantGl = () => { const m = testParam('slidemode'); return m ? m === 'gl' : true }
  /** 약한 PC 는 빈 곳 메우기를 늘 낮은 배율(0.22배 = 예전 약한 PC 의 이동 중 배율)로 (2코어에서 위쪽 먼 구멍 클릭 점프가 28.8 → 17.5fps 로 떨어져서) */
  let fillLow = q.tier === 'weak'
  /** 이번 이동에 쓰는 방법 */
  let slideKind: 'gl' | 'css' = 'css'
  /** 2D 캔버스 내용 판 (gl 텍스처를 다시 올릴지) */
  const cvVer = new WeakMap<HTMLCanvasElement, number>()
  const bumpCv = (cv: HTMLCanvasElement | null) => { if (cv) cvVer.set(cv, (cvVer.get(cv) ?? 0) + 1) }
  const slideLoad = (slot: 0 | 1, cv: HTMLCanvasElement, cam: THREE.PerspectiveCamera) => {
    if (slideKind === 'gl') glSlide!.load(slot, cv, cam, cvVer.get(cv) ?? 0); else slide!.load(slot, cv, cam)
  }
  const slideHas = (slot: 0 | 1) => (slideKind === 'gl' ? !!glSlide?.has(slot) : !!slide?.has(slot))
  const slideDrop = () => { slide?.drop(); glSlide?.drop() }
  /** gl 로 옮기는 동안의 원래 픽셀 배율 (0 = 아님) */
  let glPr = 0
  const enterGl = () => { if (glPr) return; glPr = renderer.getPixelRatio(); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false) }
  const exitGl = () => { if (!glPr) return; renderer.setPixelRatio(glPr); glPr = 0; renderer.setSize(W, H, false); prevRect = null; fullNext = true }
  const slideHide = () => { slide?.hide(); exitGl() }
  /** 약한 PC(띠 밀기)면 띠 캔버스를 쉬는 틈에 미리 만들어 둠 (첫 점프에서 384개를 만드느라 멈추지 않게) */
  function prebuildSoon(ms: number) { if (slide && !wantGl()) setTimeout(() => { if (!disposed && !anim) slide.prebuild() }, ms) }
  /** gl 로 옮기는 중 빈 곳 메우기 (캔버스가 1배라 배율을 낮춤: 0.55배, 빈 곳이 크거나 약한 PC 면 0.22배) */
  let glFill: Backdrop | null = null, glFillLow: Backdrop | null = null
  const freezeP = testParam('movefreeze')
  const moveFreeze = freezeP != null ? +freezeP.replace('_', '.') : null
  let nextCv: HTMLCanvasElement | null = null
  const makeNextCv = () => {
    if (nextCv) return nextCv
    nextCv = document.createElement('canvas')
    nextCv.setAttribute('aria-hidden', 'true')
    nextCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;visibility:hidden'
    container.insertBefore(nextCv, renderer.domElement)
    nextCv.getContext('2d') // 2D 컨텍스트를 먼저 잡아 둠 (다른 코드가 WebGL 컨텍스트를 만들면 굽기 결과를 못 넣음, docs/rendering-experiments-3.md 끝)
    return nextCv
  }
  /** 도착할 자리 배경(색 + 깊이, 두더지 가림용). 도착하면 backdrop 과 바꿈 */
  let bdNext: Backdrop | null = null
  /** 이동 중 빈 곳 메우기용 배경 (0.55배, 빈 곳 사각형만 그림) */
  let fillBd: Backdrop | null = null
  type Prep = { cam: THREE.PerspectiveCamera; key: string | null; img: boolean; baking: boolean; depth: boolean; loaded: boolean; save: boolean; t0: number; zoom?: boolean }
  let prep: Prep | null = null
  const prepReady = () => !!prep && prep.img && prep.depth
  function startPrep(cam: THREE.PerspectiveCamera, key: string | null) {
    cancelPrep()
    if (!baker || baker.broken || !mole) return
    baker.cancel() // 지금 자리를 굽던 것은 버림 (이제 떠남)
    prep = { cam, key, img: false, baking: false, depth: false, loaded: false, save: false, t0: performance.now() }
    loop.wake()
  }
  function cancelPrep() { if (prep?.baking) baker?.cancel(); prep = null; focusTr = null; zoomWait = false }
  /** 패널 이동(focusX)을 띠 밀기로 하는 중이면 그 목표 focusX */
  let focusTr: number | null = null
  /** 한 프레임에 한 가지 (그리기 전에 부름) */
  const prepStep = () => {
    const p = prep!
    if (!p.img) {
      const saved = p.key ? peekCachedStill(p.key) : null
      if (saved) {
        if (p.baking) { baker!.cancel(); p.baking = false }
        const cv = makeNextCv()
        if (cv.width !== saved.width || cv.height !== saved.height) { cv.width = saved.width; cv.height = saved.height }
        const ctx = cv.getContext('2d')
        if (!ctx) { prep = null; return }
        ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(saved, 0, 0)
        bumpCv(cv)
        p.img = true; p.save = false
        noteCapture('prepSaved', p.t0)
      } else if (!p.baking) {
        const out = Math.min(window.devicePixelRatio || 1, 2)
        baker!.start(scene, p.cam, Math.max(1, Math.round(W * out)), Math.max(1, Math.round(H * out)), makeNextCv())
        if (baker!.broken) { prep = null; return }
        baker!.step(); p.baking = true
      } else {
        const st = baker!.step()
        if (st === 'done') { bumpCv(nextCv); p.img = true; p.save = true; p.baking = false; noteCapture('prepBake', p.t0) }
        else if (st === 'idle' || baker!.broken) { prep = null } // 누가 취소함
      }
      return
    }
    // 줌: 도착 그림을 깊이보다 먼저 칸 1 에 넣고(줌 아웃은 이 그림이 사이 화면을 다 덮음),
    // 깊이(장면 전체를 한 번 그림, 가속 끈 2코어에서 0.3~0.5초 멈춤)는 카메라가 움직이는 동안 미룸 → 멈춘 뒤에
    if (p.zoom && !p.loaded) {
      if (slideHas(0)) slideLoad(1, nextCv!, p.cam)
      savePrep(p)
      p.loaded = true
      return
    }
    if (!p.depth) {
      if (p.zoom && zoomAnim && zoomAnim.t > 0) return
      bdNext ??= createBackdrop(renderer, { scale: bdScale })
      bdNext.capture(scene, p.cam)
      p.depth = true
      noteCapture('prep', p.t0)
      return
    }
    if (!p.loaded) {
      // 띠 칸 1 에 넣기 + 구운 그림 기억 (다음 프레임에 나눠서)
      if (slideHas(0)) slideLoad(1, nextCv!, p.cam)
      savePrep(p)
      p.loaded = true
    }
  }
  /** 새로 구운 도착 그림을 기억 (IndexedDB, 한 번만) */
  const savePrep = (p: Prep) => {
    if (!p.save || !p.key || !nextCv) return
    p.save = false
    const copy = document.createElement('canvas'); copy.width = nextCv.width; copy.height = nextCv.height
    copy.getContext('2d')!.drawImage(nextCv, 0, 0)
    putCachedStill(p.key, copy)
  }
  /** 카메라 이동 시작: 띠 밀기를 쓸지 정함 (떠날 자리·도착할 자리 그림이 둘 다 있을 때) */
  function beginCam() {
    if (!anim) return
    anim.slide = !!slide && slideHas(0) && prepReady()
    if (anim.slide && !slideHas(1)) slideLoad(1, nextCv!, prep!.cam)
  }
  /** 도착 자리 그림·깊이를 지금 배경으로 바꿔 끼움 */
  function finishPrep() {
    if (prep) savePrep(prep)
    prep = null; focusTr = null; zoomWait = false
    const old = sharpCv
    sharpCv = nextCv; nextCv = old
    if (old) old.style.visibility = 'hidden'
    sharpCv!.style.visibility = 'visible'
    sharpOk = true
    const ob = backdrop
    backdrop = bdNext; bdNext = ob
    slideHide(); slideDrop()
    lowActive = false; prevRect = null; fullNext = true; bakeSeat = null
    noteCapture('swap', performance.now())
  }
  /** 카메라 이동 중 (M): 띠 밀기 + 빈 곳만 3D 로 메움 + 움직이는 층 */
  const drawSlide = (k: number) => {
    if (slideKind === 'gl') { drawSlideGl(k); return }
    const sl = slide!
    if (sharpCv) sharpCv.style.visibility = 'hidden'
    if (nextCv) nextCv.style.visibility = 'hidden'
    sharpOk = false
    backdrop!.invalidate(); prevRect = null; fullNext = true
    sl.place(camera, k < .5 ? 0 : 1)
    renderer.setScissorTest(false)
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = false
    renderer.clear(true, true, false)
    const gp = sl.gaps(camera)
    if (gp.boxes.length) {
      const fb = gp.frac > FILL_LOW_FRAC ? (panBd ??= createBackdrop(renderer, { scale: panScale || .6 })) : (fillBd ??= createBackdrop(renderer, { scale: 1 }))
      fb.capture(scene, camera, undefined, gp.boxes.map((b) => ({ x0: b.x0 / W, y0: b.y0 / H, x1: b.x1 / W, y1: b.y1 / H })))
      renderer.setScissorTest(true)
      for (const b of gp.boxes) { renderer.setScissor(b.x0, H - b.y1, b.x1 - b.x0, b.y1 - b.y0); fb.blit() }
      renderer.setScissorTest(false)
      sl.punch(renderer)
    }
    const bg = scene.background
    scene.background = null
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    scene.background = bg
    renderer.autoClear = true
    const w = window as unknown as { __slide?: { n: number; gap: number[] } }
    if (w.__slide) { w.__slide.n++; w.__slide.gap.push(+gp.frac.toFixed(3)) } // 측정용 (도구가 만들어 둔 경우만)
  }
  /** 카메라 이동 중 (M, 강한 PC): 캔버스를 1배로 → 빈 곳만 3D → 두 그림을 셰이더로 옮겨 그림 → 움직이는 층 */
  const drawSlideGl = (k: number) => {
    enterGl()
    if (sharpCv) sharpCv.style.visibility = 'hidden'
    if (nextCv) nextCv.style.visibility = 'hidden'
    sharpOk = false
    backdrop!.invalidate(); prevRect = null; fullNext = true
    renderer.setScissorTest(false)
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = false
    renderer.clear(true, true, false)
    const gs = glSlide!
    const gp = gs.gaps(camera)
    if (gp.boxes.length) {
      const fb = fillLow || gp.frac > FILL_LOW_FRAC ? (glFillLow ??= createBackdrop(renderer, { scale: .22 })) : (glFill ??= createBackdrop(renderer, { scale: .55 }))
      fb.capture(scene, camera, undefined, gp.boxes.map((b) => ({ x0: b.x0 / W, y0: b.y0 / H, x1: b.x1 / W, y1: b.y1 / H })))
      renderer.setScissorTest(true)
      for (const b of gp.boxes) { renderer.setScissor(b.x0, H - b.y1, b.x1 - b.x0, b.y1 - b.y0); fb.blit() }
      renderer.setScissorTest(false)
    }
    gs.draw(renderer, camera, k < .5 ? 0 : 1)
    const bg = scene.background
    scene.background = null
    camera.layers.set(1)
    renderer.render(scene, camera)
    camera.layers.set(0); camera.layers.enable(1)
    scene.background = bg
    renderer.autoClear = true
    const w = window as unknown as { __slide?: { n: number; gap: number[] } }
    if (w.__slide) { w.__slide.n++; w.__slide.gap.push(+gp.frac.toFixed(3)) } // 측정용
  }

  /** 조용해진 시각 (카메라·점프가 끝난 뒤). 이때부터 interimFor 초가 지나면 bd(·S)를 다시 찍음 */
  let lowActive = false
  let quietT = 0
  const drawStatic = (full: boolean, dt: number) => {
    const bd = backdrop!
    const quiet = !anim && !zoomAnim && focus === focusTarget
    quietT = quiet ? quietT + dt : 0
    if (lowActive && panBd && quietT < .12) { drawWith(panBd, full, false); return }
    if (lowActive) { lowActive = false; full = true }
    if (bd.isDirty()) { const t0 = performance.now(); bd.capture(scene, camera); noteCapture('bd', t0); full = true }
    if (stepSharp(quiet && !bd.isDirty())) full = true // 다 불러온 뒤에만 (빈 장면을 찍지 않게)
    drawWith(bd, full, sharpOk)
  }
  const drawMoving = () => {
    sharpOff(); slideHide()
    backdrop!.invalidate(); prevRect = null; fullNext = true
    if (panScale > 0) {
      // 낮은 해상도 배경 + 움직이는 층(목표 링). 도착하면 이 그림을 잠깐 그대로 씀 (lowActive)
      if (panStale) { panBd?.dispose(); panBd = null; panStale = false }
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
    resize(w, h) {
      exitGl()
      W = w; H = h; renderer.setSize(w, h, false); applyFrame(); lastAnchor = ''
      cancelPrep(); slide?.size(w, h, Math.min(window.devicePixelRatio || 1, 2)); glSlide?.size(w, h); slideDrop()
      if (anim) anim.slide = false
      if (zoomAnim) zoomAnim.slide = false
      backdrop?.invalidate(); sharpOff(); lowActive = false; fullNext = true
    },
    frame(dt) {
      // 예열 중, 그리고 S 일 때는 다 불러오기 전에도 그리지 않음 (캔버스가 투명 → 아래 정지 그림이 보임)
      if (warming || (sharpField && !mole)) return
      // M: 도착 자리 준비 (한 프레임에 한 가지). 이미 도착했거나 서 있는데 준비가 끝나면 그때 바꿔 끼움
      if (prep && !(prep.img && prep.depth && prep.loaded)) prepStep()
      if (prepReady() && (!anim || anim.phase === 'up') && !zoomAnim && (focusTr == null || focus === focusTarget)) finishPrep()
      const full = fullNext || dt === 0
      fullNext = false
      // 카메라 구도가 바뀌는 프레임(패널 이동·점프 카메라·줌)은 따로 (drawMoving), 멈추면 A 배경을 다시 찍음
      let camMoved = false
      // M: 점프·줌 중에 패널이 열리고 닫혀 구도가 바뀌면 미리 구운 도착 그림은 맞지 않음 → 버리고 예전 길로
      if (focus !== focusTarget && prep && anim) { cancelPrep(); slideHide(); slideDrop(); anim.slide = false }
      if (focus !== focusTarget && prep && (zoomAnim || zoomWait)) { cancelPrep(); slideHide(); slideDrop(); if (zoomAnim) zoomAnim.slide = false }
      // M: 패널 이동 시작 → 지금 그림을 띠에 넣고 새 구도를 미리 굽기. 도중에 목표가 또 바뀌면 버리고 예전 길로
      if (focus !== focusTarget && !anim && !zoomAnim && !zoomWait && slide && focusTr !== focusTarget) {
        if (focusTr == null && sharpOk && sharpCv && !prep && mole) {
          slideKind = wantGl() ? 'gl' : 'css'
          slideDrop()
          slideLoad(0, sharpCv, camera.clone())
          const dc = camera.clone()
          frameCamera(dc, W, H, { left: focusTarget * W - W / 2, top: 0, w: W, h: H })
          startPrep(dc, holes.has(curSeat) ? seatKey(curSeat, focusTarget) : null)
          if (prep) focusTr = focusTarget
        } else if (focusTr != null) { cancelPrep(); slideHide(); slideDrop() }
      }
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame(); lastAnchor = ''; camMoved = true }
      if (stepAnim(dt)) camMoved = true
      if (panDirty) { camMoved = true; panDirty = false }
      // 줌: 이번 프레임이 옮겨 그리기(M)인지는 끝나기 전 값으로 (끝나는 프레임도 도착 그림으로 그림)
      const zSlide = !!zoomAnim?.slide
      const zoomed = stepZoom(dt)
      if (zoomed) camMoved = true
      if (!qshot) mole?.update(dt)
      if (targetRing.visible) { pulse += dt; (targetRing.material as THREE.MeshBasicMaterial).opacity = .65 + .3 * Math.sin(pulse * 9) }
      if (camMoved && anim) (window as unknown as { __panT?: number[] }).__panT?.push(performance.now()) // 측정용 (cdp-scene.mjs 가 배열을 만들어 둔 경우만)
      if (zoomed) (window as unknown as { __zoomT?: number[] }).__zoomT?.push(performance.now()) // 측정용 (줌 전환 프레임)
      if (!backdrop) renderer.render(scene, camera)
      else if (camMoved && anim?.slide) drawSlide(anim.k ?? 0)
      else if (zSlide && !anim) drawSlide(zoomAnim ? zoomAnim.k : 1) // 줌 전환 (M, 기다리는 동안 포함). 끝나는 프레임은 도착 그림 쪽(1)
      else if (zoomWait && !anim) drawSlide(slideHas(1) ? 1 : 0) // 줌은 끝났고 도착 구도 굽기를 기다리는 중
      else if (focusTr != null && !anim) drawSlide(slideHas(1) ? 1 : 0) // 패널 이동 중·새 구도 굽기를 기다리는 중
      else if (camMoved) drawMoving()
      else drawStatic(full, dt)
      emitAnchor()
      if (anim || zoomAnim || focus !== focusTarget) emitHover()
      if (qshot) reportMole()
    },
    busy: () => spin || !!anim || !!zoomAnim || zoomWait || !!prep || focus !== focusTarget || (!!mole && !mole.isResting()) || (!!backdrop && (lowActive || (sharpField && !sharpOk && !!mole) || !!baker?.busy())),
    downgrade(nq) {
      renderer.setPixelRatio(nq.pixelRatio)
      sun.castShadow = false; renderer.shadowMap.enabled = false
      // 자동으로 저사양이 됐을 때도 A 는 켬 (부분 사각형은 preserveDrawingBuffer 가 없어서 전체 붙이기만)
      if (wantA() && !backdrop) backdrop = createBackdrop(renderer, { scale: bdScale })
    },
  }, q)

  // 들어오자마자: 처음 서는 자리의 구운 배경이 있으면 3D 가 준비되기 전부터 보여 줌 (그동안 3D 캔버스는 투명)
  if (baker) {
    void getCachedStill(seatKey(opts.startSeat)).then((bmp) => {
      if (bmp && !disposed && !sharpOk && !mole) { showSharp(bmp); (window as unknown as { __stillAt?: number }).__stillAt = performance.now() } // 측정용 표시
    })
  }

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
    busy: () => !!anim || !!zoomAnim || zoomWait,
    zoom: (lv) => zoomTo(lv),
    zoomBy(step) {
      const i = ZOOM_LEVELS.indexOf(level) + step
      return i >= 0 && i < ZOOM_LEVELS.length && zoomTo(ZOOM_LEVELS[i])
    },
    zoomLevel: () => level,
    dispose() {
      disposed = true
      loop.stop()
      mole?.dispose(); fieldFx?.dispose()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointermove', onMoveP)
      el.removeEventListener('pointerleave', onLeave)
      // glb 원본(캐시)의 지오메트리·재질은 다른 장면이 다시 쓰므로 여기서 만든 것만 정리
      scene.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose() })
      ringGeo.dispose()
      own.forEach((x) => x.dispose())
      ;(hoverRing.material as THREE.Material).dispose(); (targetRing.material as THREE.Material).dispose()
      unTier(); baker?.dispose(); sharpCv?.remove()
      slide?.dispose(); glSlide?.dispose(); nextCv?.remove(); bdNext?.dispose(); fillBd?.dispose(); glFill?.dispose(); glFillLow?.dispose()
      backdrop?.dispose(); panBd?.dispose()
      envTex?.dispose()
      sun.shadow.dispose()
      destroyRenderer(renderer)
    },
  }
}
