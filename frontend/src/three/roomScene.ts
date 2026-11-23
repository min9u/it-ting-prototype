import { markShadows } from './contactShadow'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import shellUrl from '../assets/models/room_shell_v3_draco_webp.glb?url'
import holeUrl from '../assets/models/room_ceiling_hole.glb?url'
import dustUrl from '../assets/models/dust_puff_v1.glb?url'
import { BLOCK_COLORS, FURNITURE_CATALOG, SLOTS, diffPlans, planRoom, type FurnitureRow, type PlannedItem } from '../data/roomPlan'
import { createMailbox, type Mailbox } from './mailbox'
import { loadGlb } from './glb'
import { DROP_DURATION, DUST_AT, dustOpacity, furnitureDrop } from './furnitureDrop'
import { bindDriveKeys } from './keys'
import { createMoleActor, loadMoleGltf, REACTIONS, type FurnitureData, type MoleActor, type Seat } from './moleActor'
import { clearPath, planPath, type Rect as NavRect } from './roomPath'
import { loadAccessories } from './moleDress'
import { blobShadow } from './roomLook'
import { approach, createRenderer, destroyRenderer, frameCamera, quality, startLoop, testParam, type HostScreen, type SceneHandle } from './engine'
import { createBackdrop, toDynamicLayer } from './staticBackdrop'
import { createSharpBaker, type SharpBaker } from './sharpBake'
import { getCachedStill, peekCachedStill, putCachedStill } from './stills'
import { waitGpu, warmScene } from './warm'
import { ROOM_FRAME } from './roomFrame'
import { WALLPAPER_REPEAT, tileUrl, wallpaperOf } from '../data/wallpapers'
import { moodWallpaper, type FurnChoice } from '../data/myBurrow'
import { interestCatOf, subOf } from '../data/interests'
import { createStyler, type Styler } from './roomStyle'
import { STYLE_VERSION, type RoomStyle } from '../data/roomStyle'
import { createRoomFx, type RoomFx } from './interestFx/roomFx'

/*
 * 땅굴 방 장면 — 3D 핸드오프 v2 (design/digul_3d_handoff_v2, docs/room_spec.md) + v3 (design/digul_3d_handoff_v3)
 * - 껍데기·소품: 조명을 구운 텍스처(emissive)라 실시간 조명을 받지 않음. 가구·두더지는 실시간 조명
 * - 기본 가구·장식·벽 선반: furniture_catalog.json(app/src/data/furnitureCatalog.json)의 type base·deco 행 glb 를 방 원점에 그대로
 * - 관심사 가구·소품: data/roomPlan.ts 가 slots.json 기준으로 자리를 정함. glb 가 없으면(todo) 카테고리 색 둥근 블록
 *   모델 파일은 assets/models/room/ 에 카탈로그의 glb_compressed 이름 그대로 두면 코드 변경 없이 쓰임
 * - 가구 낙하 "또로로록" + 착지 먼지: furniture_drop_spec.md (값은 slots.json 의 drop). 방이 보인 뒤 0.3초에 시작해 1.9초 안에 다 놓임 (2026-11-12)
 * - 좌표: 1 unit = 1m, 방 중심 바닥 = 원점, 방 지름 6.5m, 돔은 뒤쪽 절반만
 * - 들어올 때: 천장 구멍 열림(0.417초) → 두더지 떨어짐 → 1.5초에 구멍 닫힘 (HANDOFF_v2 2번)
 * - 구도: 스펙 카메라(위치 (0,1.56,6.37), target (0,2.04,0), 세로 FOV 48.5° @4:3)를 4:3 "가상 화면"에 그리고,
 *   가상 화면 높이·위치 = roomFrame.ts ROOM_FRAME, 가로 가운데 = focusX
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
  /** 연출 없이 다 차려진 방으로 시작 (시작 화면): 천장 구멍·두더지 낙하·가구 낙하 없음 */
  still?: boolean
  /** 방명록 우체통: 새 방명록이 있음 (깃발 올림·편지·발광). 그 뒤 바뀌는 건 handle.setMailbox */
  mailbox?: boolean
  /** 우체통을 누름 → 방명록 전체 보기 (Worker 시험판에는 안 넘어감) */
  onMailbox?: () => void
  /** 세부 관심사마다 고른 가구 단어 (data/myBurrow FurnChoice). 앱 화면은 늘 빈 값 = 맨 앞 단어, 실험실만 씀. 그 뒤 바뀌는 건 handle.setFurniture */
  furniture?: FurnChoice
  /** 가구 칠하기·무늬·마감·모양 (data/roomStyle.ts, 2026-11-16 실험). 없으면 디자이너 원래 모습 */
  style?: RoomStyle
  /** 관심사 이펙트 (three/interestFx/roomFx.ts, docs/interest-effects.md). 있으면 켬. viewer = 남의 땅굴에서 내 관심사, talk = 집주인 대화 의향(목) */
  fx?: { viewer?: string[]; talk?: 'open' | 'slow' | null }
}

/** 땅굴 장면 손잡이: 공통 + 우체통 상태 바꾸기 + 고른 가구 바꾸기 */
export interface RoomSceneHandle extends SceneHandle {
  setMailbox?(hasNew: boolean): void
  /** 고른 가구를 그 자리에서 갈아 끼움 (장면을 다시 만들지 않음, 02 F4 꾸미기 가구 탭 5번) */
  setFurniture?(choice: FurnChoice): void
  /**
   * 관심사가 바뀜 (내 정보 수정 저장): 장면을 다시 만들지 않고 방 배치를 다시 계산해, 새로 들어온 관심사의 소품만 떨어뜨림
   * (이미 있던 건 제자리, 빠진 관심사의 소품은 사라짐). 벽지가 바뀌면 장면을 새로 만들어야 해서 RoomCanvas 가 deps 로 처리
   */
  setInterests?(interests: string[]): void
}

/** S 선명한 방 그림 (같은 탭 안에서만, 최근 3개). 키 = 방 주인·관심사·벽지·크기·카메라 */
const SHARP_CACHE = new Map<string, HTMLCanvasElement>()

/** 방 모델 glb (파일 이름 = 카탈로그의 glb_compressed). 두더지·껍데기는 따로 불러서 여기엔 없음 */
/*
 * 방 모델은 파일마다 따로 불러옴 (docs/rendering-experiments.md 5번). 공유 빌드는 glb 가 data URL 로 JS 에 들어가서,
 * 한꺼번에(eager) 넣으면 관심사 가구 11개가 다 땅굴 청크(약 12MB)에 들어감 → 이 방에 필요한 것만 받음.
 * 일반 빌드에서는 파일 주소만 든 아주 작은 청크
 */
const MODEL_LAZY = import.meta.glob<string>('../assets/models/room/*.glb', { query: '?url', import: 'default' })
const MODEL_KEYS = new Set(Object.keys(MODEL_LAZY))
/** 모델 키(파일 경로) → glb */
const loadModel = async (k: string) => loadGlb(await MODEL_LAZY[k]())
/** sit_clip_set(v3.3) 또는 옛 seat_type → 앉는 동작 묶음. 모르는 값은 방석 */
const seatKind = (v?: string): Seat['kind'] => (v === 'beanbag' || v === 'chair' ? v : 'cushion')
/** 카탈로그 행 → 모델 키 (파일이 없으면 undefined) */
const urlOf = (r: FurnitureRow) => { const f = r.glb_compressed ?? r.glb; const k = f ? `../assets/models/room/${f}` : ''; return MODEL_KEYS.has(k) ? k : undefined }
/** 가구별 동작 (카탈로그에 없는 정보). 원탁엔 찻주전자·컵이 있어서 커피 */
const ACTS: Record<string, FurnitureData['act']> = { round_table: 'drink' }

const ROOM_R = 3.25            // 방 반지름
const FLOOR_Y = .03            // 러그 위 (두더지 기본 자리)
const MOLE_R = .36             // 두더지 몸 반지름 (폭 약 0.8m)
const HOLE_OPEN = .417, HOLE_CLOSE = 1.5
/**
 * 가구 낙하 시작 (방에 들어온 뒤 초). 2026-11-12 사용자 요청 "2초 안에": 두더지 착지(2.2)를 기다리지 않고
 * 천장 구멍이 열리는 동안 같이 시작 → 마지막 가구 착지 ≤ FURN_T0 + DROP_SPAN + DROP_LEN = 1.9초 (data/roomPlan.ts)
 */
const FURN_T0 = 0.3
/** 착지 먼지: 한꺼번에 많이 떨어질 때 시끄럽고 무겁지 않게 동시에 최대 4개, 0.06초 간격 이상 */
const DUST_MAX = 4, DUST_MIN_GAP = .06
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

export function mountRoomScene(container: HTMLElement, opts: RoomSceneOptions = {}): RoomSceneHandle {
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
  /*
   * 꾸미기 무늬 · 마감 (2026-11-18 2단계): 아주 느린 PC(기기 단계 weak)는 무늬 · 벨벳 없이 색 · 모양만 (무늬마다 셰이더 종류가 늘어
   * 첫 진입 컴파일이 길어짐, docs/room-diversity-2-2026-11-18.md 저사양). 구운 방 그림 캐시 키에도 넣음. 시험용 ?stylepat=0 (끔) · 1 (켬)
   */
  const spParam = testParam('stylepat')
  const stylePatterns = spParam === '1' || (spParam !== '0' && q.tier !== 'weak')
  const renderer = createRenderer(container, { alpha: true, exposure: 1, shadowType: THREE.PCFSoftShadowMap, quality: q, preserve: partial, canvas: opts.canvas })
  renderer.toneMapping = THREE.AgXToneMapping   // Blender 기본(AgX)과 맞춤
  renderer.shadowMap.enabled = false             // 바닥·벽은 그림자가 구워져 있음. 두더지는 발밑 그림자 판
  /*
   * A 배경 한 번 + 움직이는 것만 (lib/lowLab.ts, staticBackdrop.ts. 탐색하기와 같은 방식):
   * 움직이는 것(두더지·집주인·발밑 그림자·천장 구멍·떨어지는 중인 가구·먼지)은 layer 1, 나머지(껍데기·가구·착지한 가구)는 layer 0.
   * layer 0 은 렌더 타깃에 한 번 그려 두고, 매 프레임은 붙인 뒤 layer 1 만 그림 → 방 전체 정점 처리가 매 프레임에서 빠짐.
   * 가구가 착지하면 layer 0 으로 옮기고 배경을 다시 찍음. 카메라·줌·크기가 바뀌어도 다시 찍음
   */
  const backdrop = q.level === 'low' && q.lab?.A ? createBackdrop(renderer, { kind: 'room' }) : null
  /*
   * S 방은 선명하게 (2026-11-12 사용자 요청 "두더지 화질은 낮아져도 괜찮은데 방은 GPU 켰을 때처럼"):
   * 방(layer 0)이 멈춰 있으면 고해상도(기기 배율 × 1.5 슈퍼샘플)로 한 번 그려서 WebGL 캔버스 뒤 2D 캔버스에 깔아 둠.
   * WebGL 캔버스(0.55배)는 투명하게 지우고 배경 깊이만 써서 두더지(layer 1)만 그림 → 방은 선명, 두더지만 저해상도.
   * 카메라·패널 이동·가구 낙하·먼지 중에는 예전처럼 전부 저해상도로 그리고, 끝나고 0.35초 조용하면 다시 찍음.
   * 천장 구멍·두더지는 움직이는 층이라 선명한 방 위에 저해상도로 그림
   * Worker(D)에는 DOM 이 없어서 안 씀. 시험용 ?sharp=0 으로 끔
   * 2026-11-16 3차 (docs/rendering-experiments-3.md): 굽기를 sharpBake.ts 로 (1.5배 슈퍼샘플을 그 자리에서 읽던 것 →
   * 1배 + MSAA 를 렌더 타깃에 띠로 나눠 굽고 비동기로 읽음. 메인 스레드가 그림을 기다리지 않음). 시험용 ?rstrips= ?rmsaa= ?rbake=0(예전 방식)
   */
  const sharp = !!backdrop && !opts.canvas && (q.lab?.S ?? true) && testParam('sharp') !== '0'
  let sharpCv: HTMLCanvasElement | null = null
  const sharpCache = sharp && testParam('sharpcache') !== '0'
  /** 2D 캔버스 그림이 지금 구도와 맞음 (보이는 중) */
  let sharpOk = false
  /** 방이 바뀐 뒤 조용히 지난 시간 (초) */
  let settle = 0
  /** 고른 가구 (선명한 방 캐시 키에 넣음) */
  let furnKey = Object.entries(opts.furniture ?? {}).sort().join(',')
  /** 지금 방의 관심사 (꾸미기·내 정보 수정에서 바뀌면 handle.setInterests) */
  let curInterests = opts.interests ?? []
  const useBaker = testParam('rbake') !== '0'
  let baker: SharpBaker | null = null
  /** 굽고 있는 그림의 캐시 키 */
  let bakeKey = ''
  const sharpOff = () => { settle = 0; baker?.cancel(); if (sharpOk) { sharpOk = false; if (sharpCv) sharpCv.style.visibility = 'hidden' } }
  /** 방(layer 0)을 고해상도로 그려 2D 캔버스에 옮김. 끝나면 원래 해상도로 */
  const sharpKeyOf = (out: number) => {
    camera.updateMatrixWorld()
    const r = (a: ArrayLike<number>) => Array.from(a, (v) => v.toFixed(4)).join(',')
    // STYLE_VERSION: 테마 색처럼 코드에 있는 꾸미기 값이 바뀌면 키가 바뀜 → 예전에 구운 방 그림(IndexedDB)이 남지 않음
    return [opts.ownerId, curInterests.join('+'), furnKey, opts.wallpaper ?? '', opts.still ? 1 : 0, `s${STYLE_VERSION}${stylePatterns ? 'p' : 'c'}`, JSON.stringify(style ?? ''), W, H, out, r(camera.matrixWorld.elements), r(camera.projectionMatrix.elements)].join('|')
  }
  const ensureSharpCv = () => {
    if (!sharpCv) {
      sharpCv = document.createElement('canvas')
      sharpCv.setAttribute('aria-hidden', 'true')
      sharpCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
      container.insertBefore(sharpCv, renderer.domElement)
    }
    return sharpCv
  }
  /** 그림 한 장을 2D 캔버스에 깔고 보이게 */
  const showSharp = (img: CanvasImageSource & { width: number; height: number }) => {
    const cv = ensureSharpCv()
    cv.width = img.width; cv.height = img.height
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0)
    cv.style.visibility = 'visible'
  }
  const captureSharp = () => {
    ensureSharpCv()
    if (!sharpCv) return
    const out = Math.min(window.devicePixelRatio || 1, 2)
    // 같은 탭에서 같은 방·같은 구도로 다시 들어오면 (탐색하기 갔다 돌아오기 등) 찍어 둔 그림을 그대로 씀 (docs/rendering-experiments.md 4번)
    const key = sharpCache ? sharpKeyOf(out) : ''
    const hit = sharpCache ? SHARP_CACHE.get(key) : undefined
    if (hit) {
      sharpCv.width = hit.width; sharpCv.height = hit.height
      sharpCv.getContext('2d')!.drawImage(hit, 0, 0)
      sharpCv.style.visibility = 'visible'
      sharpOk = true
      return
    }
    // 이 브라우저에서 예전에 구운 같은 그림 (IndexedDB, 새로고침·다음 방문. 3차): 다시 굽지 않음
    const saved = sharpCache ? peekCachedStill(key) : null
    if (saved) { showSharp(saved); sharpOk = true; return }
    if (useBaker) {
      // 굽기 시작 (다 되면 stepBake 가 보이게 하고 캐시에 넣음)
      const cv = sharpCv
      baker ??= createSharpBaker(renderer, { samples: +(testParam('rmsaa') ?? q.bakeSamples), strips: +(testParam('rstrips') ?? q.bakeStrips), linear: testParam('bakelin') === '1' }, () => cv)
      bakeKey = key
      baker.start(scene, camera, Math.max(1, Math.round(W * out)), Math.max(1, Math.round(H * out)))
      baker.step()
      return
    }
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
    if (sharpCache) {
      const copy = document.createElement('canvas'); copy.width = sharpCv.width; copy.height = sharpCv.height
      copy.getContext('2d')!.drawImage(sharpCv, 0, 0)
      SHARP_CACHE.delete(key); SHARP_CACHE.set(key, copy)
      while (SHARP_CACHE.size > 3) SHARP_CACHE.delete(SHARP_CACHE.keys().next().value!)
    }
    sharpCv.style.visibility = 'visible'
    sharpOk = true
  }
  /** 굽기 한 걸음 (매 프레임). 이번에 다 됐으면 true */
  const stepBake = (): boolean => {
    if (!baker || baker.step() !== 'done' || !sharpCv) return false
    sharpCv.style.visibility = 'visible'
    sharpOk = true
    const w = window as unknown as { __captures?: [string, number][] }
    ;(w.__captures ??= []).push(['roomBake', Math.round(baker.lastMs)]) // 측정용: 굽기 시작 → 2D 캔버스
    if (sharpCache && bakeKey) {
      const copy = document.createElement('canvas'); copy.width = sharpCv.width; copy.height = sharpCv.height
      copy.getContext('2d')!.drawImage(sharpCv, 0, 0)
      SHARP_CACHE.delete(bakeKey); SHARP_CACHE.set(bakeKey, copy)
      while (SHARP_CACHE.size > 3) SHARP_CACHE.delete(SHARP_CACHE.keys().next().value!)
      putCachedStill(bakeKey, copy) // 다음 방문에도 (쉴 때 webp 로)
    }
    return true
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
  type Foot = { x0: number; x1: number; z0: number; z1: number }
  const feet: Foot[] = []
  /** 기본 가구 발자리 (모양을 바꾸면 다시 잼) / 관심사 가구 발자리 */
  let baseFeet: Foot[] = []
  const itemFeet: Foot[] = []
  /** 우체통 발자리 */
  let mailboxFeet: Foot[] = []
  const syncFeet = () => { feet.length = 0; feet.push(...baseFeet, ...itemFeet, ...mailboxFeet) }
  /** 칠하기·모양 (three/roomStyle.ts) */
  let style = opts.style
  let styler: Styler | null = null
  /** 기본 가구 노드와 카탈로그 행 (모양이 바뀌면 발자리·앉는 높이를 다시 잼) */
  const baseNodes: { c: FurnitureRow; node: THREE.Object3D }[] = []
  /** 칠하기 모드: 가구를 누르면 걷지 않고 이 함수로 가구 id 를 알림 */
  let pickCb: ((id: string | null) => void) | null = null

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

  /**
   * 길 찾기 (three/roomPath.ts): clampRoom 과 같은 장애물(가구 발자리 + 집주인 두더지 자리)을 돌아가는 길.
   * 집주인은 둥근 자리(clampRoom 의 need)를 감싸는 네모로 봄
   */
  const navRects = (): NavRect[] => {
    if (!host) return feet
    const h = host.object.position, need = MOLE_R * 2.1
    return [...feet, { x0: h.x - need, x1: h.x + need, z0: h.z - need, z1: h.z + need }]
  }
  // ?nav=0 = 예전처럼 곧장 (비교용)
  const nav = testParam('nav') === '0' ? undefined : {
    plan: (from: { x: number; z: number }, to: { x: number; z: number }) => planPath(from, to, navRects(), ROOM_R - .5),
    clear: (a: { x: number; z: number }, b: { x: number; z: number }) => clearPath(a, b, navRects()),
  }
  // 시험용 손잡이 ?navdbg=1: 두더지 자리 · 장애물 · 걷기 · 바닥 점의 화면 좌표 (헤드리스 크롬 확인)
  if (testParam('navdbg') === '1') {
    ;(window as unknown as { __roomNav?: unknown }).__roomNav = {
      pos: () => (mole ? { x: mole.object.position.x, z: mole.object.position.z, idle: mole.isIdle() } : null),
      rects: () => navRects(),
      seated: () => !!mole?.isSeated(),
      walkTo: (x: number, z: number) => { mole?.walkTo(new THREE.Vector3(x, FLOOR_Y, z)); loop.wake() },
      screen: (x: number, z: number) => {
        const v = new THREE.Vector3(x, FLOOR_Y, z).project(camera), r = renderer.domElement.getBoundingClientRect()
        return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }
      },
    }
  }

  /** 기본 가구 발자리·앉는 높이를 지금 모양(크기·두께)으로 다시 잼 */
  const measureBase = () => {
    scene.updateMatrixWorld(true)
    baseFeet = []
    for (const { c, node } of baseNodes) {
      const box = new THREE.Box3().setFromObject(node)
      if (box.min.y > 1) continue
      if (box.max.y < 0.05) continue // 러그(높이 1.8cm)처럼 납작한 것은 걸어서 넘음 (v3.8.1 HANDOFF 3번: 발자리는 수납장·조명·큰 화분만)
      const data = node.userData.furniture as FurnitureData | undefined
      if (data?.seat && data.sitAt) data.seat.h = data.sitAt.getWorldPosition(new THREE.Vector3()).y
      // 방석처럼 앉는 낮은 가구는 발자리를 조금 작게 (앞까지 걸어와야 해서)
      const pad = c.sit_point ? MOLE_R * .6 : MOLE_R
      if (c.id === 'round_table') {
        // 둥근 원탁은 네모로 막으면 모서리 쪽(방석 앞 걸어오는 시작점 (±0.68, 0.65))이 막힌 곳이 되어 두더지가 못 들어감 →
        // 가로 · 세로로 긴 네모 둘을 겹친 십자 모양 (모서리를 잘라 둥근 모양에 가깝게. 몸 반지름만큼 부푼 원 밖으로 다님)
        const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2
        const hx = (box.max.x - box.min.x) / 2 + pad, hz = (box.max.z - box.min.z) / 2 + pad
        baseFeet.push({ x0: cx - hx, x1: cx + hx, z0: cz - hz * .7, z1: cz + hz * .7 }, { x0: cx - hx * .7, x1: cx + hx * .7, z0: cz - hz, z1: cz + hz })
        continue
      }
      baseFeet.push({ x0: box.min.x - pad, x1: box.max.x + pad, z0: box.min.z - pad, z1: box.max.z + pad })
    }
    syncFeet()
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
  /*
   * N 저사양이면 가구는 처음부터 제자리 (2026-11-12 사용자 요청): 떨어지는 동안은 저해상도 층에 있다가
   * 다 놓인 뒤에야 S(방은 선명하게)로 선명해져서 "흐렸다가 갑자기 좋아짐". 가구를 미리 놓아 두고 두더지만 떨어짐
   */
  const furnDrop = !reduce && !opts.still && !(q.level === 'low' && (q.lab?.N ?? true))
  // 기본으로 켬 (2026-11-13 측정: 처음 들어올 때 가장 긴 멈춤 WARP 0.70 → 0.15초, GPU 0.32 → 0.15초. 대신 다 차려지는 시각은 0.1~0.2초 늦음). 시험용 ?compile=0 으로 끔
  const precompile = testParam('compile') !== '0'
  let warming = false
  /*
   * 그리기 예열 (docs/rendering-experiments.md 2번): WARP(ANGLE D3D11)는 셰이더를 미리 컴파일해도 물체를 처음 그릴 때
   * 파이프라인을 만드느라 첫 프레임이 0.3~0.5초 멈춤. 메시 몇 개씩만 보이게 해서 1×1 영역에 그리고 쉬기를 반복 →
   * 같은 일을 짧은 작업 여러 개로 나눔. 배경(A) 렌더 타깃과 캔버스 두 군데 다 (셰이더가 다름)
   */
  const warmDraws = async () => {
    const meshes: THREE.Object3D[] = []
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o) })
    const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
    const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), scOn = renderer.getScissorTest()
    const mask = camera.layers.mask
    for (const m of meshes) m.visible = false
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
      for (const m of meshes) m.visible = true
      camera.layers.mask = mask
      renderer.setRenderTarget(prevTarget); renderer.autoClear = prevAuto
      renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scOn)
      backdrop?.invalidate(); fullNext = true
    }
  }
  let markLoaded = () => {}
  const loaded = new Promise<void>((r) => { markLoaded = r })

  // 관심사 → 가구 배치 (data/roomPlan.ts). 진짜 모델이 있는 행의 glb 만 받음
  let furnChoice: FurnChoice = { ...(opts.furniture ?? {}) }
  const plan = planRoom(opts.interests ?? [], furnChoice) // v3.8: 소분류마다 단어 하나 (고른 값 furnChoice 는 단어, 모르는 값은 첫 단어)
  // 벽지: 화면이 정해 넘긴 값(data/roomLook.ts roomLookOf). 안 넘긴 화면(시작 화면 등)은 같은 규칙(대표 관심사의 대분류)으로
  const wall = wallpaperOf(opts.wallpaper ?? moodWallpaper(opts.interests ?? []))
  // 시험·비교 도구가 읽는 값 (tools/room-diversity: 내 땅굴과 방문자 뷰가 같은 방 모습인지). Worker(D)에는 window 가 없어서 globalThis
  ;(globalThis as unknown as { __roomLook?: Record<string, unknown> }).__roomLook = { owner: opts.ownerId ?? null, wallpaper: wall.id, furniture: opts.furniture ?? {}, style: opts.style ?? null }
  const tileSrc = tileUrl(wall.id, q.level === 'low' ? 512 : 1024)
  let wallMat: THREE.MeshBasicMaterial | null = null
  const fixedRows = FURNITURE_CATALOG.filter((r) => (r.type === 'base' || r.type === 'deco') && urlOf(r))
  const fixedUrls = [...new Set(fixedRows.map((r) => urlOf(r)!))]
  const planUrls = [...new Set(plan.items.filter((it) => it.built).map((it) => urlOf(it.row)).filter((u): u is string => !!u))]
  const softLoad = (u: string) => loadModel(u).catch((e) => { console.warn('[3D] 관심사 가구 모델을 못 불러와서 블록으로 대신해요', u, e); return null })
  /*
   * 방명록 우체통 (v3.6, three/mailbox.ts): slots.json mailbox_slot 고정 자리, 관심사와 상관없이 항상, 낙하 없음.
   * 깃발·편지·발광이 바뀌는 작은 물건이라 움직이는 층(layer 1)에 둠 → 저사양 배경(A)·선명한 방(S) 그림에는 안 들어가고,
   * 바뀔 때만 우체통 자리를 부분으로 다시 그림
   */
  const mailboxRow = FURNITURE_CATALOG.find((r) => r.id === 'mailbox')
  const mailboxSlot = SLOTS.find((sl) => sl.name === 'mailbox_slot')
  const mailboxUrl = mailboxRow ? urlOf(mailboxRow) : undefined
  let mailbox: Mailbox | null = null
  let mailboxNew = !!opts.mailbox
  /** 우체통이 이번(또는 지난) 프레임에 바뀜 → 부분 그리기 사각형에 넣음 */
  let mailboxDirty = false
  /** 관심사 이펙트 (3D 위 2D 겹 캔버스라 배경 굽기·부분 그리기와 상관없음) */
  let fx: RoomFx | null = null

  /**
   * 슬롯 묶음(g) 안에 가구 모델(src) 또는 블록을 넣음. 처음 만들 때와 꾸미기 가구 탭에서 갈아 끼울 때 같이 씀
   * 반환: 놓인 크기 (발자리 계산용)
   */
  const fillSlot = (g: THREE.Group, it: PlannedItem, src: THREE.Object3D | null) => {
    const { row, slot } = it
    if (src) {
      // v3.8.1: 작은 소품은 바닥 칸 1.4배 · 원탁 칸 0.45배 (slot.model_scale)
      const m = src.clone(true); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(slot.model_scale ?? 1)
      markShadows(m)
      g.add(m)
      return row.size_m
    }
    // 블록: 크기는 size_m 을 슬롯 최대 크기 안으로 (선반 칸보다 큰 소품 행이 있어서)
    const size = { w: Math.min(row.size_m.w, slot.max_m.w), d: Math.min(row.size_m.d, slot.max_m.d), h: Math.min(row.size_m.h, slot.max_m.h) }
    const b = makeBlock(row, size, BLOCK_COLORS[it.category] ?? '#F7E6C8')
    blockGeos.push(b.geometry); blockMats.push(b.material)
    g.add(b)
    return size
  }
  /** 가구를 눌렀을 때 말풍선에 보일 관심사 이름 (02 F4 땅굴 메인 3번): 세부 관심사 가구면 그 관심사, 카테고리 가구면 대분류 */
  const topicOf = (it: PlannedItem) => (it.sub ? subOf(it.sub)?.name_ko : interestCatOf(it.category)?.name_ko) ?? ''

  /** 떨어지는 가구 하나 (슬롯 자리에 놓인 묶음) */
  interface Drop {
    g: THREE.Group; it: PlannedItem; pos: [number, number, number]; dir: THREE.Vector3; ry: number; dustDone: boolean
    /** 발자리 (벽에 걸린 것·선반 소품은 없음) */
    foot?: Foot
    /** 꾸미기에서 단어를 바꿔 새로 놓인 것: 자기 시계(초). 있으면 방 전체 낙하 시간표와 상관없이 제자리 등장(pop)으로 */
    own?: number
    /** own 일 때: true = 단어만 바꿈(제자리 pop), false = 새 관심사(슬롯 drop 값대로 떨어짐, own 이 음수면 그만큼 기다림) */
    ownPop?: boolean
  }
  const drops: Drop[] = []
  /** 방 전체 가구 낙하가 아니라, 꾸미기에서 단어를 바꿔 새로 놓인 것만 제자리에서 등장하는 중인 수 */
  let popping = 0
  let addItem: ((it: PlannedItem, own: boolean, srcRoot: THREE.Object3D | null) => Drop) | null = null
  let planRootsRef: Map<string, THREE.Object3D | null> | null = null
  let seqT = -1                      // 가구 낙하 연출 경과 (−1 = 안 함)
  let lookT = -1, lastPuff = -1      // 두더지 두리번 대기 경과 (−1 = 안 함) / 마지막 먼지를 튼 seqT
  const blockGeos: THREE.BufferGeometry[] = [], blockMats: THREE.Material[] = []
  let dustG: GLTF | null = null
  const dusts: { o: THREE.Object3D; mixer: THREE.AnimationMixer; act: THREE.AnimationAction; mats: THREE.Material[]; t: number }[] = []

  Promise.all([
    loadGlb(shellUrl), loadGlb(holeUrl), loadMoleGltf(), loadAccessories(),
    Promise.all(fixedUrls.map((u) => loadModel(u))),
    Promise.all(planUrls.map(softLoad)),
    loadGlb(dustUrl).catch(() => null),
    tileSrc ? loadTile(tileSrc) : Promise.resolve(null),
    mailboxUrl ? loadModel(mailboxUrl).catch((e) => { console.warn('[3D] 우체통 모델을 못 불러왔어요', e); return null }) : Promise.resolve(null),
  ]).then(async ([shell, hole, moleG, acc, fixedG, planG, dust, tile, mailboxG]) => {
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
    // 칠하기·모양: 기본 가구·전구 줄·러그를 등록하고 먼저 한 번 적용 (모양이 바뀐 상태로 발자리·앉는 높이를 잼)
    styler = createStyler(renderer, { patterns: stylePatterns })
    for (const c of fixedRows) {
      const node = roots.get(urlOf(c)!)?.getObjectByName(c.node)
      if (!node) continue
      if (c.type === 'base') { styler.register(c.id, c.name_ko, node, 'base'); baseNodes.push({ c, node }) }
      // 벽 장식 중 팔레트 재질(나무 선반 3개)만 테마 색을 따라감. 가랜드·액자·매달린 화분은 구운 그림 한 장이라 그대로 (2026-11-18)
      else if (c.type === 'deco' && c.id !== 'string_lights') styler.register(c.id, c.name_ko, node, 'item')
    }
    for (const r of roots.values()) { const sl = r.getObjectByName('string_lights'); if (sl) styler.register('string_lights', '전구 줄', sl, 'lights') }
    const rugMesh = shellS.getObjectByName('round_rug') as THREE.Mesh | undefined
    if (rugMesh?.isMesh) styler.registerRug(rugMesh)
    // 껍데기(벽 · 바닥 · 나무 뼈대): 테마에 shell 이 있으면 색을 곱해 물들임 (data/roomStyle CATEGORY_THEMES, 2026-11-18 2단계)
    styler.registerShell(shellS, wallMat, tile ? wall.avg_color_srgb : wall.solid_color ?? '#F0B47A', !tile)
    // 꾸미기는 관심사 가구까지 등록한 뒤 한 번만 입힘 (아래, 2026-11-18: 두 번 입히면 첫 진입 작업이 길어짐). 모양이 바뀐 발자리는 그때 다시 잼
    scene.updateMatrixWorld(true)
    for (const { c, node } of baseNodes) {
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
    }
    measureBase()

    // 관심사 가구·소품: 슬롯 자리에 묶음(g)을 두고 그 안에 모델 또는 블록
    const planRoots = new Map(planUrls.map((u, i) => [u, planG[i]?.scene ?? null]))
    /** 슬롯 자리에 묶음(g)을 두고 그 안에 모델 또는 블록. own = 꾸미기에서 새로 놓는 것 (바로 pop 으로 등장) */
    addItem = (it: PlannedItem, own: boolean, srcRoot: THREE.Object3D | null) => {
      const { row, slot } = it
      const g = new THREE.Group(); g.name = `slot:${slot.name}`
      const ry = THREE.MathUtils.degToRad(slot.ry_deg)
      // 선반 소품: 카탈로그 shelf_offset_forward_m 만큼 칸의 앞쪽(슬롯 +Z = 방 쪽)으로 (HANDOFF_v3_2 3번)
      const fwd = slot.kind === 'shelf' ? row.shelf_offset_forward_m ?? 0 : 0
      const pos: [number, number, number] = [slot.pos_three[0] + Math.sin(ry) * fwd, slot.pos_three[1], slot.pos_three[2] + Math.cos(ry) * fwd]
      g.position.set(...pos)
      g.rotation.order = 'YXZ'; g.rotation.y = ry
      const src = it.built ? srcRoot?.getObjectByName(row.node) : null
      const size = fillSlot(g, it, src ?? null)
      // 벽에 걸린 것·선반·원탁 위 소품은 발자리 없음 (원탁 위는 원탁 발자리가 막음)
      const hung = slot.mount === 'wall_hung' || slot.kind === 'shelf' || slot.kind === 'table_top'
      const data: FurnitureData = {
        id: row.id, label: row.name_ko, hint: it.built ? row.name_ko : `${row.name_ko} · 3D 모델 준비 중`,
        // 벽에 걸린 것·선반 소품은 두더지가 앞까지 걸어가지 않음 (앞이 다른 가구일 수 있음)
        stand: hung ? undefined : Math.max(size.w, size.d) / 2 + .55, noWalk: hung,
      }
      g.userData.topic = topicOf(it)
      // 앉는 자리가 있는 관심사 가구 (M3 빈백 sit_point_chair_01 등): 모델 안 노드 extras 의 seat_type 으로
      const sp = row.sit_point ? g.getObjectByName(row.sit_point) : undefined
      const spx = sp?.userData as { seat_type?: string; sit_clip_set?: string; seat_height_m?: number } | undefined
      if (sp && (spx?.sit_clip_set || row.sit_clip_set || spx?.seat_type)) {
        data.seat = { kind: seatKind(spx?.sit_clip_set ?? row.sit_clip_set ?? spx?.seat_type), h: spx?.seat_height_m ?? sp.position.y }
        data.sitAt = sp; data.hint = undefined
      }
      g.userData.furniture = data
      furniture.add(g)
      // 동물(고양이·강아지 …)은 테마 색으로 칠하지 않음 (털색이 보라·분홍이 되면 이상함)
      if (row.type !== 'pet') styler?.register(row.id, row.name_ko, g, 'item')
      let foot: Foot | undefined
      if (!hung) {
        // 발자리: 회전한 사각형의 축 정렬 경계 + 두더지 반지름
        const c = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry))
        const hx = c * size.w / 2 + sn * size.d / 2 + MOLE_R, hz = sn * size.w / 2 + c * size.d / 2 + MOLE_R
        foot = { x0: g.position.x - hx, x1: g.position.x + hx, z0: g.position.z - hz, z1: g.position.z + hz }
        itemFeet.push(foot)
      }
      const dr: Drop = { g, it, pos, ry, dir: new THREE.Vector3(-g.position.x, 0, -g.position.z).normalize(), dustDone: false, foot, own: own ? 0 : undefined }
      drops.push(dr)
      if (furnDrop || own) toDynamicLayer(g) // 떨어지는 동안은 움직이는 층, 착지하면 layer 0 (stepDrops)
      return dr
    }
    for (const it of plan.items) addItem(it, false, planRoots.get(urlOf(it.row)!) ?? null)
    planRootsRef = planRoots
    if (pendingSync) { pendingSync = false; queueMicrotask(reconcile) }

    // 방명록 우체통
    if (mailboxG && mailboxSlot) {
      const mb = mailbox = createMailbox(mailboxG, { pos: mailboxSlot.pos_three, ryDeg: mailboxSlot.ry_deg }, { pulse: q.level === 'high' && !reduce })
      scene.add(mb.root, mb.hit)
      toDynamicLayer(mb.root)
      mb.setNew(mailboxNew, true)
      const [mx, , mz] = mailboxSlot.pos_three
      mailboxFeet = [{ x0: mx - mb.half.x - MOLE_R, x1: mx + mb.half.x + MOLE_R, z0: mz - mb.half.z - MOLE_R, z1: mz + mb.half.z + MOLE_R }]
    }
    syncFeet()
    if (style) { styler.apply(style); measureBase() }

    // 천장 구멍
    holeObj = holeS
    holeMixer = new THREE.AnimationMixer(holeS)
    const clip = (n: string) => THREE.AnimationClip.findByName(hole.animations, n)
    const once = (c: THREE.AnimationClip | null) => {
      if (!c || !holeMixer) return null
      const a = holeMixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; return a
    }
    holeOpen = once(clip('ceiling_hole_open')); holeClose = once(clip('ceiling_hole_close'))
    const drop = !reduce && !opts.still
    holeS.visible = drop
    if (drop && holeOpen) { holeOpen.play(); holeT = 0 }
    // 가구 낙하: 두더지가 떨어지는 연출을 할 때만 (모션 줄이기·저사양 N 이면 처음부터 제자리)
    if (drop && furnDrop && drops.length) { seqT = 0; lookT = 0; for (const d of drops) d.g.visible = false }

    if (opts.hostName) {
      host = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(.75, FLOOR_Y, .7), yaw: -.45, drop: false, lookEvery: [5, 11], floorY: FLOOR_Y, acc, worn: opts.hostWorn, simple: simpleMole })
      scene.add(host.object)
    }
    mole = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(0, FLOOR_Y, .85), clamp: clampRoom, nav, drop, dropDelay: HOLE_OPEN, floorY: FLOOR_Y, acc, worn, simple: simpleMole })
    scene.add(mole.object)
    // 기본 자리 (3D 핸드오프 v3.8, 3단계): 내 땅굴은 노랑 방석, 방문자 뷰는 집주인 노랑 · 손님 하늘색. 둘 다 카메라 쪽을 보고 앉음.
    // 낙하 연출이 있으면 떨어져 한 번 두리번한 뒤 걸어가 앉고, 연출이 없으면(정지 그림 · 동작 줄이기) 처음부터 앉은 채
    const cushion = (id: string) => baseNodes.find((b) => b.c.id === id)?.node ?? null
    mole.setHome(cushion(host ? 'cushion_sky' : 'cushion_yellow'))
    if (host) { host.setHome(cushion('cushion_yellow')); host.sitHomeNow() }
    if (!drop) mole.sitHomeNow()
    for (const a of [host, mole]) if (a) { const sh = blobShadow(.9); scene.add(sh); shadows.set(a, sh); toDynamicLayer(a.object); toDynamicLayer(sh) }
    // 땅굴 비교 찍기용 (?nomole=1, tools/room-diversity, docs/room-diversity-2026-11-18.md): 두더지 두 마리를 숨기고 방만. 발밑 그림자는 루프가 따라 숨김.
    // 연출 없는 방(still)에서만 맞음 (떨어지는 연출은 두더지를 다시 보이게 함)
    if (testParam('nomole') === '1') for (const a of [host, mole]) if (a) a.object.visible = false
    if (opts.fx && !opts.canvas) {
      fx = createRoomFx({
        container, after: renderer.domElement, camera, ownerId: opts.ownerId, interests: opts.interests ?? [], viewer: opts.fx.viewer,
        // 천장 구멍은 두더지가 떨어지는 자리(원점) 바로 위. glb 경계 상자 가운데는 뚜껑 조각 때문에 옆으로 치우쳐 있어서 x·z 는 0
        hole: new THREE.Vector3(0, Math.min(3.3, new THREE.Box3().setFromObject(holeS).max.y || 3.2), 0),
        items: () => drops.map((d) => ({ g: d.g, sub: d.it.sub, category: d.it.category, rowId: d.it.row.id, type: d.it.row.type })),
        intro: () => holeT >= 0 || seqT >= 0,
        // 2차: 두더지 뒤 이펙트 가리기 · 알아챔 · 인사 · 반딧불
        actors: () => ({ me: mole?.object ?? null, host: host?.object ?? null }),
        talk: opts.hostName ? opts.fx.talk ?? null : null,
      })
    }
    fullNext = true
    sharpOff()
    // 가구가 처음부터 제자리면 방은 이미 다 됨 → 첫 프레임에 바로 선명하게 (두더지가 떨어지는 도중에 멈칫하지 않게)
    if (seqT < 0) settle = 1
    // 셰이더 미리 컴파일 (docs/rendering-experiments.md 2번): KHR_parallel_shader_compile 이 있으면 드라이버가 따로 컴파일하는 동안 메인 스레드가 놂
    // 배경(A)은 선형 렌더 타깃에 그려서 셰이더 종류가 캔버스와 다름 → 두 가지 다. 텍스처도 한 장씩 나눠 올림 (긴 작업 하나 → 짧은 작업 여럿)
    if (precompile) {
      warming = true // 예열이 끝날 때까지 루프는 그리지 않음 (안 그러면 첫 프레임이 예열보다 먼저 그려서 소용없음)
      const makeBaker = () => {
        if (!sharp || !useBaker || opts.canvas) return
        const cv = sharpCv ?? document.createElement('canvas')
        baker ??= createSharpBaker(renderer, { samples: +(testParam('rmsaa') ?? q.bakeSamples), strips: +(testParam('rstrips') ?? q.bakeStrips), linear: testParam('bakelin') === '1' }, () => sharpCv ?? cv)
      }
      // GPU(가속 켬)는 2차 방식 그대로: 3차 예열(펜스로 나눠 기다림)은 WARP 의 동기 호출 멈춤용이라 GPU 에선 이득 없이 다 보이기까지만 0.2~0.4초 늘었음
      // (docs/rendering-experiments-3.md 6번). 시험용 ?rwarm=0 은 저사양에서도 예전 방식
      if (testParam('rwarm') === '0' || q.level !== 'low') {
        // 예전 방식 (2차까지): 장면 전체를 두 군데 다 컴파일 + 텍스처 + 25ms 묶음 그리기
        if (backdrop) await backdrop.precompile(scene, camera)
        await renderer.compileAsync(scene, camera).catch(() => {})
        const texs = new Set<THREE.Texture>()
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
          for (const mm of m ? (Array.isArray(m) ? m : [m]) : []) for (const v of Object.values(mm)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture)
        })
        for (const t of texs) { if (disposed) return; renderer.initTexture(t); await new Promise((r) => setTimeout(r, 0)) }
        makeBaker(); baker?.warm(scene, camera)
        await warmDraws()
      } else {
        // 3차 (warm.ts): 층마다 실제로 그려지는 곳만 컴파일·그리기, 하나 그릴 때마다 GPU 가 끝날 때까지 비동기로 기다림.
        // 셰이더가 다 준비된 뒤에 S 굽기용 렌더 타깃·톤매핑 셰이더 (작은 크기로 한 번, sharpBake.ts)
        // 선명한 방 굽기 렌더 타깃은 캔버스처럼 톤매핑·sRGB 셰이더를 써서(sharpBake.ts) layer 0 을 그쪽으로도 예열 (extra)
        makeBaker()
        await warmScene(renderer, scene, camera, { split: backdrop ? backdrop.target() : null, extra: baker?.warmTarget() ?? null, dead: () => disposed })
        if (disposed) return
        if (baker) { baker.warm(scene, camera); await waitGpu(renderer) }
        backdrop?.invalidate(); fullNext = true
      }
      warming = false
    }
    if (disposed) return
    loop.ready()
    markLoaded()
  }).catch((err) => { console.warn('[3D] 땅굴 모델을 못 불러왔어요', err); markLoaded() })

  /*
   * 가구 낙하 (furniture_drop_spec.md): FURN_T0 부터 계획의 start 순서대로. 시작 전에는 숨김.
   * 선반 소품·벽걸이는 pop(제자리에서 커짐), 먼지는 slots.json drop.dust 배율 (null 이면 없음)
   */
  const stepDrops = (dt: number) => {
    if (seqT >= 0) seqT += dt
    const t0 = FURN_T0
    let busy = false, pop = 0
    for (const d of drops) {
      let t: number
      let spec = d.it.slot.drop
      if (d.own !== undefined) {
        // 꾸미기·내 정보 수정에서 새로 놓인 것: 방 전체 시간표 밖, 자기 시계로 (단어만 바꾼 건 제자리 pop, 새 관심사는 슬롯 값대로 낙하)
        d.own += dt
        if (d.own >= DROP_DURATION) {
          d.own = undefined
          d.g.visible = true; d.g.position.set(...d.pos); d.g.rotation.y = d.ry; d.g.scale.setScalar(1)
          d.g.traverse((o) => o.layers.set(0)); backdrop?.invalidate()
          continue
        }
        t = d.own; pop++
        if (d.ownPop) spec = { ...spec, mode: 'pop' }
      } else if (seqT < 0) continue
      else t = seqT - t0 - d.it.start
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
      if (!d.dustDone && t >= DUST_AT) {
        d.dustDone = true
        // 겹쳐 떨어지므로 먼지는 동시에 DUST_MAX 개, DUST_MIN_GAP 간격까지만 (넘치면 그 가구는 먼지 없이 착지)
        if (spec.dust && (d.own !== undefined || seqT - lastPuff >= DUST_MIN_GAP) && dusts.filter((q) => q.t >= 0).length < DUST_MAX) { if (d.own === undefined) lastPuff = seqT; puff(x, y, z, d.ry, spec.dust) }
      }
    }
    popping = pop
    if (seqT >= 0 && !busy) {
      if (testParam('droplog')) console.info(`[3D] 가구 ${drops.length}개 다 놓임: 장면 시간 ${seqT.toFixed(2)}초 (방이 보인 뒤)`)
      seqT = -1; lastPuff = -1
    }
  }

  /** 가구가 떨어지는 동안 내려온 두더지가 두리번 (영상 시나리오: mole_look_around). 착지해서 쉬는 첫 순간, 4초 안에만 */
  const stepLook = (dt: number) => {
    if (lookT < 0) return
    lookT += dt
    if (mole?.isIdle()) { lookT = -1; mole.react('look') } else if (lookT > 4) lookT = -1
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
    // 우체통: 보이지 않는 큰 상자. 앞에 가구·집주인이 더 가까우면 그쪽
    const mbHit = mailbox ? ray.intersectObject(mailbox.hit, false)[0] : undefined
    const onMailbox = !!mbHit && !onHost && (!hit || mbHit.distance < hit.distance + .2)
    return { g: hit && !onHost && !onMailbox ? furnitureOf(hit.object) : null, onHost, onMailbox }
  }
  const actionOf = (g: THREE.Object3D | null) => {
    const f = g?.userData.furniture as FurnitureData | undefined
    if (pickCb) return f ? `🖌 ${f.label}` : null
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
  /*
   * 집주인 머리 위 화면 위치 → onHostScreen (VisitBurrow 의 '대화 요청하기' 말풍선이 따라감).
   * 프레임마다 계산하되 1px 넘게 바뀔 때만 알림 (Worker 면 메시지가 되므로). 루프가 쉬는 동안엔 아무것도 안 움직이니 그대로 맞음
   * 숨김: 집주인이 안 보임, 입장 연출(천장 구멍·가구 낙하) 중, 리액션 말풍선과 겹칠 때(집주인 말풍선 또는 집주인 곁에서 내 말풍선)
   */
  let hostCb: ((p: HostScreen | null) => void) | null = null
  let hostLast: HostScreen | null = null, hostSent = false
  const hostV = new THREE.Vector3()
  // 집주인 키 (모자 같은 액세서리까지, 발바닥 기준 m). headTop 은 머리만이라 모자에 말풍선 꼬리가 걸쳐서 한 번 재 둠
  let hostTall = 0
  const reportHost = () => {
    if (!hostCb) return
    let p: HostScreen | null = null
    if (host && host.object.visible && holeT < 0 && seqT < 0) {
      const hp = host.object.position
      if (!hostTall) {
        host.headTop(hostV)
        const box = new THREE.Box3().setFromObject(host.object, true)
        // + 6cm: 재는 자세(묶인 자세)와 움직이는 자세가 조금 달라 확대하면 꼬리가 모자에 닿았음
        hostTall = Math.max(hostV.y - hp.y, Number.isFinite(box.max.y) ? box.max.y - hp.y : 0) + .06
      }
      const clash = bubbles.some((b) => b.who && clock >= b.from - .1 && clock < b.until + .2 &&
        (b.who === host || Math.hypot(b.who.object.position.x - hp.x, b.who.object.position.z - hp.z) < 1.6))
      if (!clash) {
        hostV.set(hp.x, hp.y + hostTall, hp.z).project(camera)
        if (hostV.z < 1) p = { x: (hostV.x * .5 + .5) * W, y: (-hostV.y * .5 + .5) * H }
      }
    }
    if (hostSent && (p === null) === (hostLast === null) && (!p || !hostLast || (Math.abs(p.x - hostLast.x) < 1 && Math.abs(p.y - hostLast.y) < 1))) return
    hostLast = p; hostSent = true
    hostCb(p)
  }
  const hint = document.createElement('div')
  Object.assign(hint.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '4', font: '500 13px/1 Pretendard, system-ui, sans-serif', padding: '7px 10px', borderRadius: '8px', background: 'rgba(62,42,31,.88)', color: '#fbf4ec', transform: 'translate(-50%, calc(-100% - 14px))', opacity: '0', transition: 'opacity .12s', whiteSpace: 'nowrap' })
  container.append(hint)
  let clock = 0
  /*
   * 가구를 누르면 그 가구의 관심사 이름 말풍선 (02 F4 땅굴 메인 3번). 누른 자리 위에 1.8초
   */
  const tip = document.createElement('div')
  Object.assign(tip.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '5', font: '600 14px/1 Pretendard, system-ui, sans-serif', padding: '9px 13px', borderRadius: '14px', background: 'rgba(251,248,244,.97)', color: '#3e2a1f', boxShadow: '0 4px 14px rgba(60,35,20,.18)', transform: 'translate(-50%, calc(-100% - 18px)) scale(.8)', opacity: '0', transition: 'opacity .15s, transform .2s cubic-bezier(.2,.7,.2,1.4)', whiteSpace: 'nowrap' })
  container.append(tip)
  let tipTimer = 0
  const showTip = (text: string, e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    tip.textContent = text
    tip.style.left = `${e.clientX - rect.left}px`; tip.style.top = `${e.clientY - rect.top}px`
    tip.style.opacity = '1'; tip.style.transform = 'translate(-50%, calc(-100% - 18px)) scale(1)'
    hint.style.opacity = '0'
    clearTimeout(tipTimer)
    tipTimer = window.setTimeout(() => { tip.style.opacity = '0'; tip.style.transform = 'translate(-50%, calc(-100% - 18px)) scale(.8)' }, 1800)
  }
  /**
   * 관심사·고른 단어가 바뀜 (v3.8): 새 선택으로 방 배치를 다시 계산해(planRoom) 지금 방과 견줌.
   * 같은 자리 · 같은 모델은 그대로 두고, 달라진 것만 빼고 새로 놓음.
   * - 새로 들어온 관심사의 소품: 슬롯 drop 값대로 떨어짐 (새 것끼리 계획의 순서·간격, 먼지 포함)
   * - 이미 있던 관심사에서 단어만 바꾼 소품(자리 종류가 달라질 수 있음: 선반 ↔ 바닥): 제자리 pop
   * - 빠진 관심사의 소품: 사라짐
   */
  const swapSeq = new Map<string, number>()
  let pendingSync = false
  const reconcile = () => {
    const add = addItem, roots = planRootsRef
    if (!add || !roots) { pendingSync = true; return } // 아직 가구를 다 놓기 전: 다 놓은 뒤 적용
    const { removed, drop: dropNew, pop: popNew } = diffPlans(drops.map((d) => d.it), planRoom(curInterests, furnChoice).items)
    const keyOf = (it: PlannedItem) => `${it.slot.name}|${it.row.id}`
    const gone = new Set(removed.map(keyOf))
    let changed = false
    // 빠질 것
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]
      if (!gone.has(keyOf(d.it))) continue
      furniture.remove(d.g); styler?.unregister(d.g)
      if (d.foot) { const j = itemFeet.indexOf(d.foot); if (j >= 0) itemFeet.splice(j, 1) }
      drops.splice(i, 1); changed = true
    }
    // 새로 놓을 것 (모델 파일은 같은 대분류라 대개 이미 받아 둠. 아니면 받고 나서)
    const fresh = [...dropNew, ...popNew]
    const isNew = (it: PlannedItem) => dropNew.includes(it)
    // 새 관심사 소품끼리는 계획의 시작 시각 차이만 유지 (가장 빠른 것이 바로 시작)
    const firstStart = Math.min(...dropNew.map((it) => it.start))
    for (const it of fresh) {
      changed = true
      const u = it.built ? urlOf(it.row) : undefined
      const seq = (swapSeq.get(it.slot.name) ?? 0) + 1
      swapSeq.set(it.slot.name, seq)
      const asNew = isNew(it)
      const place = (src: THREE.Object3D | null) => {
        if (disposed || swapSeq.get(it.slot.name) !== seq || drops.some((d) => keyOf(d.it) === keyOf(it))) return
        const dr = add(it, true, src)
        dr.ownPop = !asNew
        dr.own = asNew ? -(it.start - firstStart) : 0
        if (style) styler?.apply(style)
        syncFeet()
        dr.g.visible = false; popping = Math.max(popping, 1) // 첫 프레임에 stepDrops 가 0 크기(pop) 또는 시작 높이(낙하)로 보임
        backdrop?.invalidate(); sharpOff(); fullNext = true
        loop.wake()
      }
      const cached = u ? roots.get(u) : null
      if (!u || cached) place(cached?.getObjectByName(it.row.node) ?? null)
      else softLoad(u).then((gl) => { roots.set(u, gl?.scene ?? null); place(gl?.scene.getObjectByName(it.row.node) ?? null) })
    }
    if (changed) { syncFeet(); backdrop?.invalidate(); sharpOff(); fullNext = true; loop.wake() }
  }
  const applyFurniture = (choice: FurnChoice) => {
    furnChoice = { ...choice }
    furnKey = Object.entries(furnChoice).sort().join(',')
    reconcile()
  }
  const applyInterests = (list: string[]) => {
    if (list.join('|') === curInterests.join('|')) return
    curInterests = [...list]
    reconcile()
  }

  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    if (pickCb) {
      pick(e) // 광선만 맞춤
      const hit = ray.intersectObject(furniture, true).find((h) => !/^shadow_/.test(h.object.name))
      pickCb(hit ? styler?.idOf(hit.object) ?? null : null)
      return
    }
    if (!mole) return
    const { g, onHost, onMailbox } = pick(e)
    if (onHost) return
    if (g?.userData.topic) showTip(g.userData.topic as string, e)
    if (g) fx?.poke(g) // 관심사 이펙트: 누르면 그 관심사 입자가 한 움큼 (r_poke)
    // 우체통: 방명록 전체 보기 (두더지는 움직이지 않음)
    if (onMailbox) { opts.onMailbox?.(); return }
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
  const onLeave = () => { moveQueued = null; hint.style.opacity = '0'; el.style.cursor = 'pointer'; fx?.hover(null, null); if (mailbox?.setHover(false)) loop.wake() }
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave)
  el.style.cursor = 'pointer'

  /** 마우스를 올린 가구 이름표 (프레임마다 한 번만 레이캐스트) */
  const showHint = () => {
    if (!moveQueued) return
    const e = moveQueued; moveQueued = null
    const pk = pick(e), rect = el.getBoundingClientRect()
    const label = pk.onHost ? opts.hostName ?? null : pk.onMailbox ? '방명록 보기' : actionOf(pk.g)
    if (mailbox?.setHover(pk.onMailbox)) loop.wake()
    // 관심사 카드를 띄웠으면 이름표는 숨김 (카드에 "누르면 · 동작"이 들어감)
    const card = !!fx?.hover(pk.onHost || pk.onMailbox || pickCb ? null : pk.g, label)
    el.style.cursor = 'pointer'
    hint.textContent = label ?? ''
    hint.style.opacity = label && !card ? '1' : '0'
    hint.style.left = `${e.clientX - rect.left}px`; hint.style.top = `${e.clientY - rect.top}px`
  }

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  // 화질 비교용 같은 장면 스크린샷 (?qshot=1, explore/gpu/cdp-quality.mjs): 두더지 자세 고정 + 두더지 화면 사각형을 window.__moleRect 로
  const qshot = testParam('qshot') === '1'
  let qposed = false
  const reportMoles = () => {
    const box = new THREE.Box3(), b = new THREE.Box3(), v = new THREE.Vector3()
    for (const a of [mole, host]) if (a) box.union(b.setFromObject(a.object))
    if (box.isEmpty()) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
      const x = (v.x * .5 + .5) * W, y = (1 - (v.y * .5 + .5)) * H
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    const c = container.getBoundingClientRect()
    ;(window as unknown as { __moleRect?: unknown }).__moleRect = { x0: Math.round(c.left + x0), y0: Math.round(c.top + y0), x1: Math.round(c.left + x1), y1: Math.round(c.top + y1), scene: { x0: Math.round(c.left), y0: Math.round(c.top), x1: Math.round(c.right), y1: Math.round(c.bottom) } }
  }
  // 빌드용 정지 그림 찍기 (?stillshot=1, explore/gpu/make-stills.mjs): 4:3 구도 상자를 캔버스 안에 위 0 으로 다 들어오게 하고 상자 위치를 알림
  const stillShot = testParam('stillshot') === '1'
  const applyFrame = () => {
    if (stillShot) {
      const bh = H, bw = bh * 4 / 3, left = focus * W - bw / 2
      frameCamera(camera, W, H, { left, top: 0, w: bw, h: bh })
      const r = container.getBoundingClientRect()
      ;(window as unknown as { __stillBox?: unknown }).__stillBox = { x: r.left + left, y: r.top, w: bw, h: bh }
      return
    }
    if (W / H < 1) {
      // 세로 화면: 가로를 꽉 채움 (스펙: 가로 화각 유지 → 돔 양옆이 잘리지 않게)
      const bw = W * 1.02, bh = bw * 3 / 4
      frameCamera(camera, W, H, { left: (W - bw) / 2, top: (H - bh) * .62, w: bw, h: bh })
    } else {
      const bh = H * ROOM_FRAME.h, bw = bh * 4 / 3
      frameCamera(camera, W, H, { left: focus * W - bw / 2, top: ROOM_FRAME.top * H, w: bw, h: bh })
    }
  }

  let camMoving = false
  /** 다음 프레임은 전체를 그림 (처음·크기 변경·모델 다 받음·액세서리 변경) */
  let fullNext = true
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  let prevRect: Rect | null = null
  const corner = new THREE.Vector3()
  /*
   * 두더지 + 발밑 그림자 + 모자를 덮는 상자(가로·깊이 ±0.62m, 높이 1.5m)를 화면에 투영한 사각형 (CSS px, 아래가 0)
   * + 뼈대마다 ±0.5m 상자. 천장에서 떨어지는 동작(mole_room_drop)처럼 기준점(object.position)은 바닥에 둔 채
   * 뼈대만 움직이는 동작이 있어서, 기준점만 보면 공중의 두더지가 사각형 밖에 남음 → 머리가 잘리고 지워지지 않은
   * 잔상이 계속 남던 버그 (2026-11-12 사용자 제보)
   * + 액세서리(뼈에 붙은 일반 메시: 모자·소품)는 자기 경계 상자를 그대로. 베레모처럼 뼈에서 0.5m 넘게 튀어나와
   *   가는 줄 잔상이 남았음
   */
  const actorBones = new Map<MoleActor, THREE.Object3D[]>()
  const boneP = new THREE.Vector3()
  const accBox = new THREE.Box3()
  const addBox = (r: Rect, cx: number, y0: number, y1: number, cz: number, h: number) => {
    for (let i = 0; i < 8; i++) {
      corner.set(cx + (i & 1 ? h : -h), i & 2 ? y1 : y0, cz + (i & 4 ? h : -h)).project(camera)
      const x = (corner.x * .5 + .5) * W, y = (corner.y * .5 + .5) * H
      r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y)
    }
  }
  const actorRect = (a: MoleActor, r: Rect) => {
    const p = a.object.position, s = a.object.scale.x
    a.object.updateMatrixWorld(true) // 이번 프레임 동작(mixer)이 반영된 뼈·액세서리 위치
    addBox(r, p.x, p.y - .05, p.y + 1.5 * s, p.z, .62 * s)
    let bones = actorBones.get(a)
    if (!bones) { bones = []; a.object.traverse((o) => { if ((o as THREE.Bone).isBone) bones!.push(o) }); actorBones.set(a, bones) }
    // 액세서리는 갈아 끼울 수 있어서 매번 찾음 (노드 수십 개라 가벼움)
    a.object.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || !o.visible) return
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      accBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld)
      const c = accBox.getCenter(boneP), half = Math.max(accBox.max.x - accBox.min.x, accBox.max.z - accBox.min.z) / 2 + .05
      addBox(r, c.x, accBox.min.y - .05, accBox.max.y + .05, c.z, half)
    })
    const pad = .5 * s
    for (const b of bones) { b.getWorldPosition(boneP); addBox(r, boneP.x, boneP.y - pad, boneP.y + pad, boneP.z, pad) }
  }
  /** 우체통 + 빛무리 + 외곽선을 덮는 상자 */
  const mailboxRect = (r: Rect) => {
    if (!mailbox) return
    const p = mailbox.root.position
    addBox(r, p.x, p.y - .05, p.y + .8, p.z, .48)
  }
  const drawFull = () => {
    renderer.setScissorTest(false); renderer.autoClear = true
    renderer.render(scene, camera)
  }
  /** A: 배경을 붙이고 움직이는 층만. 부분 그리기가 되면 두더지 둘레 사각형 안에서만 */
  const drawBackdrop = (full: boolean) => {
    const bd = backdrop!
    if (bd.isDirty()) { bd.capture(scene, camera); full = true }
    if (stepBake()) full = true
    else if (sharp && !sharpOk && !baker?.busy() && !baker?.broken && mole && settle >= .35) { captureSharp(); full = true }
    const cur: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (const a of [mole, host]) if (a && a.object.visible) actorRect(a, cur)
    if (mailboxDirty) mailboxRect(cur)
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
    if (mailboxDirty) mailboxRect(cur)
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
      if (warming) return
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
      if (camMoving || holeT >= 0 || seqT >= 0 || popping > 0 || dusts.some((d) => d.t >= 0)) full = true
      // S: 방이 바뀌는 중이면 선명한 그림을 내리고 저해상도로, 조용하면 시간을 셈 (dt 0 인 깨우기 프레임은 구도 변화가 아님)
      if (sharp) {
        const moving = focus !== focusTarget || camMoving || Math.abs(camera.position.distanceTo(controls.target) - zoomGoal) > 1e-3 || seqT >= 0 || popping > 0 || dusts.some((d) => d.t >= 0)
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
      if (seqT >= 0 || popping > 0) { stepDrops(dt); styler?.update() }
      mailboxDirty = !!mailbox && mailbox.update(dt, t)
      stepDust(dt)
      stepLook(dt)
      if (qshot) { if (!qposed) { qposed = true; host?.update(0); mole?.update(0) } reportMoles() } // 측정용: 두더지 자세 고정
      else { host?.update(dt); mole?.update(dt) }
      for (const [a, sh] of shadows) {
        sh.visible = a.object.visible
        sh.position.set(a.object.position.x, .012, a.object.position.z)
      }
      drawBubbles(t)
      reportHost()
      draw(full)
    },
    // 저사양에서 루프를 멈춰도 되는지: 두더지 동작·구멍·가구 낙하·먼지·줌·카메라 감속·패널 이동·말풍선이 모두 끝났을 때
    busy() {
      if (mole && !mole.isResting()) return true
      if (host && !host.isResting()) return true
      if (holeT >= 0 || seqT >= 0 || popping > 0 || dusts.some((d) => d.t >= 0)) return true
      if (mailbox?.busy()) return true
      if (baker?.busy()) return true
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

  /*
   * 들어오자마자: 이 브라우저에서 예전에 구운 같은 구도의 방 그림이 있으면(IndexedDB) 3D 가 준비되기 전부터 보여 줌 (docs/rendering-experiments-3.md 5번).
   * RoomView 는 still 이 true 면 로딩 애니메이션 대신 장면을 바로 보이게 함. 3D 가 준비되면 같은 그림을 선명한 방(S)으로 그대로 씀
   */
  let still: Promise<boolean> = Promise.resolve(false)
  if (sharp && sharpCache) {
    const key0 = sharpKeyOf(Math.min(window.devicePixelRatio || 1, 2))
    still = getCachedStill(key0).then((bmp) => {
      if (!bmp || disposed || sharpOk) return false
      showSharp(bmp)
      ;(window as unknown as { __stillAt?: number }).__stillAt = performance.now() // 측정용: 예전에 구운 그림이 보인 시각
      return true
    })
  }

  return {
    loaded,
    still,
    resize: () => loop.resize(),
    setFocusX(x) {
      focusTarget = x
      // 루프가 안 도는 환경(헤드리스·숨은 탭)에서도 최종 위치는 맞게
      if (document.hidden) { focus = x; applyFrame(); reportHost() }
      loop.wake()
    },
    setMailbox(hasNew) {
      mailboxNew = hasNew
      mailbox?.setNew(hasNew)
      loop.wake()
    },
    setFurniture: (c) => applyFurniture(c),
    setInterests: (l) => applyInterests(l),
    setWorn(ids) { worn = ids; mole?.setWorn(ids); if (mole) toDynamicLayer(mole.object); loop.wake() },
    setFrozen: (on) => loop.setFrozen(on),
    setStyle(next) {
      // null = 꾸미기 없이 디자이너 원래 모습 (🎨 땅굴 색 다양하게 끔, lib/roomLookLab.ts)
      style = next ?? undefined
      const g = globalThis as unknown as { __roomLook?: Record<string, unknown> }
      if (g.__roomLook) g.__roomLook = { ...g.__roomLook, style: next ?? null }
      if (!styler) return
      if (next) styler.apply(next); else styler.reset()
      measureBase()
      // 방 그림이 바뀜 → 배경(A)·선명한 방(S) 다시
      backdrop?.invalidate(); sharpOff(); fullNext = true
      loop.wake()
    },
    styleTargets: () => (styler && style ? styler.info(style) : styler?.info({ theme: 'base', parts: {}, shape: {} }) ?? []),
    setPickMode(cb) { pickCb = cb; hint.style.opacity = '0' },
    snapshot() {
      // 지금 장면을 한 번 전부 그려서 바로 읽음 (preserveDrawingBuffer 없이도 같은 작업 안이면 읽힘)
      const mask = camera.layers.mask
      camera.layers.enableAll()
      renderer.setRenderTarget(null)
      renderer.setScissorTest(false); renderer.autoClear = true
      renderer.render(scene, camera)
      camera.layers.mask = mask
      fullNext = true
      return renderer.domElement.toDataURL('image/png')
    },
    onHostScreen(cb) { hostCb = cb; hostSent = false; reportHost() },
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
          if (me.isGreeting()) { say(0, me, emoji); say(1, hs, emoji, .25); fx?.greet(); return }
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
      hostCb = null
      loop.stop()
      controls.dispose()
      unbindKeys()
      mole?.dispose(); host?.dispose(); mailbox?.dispose(); fx?.dispose()
      holeMixer?.stopAllAction()
      for (const d of dusts) d.mixer.stopAllAction()
      // 이 장면에서 만든 블록·먼지 재질만 해제 (glb 것은 캐시가 다시 씀)
      blockGeos.forEach((g) => g.dispose()); blockMats.forEach((m) => m.dispose())
      wallMat?.map?.dispose(); wallMat?.dispose()
      styler?.dispose()
      for (const d of dusts) d.mats.forEach((m) => m.dispose())
      bubbles.forEach((b) => b.el.remove()); hint.remove(); tip.remove(); clearTimeout(tipTimer)
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave)
      // glb 지오메트리·텍스처는 캐시가 다음 장면에서 다시 쓰므로 해제하지 않음 (GPU 쪽은 렌더러·컨텍스트와 함께 풀림)
      for (const sh of shadows.values()) { sh.geometry.dispose(); (sh.material as THREE.Material).dispose() }
      baker?.dispose(); backdrop?.dispose(); sharpCv?.remove()
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
export function applyWallpaper(root: THREE.Object3D, tile: THREE.Texture | null, solid?: string): THREE.MeshBasicMaterial | null {
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
