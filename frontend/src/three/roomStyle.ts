import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PALETTE_KEYS, SLOT_NAME, PATTERN_SIZES, shapeOf, themeOf, type FinishKind, type PaletteKey, type PartStyle, type PatternKind, type PatternStyle, type RoomStyle, type ShellLook } from '../data/roomStyle'

/*
 * 땅굴 가구 칠하기·무늬·마감·모양 (2026-11-16 실험, docs/burrow-diversity.md, 데이터는 data/roomStyle.ts)
 *
 * - 색: 가구 glb 재질 이름 M_<팔레트 자리> → 가구마다 재질을 복제해서 색만 바꿈. AO 텍스처(occlusionTexture)는 그대로라 음영 유지
 *   glb 재질은 장면·가구끼리 공유(캐시)라 원본은 절대 안 고침
 * - 무늬: onBeforeCompile 로 색 단계 뒤에 삼면 투영(triplanar) 무늬를 섞음. 좌표는 가구 기준(크기 m)이라 회전한 가구에서도 결이 맞음
 *   (UV 는 AO 아틀라스용이라 무늬에 못 씀)
 * - 마감: 점토(원래 Standard) / 도자기·금속(Physical + 방 환경맵) / 벨벳·펠트(sheen)
 * - 모양: 기본 가구만. 노드 크기·위치 바꾸기, 숨기기·복제, 코드로 만든 점토 덧붙이(테이블보·술). 덧붙이도 팔레트 재질이라 같이 칠해짐
 * - 러그: 껍데기에 구운 그림(emissive)이라 밝기만 살리고 색을 다시 입힘
 * apply(style) 는 매번 처음 상태로 되돌린 뒤 다시 적용 (몇 번 불러도 같은 결과)
 */

export type StyleKind = 'base' | 'item' | 'lights'

/** UI 용: 칠할 수 있는 가구와 색 자리 */
export interface StyleTargetInfo {
  id: string
  label: string
  kind: StyleKind
  parts: { key: string; slot: PaletteKey; name: string; color: string }[]
}

interface Entry {
  mesh: THREE.Mesh
  orig: THREE.Material
  /** 저장 키 (보통 팔레트 자리, 덧붙이는 'head'·'cloth'·'tassel' 처럼 따로) */
  part: string
  /** 테마 색을 가져올 자리 */
  slot: PaletteKey
  /** 덧붙이 기본값 (깅엄 테이블보의 무늬 등) */
  defaults?: PartStyle
  addon?: boolean
}
interface Saved { p: THREE.Vector3; s: THREE.Vector3; v: boolean }
interface MatSlot { mat: THREE.MeshStandardMaterial; sig: string; u: PatUniforms | null }
interface PatUniforms { uPatColor: { value: THREE.Color }; uPatCells: { value: number }; uPatFrame: { value: THREE.Matrix4 } }
interface Target {
  id: string; label: string; kind: StyleKind; root: THREE.Object3D
  entries: Entry[]
  saved: Map<THREE.Object3D, Saved>
  addons: THREE.Object3D[]
  mats: Map<string, MatSlot>
}

const ADDON_LABEL: Record<string, string> = { cloth: '테이블보', tassel: '술' }
const PAT_ID: Record<Exclude<PatternKind, 'none'>, number> = { stripe: 1, dot: 2, check: 3, gingham: 4, zigzag: 5, flower: 6 }
const slotOfMat = (name: string): PaletteKey | null => {
  const m = /^M_(?:bulb_)?(.+)$/.exec(name)
  return m && (PALETTE_KEYS as string[]).includes(m[1]) ? (m[1] as PaletteKey) : null
}
const RUG_REF_LUM = .72
const cellsOf = (p: PatternStyle) => PATTERN_SIZES.find((s) => s.id === p.size)?.cells ?? 11
/** 원래 껍데기가 화면에 보이는 색 (빈 방 사진에서 잰 평균, sRGB). 목표 색 ÷ 이 색 = 구운 빛에 곱할 배율 */
const SHELL_REF = { floor: '#D49E78', wood: '#DDB08A' }
/** 원래 러그 가운데(크림)가 화면에 보이는 색 (무늬 없는 러그를 구운 빛 배율로 칠할 때 기준) */
const RUG_REF = '#ECCC9E'
/*
 * 화면 색 → 넣을 값 (AgX 거꾸로): 땅굴은 AgX 톤 매핑(roomScene)을 써서, 넣은 빛 값이 화면에 나올 때 많이 눌리고 채널끼리 섞임(채도가 줄어듦).
 * 처음엔 "목표 ÷ 원래" 비율을 그대로 곱했더니 하늘·민트 벽이 회색, 빨강 벽이 형광 산호색으로 나왔음 (2026-11-18, 26개 방을 찍어 보며 확인).
 * 그래서 three.js r165 의 AgX 식을 여기 그대로 옮겨, 원하는 화면 색이 나오는 빛 값을 거꾸로 풀어서 넣음.
 * 기준: 원래 껍데기가 화면에 보이는 색(빈 방 사진에서 잰 값) ↔ 그때 넣은 값. 목표 빛 ÷ 기준 빛 = 곱할 배율 (구운 음영·나뭇결은 그대로)
 */
type V3 = [number, number, number]
const mul3 = (m: number[], v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
// three.js tonemapping_pars_fragment (r165) 의 행렬 (GLSL mat3 는 열 순서 그대로)
const SRGB_TO_2020 = [0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956]
const R2020_TO_SRGB = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187]
const AGX_IN = [0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859]
const AGX_OUT = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405]
/** AgX: 선형 빛 → 화면 선형 sRGB (three.js 와 같은 식, 노출 1) */
export function agx(c: V3): V3 {
  let v = mul3(AGX_IN, mul3(SRGB_TO_2020, c))
  v = v.map((x) => {
    const t = Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) + 12.47393) / 16.5))
    const t2 = t * t, t4 = t2 * t2
    return 15.5 * t4 * t2 - 40.14 * t4 * t + 31.96 * t4 - 6.868 * t2 * t + 0.4298 * t2 + 0.1191 * t - 0.00232
  }) as V3
  v = mul3(AGX_OUT, v).map((x) => Math.max(0, x) ** 2.2) as V3
  return mul3(R2020_TO_SRGB, v).map((x) => Math.min(1, Math.max(0, x))) as V3
}
const toLin = (u: number) => (u <= .04045 ? u / 12.92 : ((u + .055) / 1.055) ** 2.4)
export const linOf = (hex: string): V3 => { const n = parseInt(hex.replace('#', ''), 16); return [toLin((n >> 16 & 255) / 255), toLin((n >> 8 & 255) / 255), toLin((n & 255) / 255)] }
const AGX_INV = new Map<string, V3>()
/** 화면에 이 색(sRGB)이 나오게 하는 빛 값 (AgX 를 거꾸로, 되풀이로 풂. 같은 색은 기억) */
export function agxInverse(hex: string): V3 {
  const hit = AGX_INV.get(hex)
  if (hit) return hit
  const want = linOf(hex)
  const lw = want.map((v) => Math.log(Math.max(1e-5, v)))
  // 로그 공간 가우스-뉴턴 (AgX 는 채널을 섞어서 채널마다 따로 맞추면 3~4/255 어긋남). 야코비안은 수치 미분, 3×3 은 크라머
  let u = lw.map((v) => v) as V3
  const f = (q: V3) => agx(q.map(Math.exp) as V3).map((v) => Math.log(Math.max(1e-5, v))) as V3
  for (let i = 0; i < 24; i++) {
    const y = f(u), r = [lw[0] - y[0], lw[1] - y[1], lw[2] - y[2]]
    if (Math.max(...r.map(Math.abs)) < 1e-4) break
    const h = 1e-3, J: number[][] = [[], [], []]
    for (let k = 0; k < 3; k++) { const q = [...u] as V3; q[k] += h; const yk = f(q); for (let j = 0; j < 3; j++) J[j][k] = (yk[j] - y[j]) / h }
    const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    const D = det(J)
    if (Math.abs(D) < 1e-9) break
    const step = [0, 1, 2].map((k) => det(J.map((row, j) => row.map((v, c) => (c === k ? r[j] : v)))) / D)
    u = u.map((v, k) => Math.min(Math.log(64), Math.max(Math.log(1e-5), v + Math.max(-2, Math.min(2, step[k]))))) as V3
  }
  const x = u.map(Math.exp) as V3
  AGX_INV.set(hex, x)
  return x
}
/** 원래 벽 단색(#F0B47A)이 화면 벽 위쪽에 보이는 색 (빈 방 사진) → 벽 위쪽 음영(lightMap) 세기를 거꾸로 셈 */
const WALL_SOLID = '#F0B47A', WALL_SEEN = '#E4B995'
/** 원하는 화면 색 ÷ 기준 화면 색을 빛 값으로 바꾼 배율 (껍데기 구운 빛에 곱함) */
function tintTo(out: THREE.Color, target: string, ref: string) {
  const t = agxInverse(target), r = agxInverse(ref)
  return out.setRGB(t[0] / r[0], t[1] / r[1], t[2] / r[2])
}
/** 벽: 원하는 화면 색이 되게 하는 재질 색 (단색 벽지) 또는 타일 평균색 대비 배율 (무늬 벽지) */
function wallColorFor(out: THREE.Color, target: string, solid: boolean, avg: THREE.Color) {
  const t = agxInverse(target), seen = agxInverse(WALL_SEEN), base = linOf(WALL_SOLID)
  // 벽 위쪽 음영 세기 (채널마다): 원래 단색 × 음영 = 원래 화면 색의 빛 값
  const shade = [seen[0] / base[0], seen[1] / base[1], seen[2] / base[2]]
  const c = [t[0] / shade[0], t[1] / shade[1], t[2] / shade[2]]
  return solid ? out.setRGB(c[0], c[1], c[2]) : out.setRGB(c[0] / Math.max(1e-4, avg.r), c[1] / Math.max(1e-4, avg.g), c[2] / Math.max(1e-4, avg.b))
}

/* ===== 무늬 셰이더 (삼면 투영, 미분으로 가장자리 부드럽게) ===== */
const PAT_GLSL = /* glsl */`
uniform vec3 uPatColor;
uniform float uPatCells;
varying vec3 vPatPos;
varying vec3 vPatN;
float patAA(float d) { float w = fwidth(d) * .75 + 1e-4; return smoothstep(-w, w, d); }
float pat2(vec2 p) {
  p *= uPatCells;
#if PAT_KIND == 1
  return patAA(.25 - abs(fract(p.x) - .5));
#elif PAT_KIND == 2
  vec2 q = p; q.x += .5 * mod(floor(q.y), 2.);
  return patAA(.24 - length(fract(q) - .5));
#elif PAT_KIND == 3
  vec2 f = abs(fract(p * .5) - .5);
  return patAA((.25 - f.x) * (.25 - f.y) * 4.) ;
#elif PAT_KIND == 4
  float a = patAA(.25 - abs(fract(p.x) - .5)), b = patAA(.25 - abs(fract(p.y) - .5));
  return (a + b) * .5;
#elif PAT_KIND == 5
  float y = p.y + abs(fract(p.x) - .5) * 1.2;
  return patAA(.22 - abs(fract(y) - .5));
#else
  vec2 c = fract(p) - .5; float r = length(c), a = atan(c.y, c.x);
  float petal = .2 + .13 * cos(a * 5.);
  return max(patAA(petal - r), 0.) * (1. - patAA(.07 - r) * .6);
#endif
}
float patMask() {
  vec3 n = abs(normalize(vPatN)); n = pow(n, vec3(4.)); n /= (n.x + n.y + n.z);
  return pat2(vPatPos.zy) * n.x + pat2(vPatPos.xz) * n.y + pat2(vPatPos.xy) * n.z;
}
`
const PAT_VERT_DECL = 'uniform mat4 uPatFrame;\nvarying vec3 vPatPos;\nvarying vec3 vPatN;\n'
const PAT_VERT_BODY = `
  vec4 patW = modelMatrix * vec4( transformed, 1.0 );
  vPatPos = ( uPatFrame * patW ).xyz;
  vPatN = mat3( uPatFrame ) * ( mat3( modelMatrix ) * objectNormal );
`

/** 재질에 무늬를 섞음. mode: diffuse(가구) / rug(구운 빛을 밝기만 남기고 다시 칠함) */
function injectPattern(m: THREE.Material, kind: PatternKind, u: PatUniforms, rug?: { color: { value: THREE.Color }; lum: { value: number } }) {
  const id = kind === 'none' ? 0 : PAT_ID[kind]
  m.defines = { ...(m.defines ?? {}), PAT_KIND: id }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, rug ? { uRugColor: rug.color, uRugLum: rug.lum } : {})
    sh.vertexShader = PAT_VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + PAT_VERT_BODY)
    sh.fragmentShader = PAT_GLSL + (rug ? 'uniform vec3 uRugColor;\nuniform float uRugLum;\n' : '') + sh.fragmentShader
    if (rug) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float l = dot( totalEmissiveRadiance, vec3( .2126, .7152, .0722 ) ) / uRugLum;
    float pm = PAT_KIND == 0 ? 0. : patMask();
    totalEmissiveRadiance = mix( uRugColor, uPatColor, pm ) * l;
  }`)
    } else if (id) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix( diffuseColor.rgb, uPatColor, patMask() );')
    }
  }
  m.customProgramCacheKey = () => `pat${id}${rug ? 'rug' : ''}`
  m.needsUpdate = true
}

/* ===== 점토 덧붙이 (코드로 만든 모양) ===== */

/** 메시 → 원래(glb) 재질. userData 에 넣으면 clone 때 JSON 으로 복사돼서 따로 둠 */
const ORIG = new WeakMap<THREE.Mesh, THREE.Material>()
/** 흰 1×1 (덧붙이 재질의 AO 자리, 아래 plainMatLike). UV 채널마다 하나 */
const WHITE_AO = new Map<number, THREE.DataTexture>()
/**
 * 점토 덧붙이(테이블보 · 술) 재질. 가구 glb 의 팔레트 재질(tpl)을 복제하고 AO 만 흰 1×1 로 바꿈 →
 * 셰이더가 가구 재질과 같아서 새로 컴파일할 것이 없음 (2026-11-18: 맨 MeshStandardMaterial 은 셰이더 종류가 하나 늘어
 * 가속 끈 PC 첫 진입이 길어졌음). tpl 이 없으면(가구를 아직 못 받음) 예전처럼 맨 재질
 */
function plainMatLike(tpl: THREE.Material | undefined, slot: PaletteKey) {
  const src = tpl as THREE.MeshStandardMaterial | undefined
  if (!src?.isMeshStandardMaterial) return new THREE.MeshStandardMaterial({ name: `M_${slot}`, roughness: .8 })
  const m = src.clone()
  m.name = `M_${slot}`
  if (m.aoMap) {
    const ch = m.aoMap.channel
    let w = WHITE_AO.get(ch)
    if (!w) { w = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); w.channel = ch; w.needsUpdate = true; WHITE_AO.set(ch, w) }
    m.aoMap = w
  }
  return m
}

/** 노드 원래 상태 */
function snapshotTree(root: THREE.Object3D) {
  const m = new Map<THREE.Object3D, Saved>()
  root.traverse((o) => m.set(o, { p: o.position.clone(), s: o.scale.clone(), v: o.visible }))
  return m
}

/** 노드들을 부모 좌표의 pivot 기준으로 s 배 (회전 없는 노드 전제: 디자이너 기본 가구 하위 노드는 회전이 없음) */
function scaleAbout(nodes: THREE.Object3D[], pivot: THREE.Vector3, s: THREE.Vector3) {
  for (const n of nodes) {
    n.position.sub(pivot).multiply(s).add(pivot)
    n.scale.multiply(s)
  }
}

/** root 기준(로컬) 경계 상자 */
function localBox(root: THREE.Object3D, nodes: THREE.Object3D[]) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const box = new THREE.Box3(), b = new THREE.Box3()
  for (const n of nodes) {
    n.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || /^shadow_/.test(m.name)) return
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      b.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      box.union(b)
    })
  }
  return box
}

/**
 * opts.patterns = false 면 무늬를 그리지 않음(색만): 무늬마다 셰이더 종류가 하나씩 늘어 아주 느린 PC(CPU 2코어 WARP)에서
 * 첫 진입 컴파일이 길어져서 (2026-11-18 측정, docs/room-diversity-2-2026-11-18.md). 저장 값은 그대로라 빠른 PC 에서는 무늬가 보임
 */
export function createStyler(renderer: THREE.WebGLRenderer, opts: { patterns?: boolean } = { patterns: true }) {
  const targets: Target[] = []
  /** 덧붙이 재질: 등록한 가구의 팔레트 재질 하나를 본으로 (셰이더를 같이 씀) */
  const plainMat = (slot: PaletteKey) => plainMatLike(targets.flatMap((t) => t.entries).find((e) => !e.addon)?.orig, slot)
  let env: THREE.Texture | null = null
  let pmrem: THREE.PMREMGenerator | null = null
  const envMap = () => {
    if (!env) {
      pmrem = new THREE.PMREMGenerator(renderer)
      const room = new RoomEnvironment()
      env = pmrem.fromScene(room, .04).texture
      room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
    }
    return env
  }
  let rug: { mesh: THREE.Mesh; orig: THREE.Material; mat: THREE.MeshStandardMaterial | null; tint?: THREE.MeshStandardMaterial; sig: string; u: PatUniforms; color: { value: THREE.Color }; lum: { value: number } } | null = null
  const frameTmp = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }
  /*
   * 껍데기 (2026-11-18 2단계): 바닥 · 나무(갈빗대·벽판·난간) · 돔 테두리는 구운 빛(emissive 그림) 하나를 같이 쓰는 재질이라
   * 이 장면의 메시에만 재질을 복제해 끼우고 emissive 색(그림에 곱해지는 값)으로 물들임 → 구운 음영·나뭇결이 그대로. 셰이더는 원래와 같음(색 값만 다름)
   * 벽(벽지 재질, roomScene applyWallpaper)은 MeshBasic 의 color 를 곱함: 타일이면 평균색 → 목표색, 단색(01)이면 그 색
   */
  interface ShellPart { meshes: THREE.Mesh[]; orig: THREE.Material; mat: THREE.MeshStandardMaterial; ref: string }
  let shell: { parts: Record<'floor' | 'wood' | 'rim', ShellPart | null>; wall: { mat: THREE.MeshBasicMaterial; base: THREE.Color; avg: THREE.Color; solid: boolean } | null } | null = null

  const collect = (t: Target, root: THREE.Object3D, extra?: Partial<Entry>) => {
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || /^shadow_/.test(m.name) || Array.isArray(m.material)) return
      const orig = ORIG.get(m) ?? m.material
      const slot = extra?.slot ?? slotOfMat(orig.name)
      if (!slot) return
      ORIG.set(m, orig)
      t.entries.push({ mesh: m, orig, slot, part: extra?.part ?? slot, defaults: extra?.defaults, addon: extra?.addon })
    })
  }

  /* ----- 모양 (기본 가구) ----- */
  const node = (t: Target, name: string) => t.root.getObjectByName(name)
  const nodes = (t: Target, re: RegExp) => { const a: THREE.Object3D[] = []; t.root.traverse((o) => { if (o !== t.root && re.test(o.name)) a.push(o) }); return a }
  const addAddon = (t: Target, mesh: THREE.Mesh, part: string, slot: PaletteKey, defaults?: PartStyle) => {
    mesh.name = `style_${part}`
    t.root.add(mesh)
    t.addons.push(mesh)
    collect(t, mesh, { part, slot, defaults, addon: true })
  }

  const shapeTable = (t: Target, s: RoomStyle) => {
    const top = node(t, 'round_table_top')
    const tea = node(t, 'round_table_teapot'), cups = nodes(t, /^round_table_cup_0\d$/)
    if (!top) return
    const tb = localBox(t.root, [top]), H = tb.max.y
    const ctr = new THREE.Vector3((tb.min.x + tb.max.x) / 2, 0, (tb.min.z + tb.max.z) / 2)
    const items = [...(tea ? [tea] : []), ...cups]
    const size = shapeOf(s, 'round_table', 'size')
    if (size === 'low') { scaleAbout([top], ctr, new THREE.Vector3(1.05, .62, 1.05)); for (const n of items) n.position.y -= H * .38 }
    if (size === 'big') scaleAbout([top], ctr, new THREE.Vector3(1.25, 1, 1.25))
    const set = shapeOf(s, 'round_table', 'set')
    if (tea && set !== 'all') tea.visible = false
    if (set === 'none') for (const c of cups) c.visible = false
    const cloth = shapeOf(s, 'round_table', 'cloth')
    if (cloth !== 'none') {
      const b = localBox(t.root, [top]), r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, y = b.max.y
      const drop = Math.min(.16, y * .5)
      // 윗면 원판 + 늘어진 치마 (레이스는 아랫단이 물결)
      const pts: THREE.Vector2[] = [new THREE.Vector2(0, y + .012), new THREE.Vector2(r * 1.04, y + .012), new THREE.Vector2(r * 1.1, y - .01), new THREE.Vector2(r * 1.18, y - drop * .55), new THREE.Vector2(r * 1.22, y - drop)]
      const geo = new THREE.LatheGeometry(pts, 48)
      if (cloth === 'lace') {
        const pos = geo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          const py = pos.getY(i)
          if (py > y - drop * .9) continue
          const a = Math.atan2(pos.getZ(i), pos.getX(i))
          pos.setY(i, py + Math.abs(Math.sin(a * 9)) * drop * .35)
        }
        geo.computeVertexNormals()
      }
      const mat = plainMat('cream'); mat.side = THREE.DoubleSide
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(ctr.x, 0, ctr.z)
      // 테이블보가 상판 위에 놓이게 찻잔·주전자를 살짝 올림
      for (const n of items) n.position.y += .012
      const theme = themeOf(s.theme).colors
      const def: PartStyle | undefined = cloth === 'gingham' ? { pattern: { kind: 'gingham', color: theme.orange, size: 'M' } }
        : cloth === 'lace' ? { pattern: { kind: 'flower', color: '#FFFFFF', size: 'S' } } : undefined
      addAddon(t, mesh, 'cloth', 'cream', def)
    }
  }

  const shapeCushion = (t: Target, s: RoomStyle) => {
    const puff = shapeOf(s, t.id, 'puff')
    const bodyN = nodes(t, /_body$/)
    if (puff === 'thick') t.root.scale.y *= 1.6
    if (puff === 'flat') t.root.scale.y *= .65
    if (shapeOf(s, t.id, 'tassel') === 'on' && bodyN[0]) {
      const b = localBox(t.root, bodyN)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const g = new THREE.SphereGeometry(.035, 12, 8).scale(1, 1.6, 1)
        const m = new THREE.Mesh(g, plainMat('yellow'))
        m.position.set(sx > 0 ? b.max.x + .012 : b.min.x - .012, b.max.y * .45, sz > 0 ? b.max.z + .012 : b.min.z - .012)
        addAddon(t, m, 'tassel', 'yellow')
      }
    }
  }

  const shapeCeilingLamp = (t: Target, s: RoomStyle) => {
    const cap = node(t, 'ceiling_lamp_cap')
    if (!cap) return
    const parts = nodes(t, /^ceiling_lamp_(cap|rim|dot_\d+)$/)
    const b = localBox(t.root, parts)
    const piv = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)
    const k = shapeOf(s, 'ceiling_lamp', 'cap')
    if (k === 'wide') scaleAbout(parts, piv, new THREE.Vector3(1.35, .8, 1.35))
    if (k === 'bell') scaleAbout(parts, piv, new THREE.Vector3(.82, 1.35, .82))
  }

  const SHAPERS: Record<string, (t: Target, s: RoomStyle) => void> = {
    // v3.8: room_base_v3(_1) 에서 침대 · 협탁이 빠져서 그 둘의 모양 손질은 지움 (저장된 값은 대상이 없어 그냥 무시됨)
    round_table: shapeTable, cushion_sky: shapeCushion, cushion_yellow: shapeCushion, ceiling_lamp: shapeCeilingLamp,
  }

  /* ----- 재질 ----- */
  const makeMat = (e: Entry, ps: PartStyle): MatSlot => {
    const fin: FinishKind = ps.finish ?? 'clay'
    const src = e.orig as THREE.MeshStandardMaterial
    let m: THREE.MeshStandardMaterial
    if (fin === 'clay') m = src.clone()
    else {
      const p = new THREE.MeshPhysicalMaterial()
      THREE.MeshStandardMaterial.prototype.copy.call(p, src)
      p.defines = { STANDARD: '', PHYSICAL: '' }
      if (fin === 'gloss') { p.roughness = .28; p.clearcoat = 1; p.clearcoatRoughness = .12; p.envMap = envMap(); p.envMapIntensity = .55 }
      if (fin === 'metal') { p.metalness = .9; p.roughness = .3; p.envMap = envMap(); p.envMapIntensity = 1.1 }
      if (fin === 'velvet') { p.roughness = .92; p.sheen = 1; p.sheenRoughness = .35 }
      if (fin === 'felt') { p.roughness = 1; p.sheen = .55; p.sheenRoughness = .85 }
      m = p
    }
    m.name = `${src.name}_styled`
    // 전구는 빛나는 색도 같이 (emissive 가 있는 재질)
    let u: PatUniforms | null = null
    if (ps.pattern && ps.pattern.kind !== 'none') {
      u = { uPatColor: { value: new THREE.Color() }, uPatCells: { value: 11 }, uPatFrame: { value: new THREE.Matrix4() } }
      injectPattern(m, ps.pattern.kind, u)
    }
    return { mat: m, sig: `${fin}|${ps.pattern?.kind ?? 'none'}`, u }
  }

  const resolve = (t: Target, e: Entry, s: RoomStyle): PartStyle => {
    const user = s.parts[t.id]?.[e.part] as PartStyle | undefined
    const ps: PartStyle = { ...e.defaults, ...user, pattern: user?.pattern ?? e.defaults?.pattern }
    // 가벼운 꾸미기: 무늬 · 마감(벨벳 등)은 셰이더 종류를 늘려서 빼고 색만
    if (!opts.patterns) { delete ps.pattern; delete ps.finish }
    return ps
  }

  const colorOf = (t: Target, e: Entry, s: RoomStyle) => resolve(t, e, s).color ?? themeOf(s.theme).colors[e.slot]

  const restore = (t: Target) => {
    for (const a of t.addons) {
      a.removeFromParent()
      // 코드로 만든 덧붙이만 지오메트리·재질 해제 
      if ((a as THREE.Mesh).isMesh && a.name.startsWith('style_')) {
        (a as THREE.Mesh).geometry.dispose()
        ;ORIG.get(a as THREE.Mesh)?.dispose()
      }
    }
    t.addons = []
    t.entries = t.entries.filter((e) => !e.addon)
    for (const [o, v] of t.saved) { o.position.copy(v.p); o.scale.copy(v.s); o.visible = v.v }
  }

  /** 껍데기 색 입히기 (look 이 없으면 원래대로) */
  const applyShell = (look: ShellLook | undefined, floorOverride?: string, wallOverride?: string) => {
    if (!shell) return
    const targets: Record<'floor' | 'wood' | 'rim', string | undefined> = { floor: look ? floorOverride ?? look.floor : undefined, wood: look?.wood, rim: look?.wood }
    for (const k of ['floor', 'wood', 'rim'] as const) {
      const p = shell.parts[k]
      if (!p) continue
      const t = targets[k]
      if (!t) { for (const m of p.meshes) m.material = p.orig; continue }
      tintTo(p.mat.emissive, t, p.ref)
      for (const m of p.meshes) m.material = p.mat
    }
    const w = shell.wall
    if (!w) return
    if (!look) { w.mat.color.copy(w.base); return }
    // 원하는 화면 색 → 넣을 값. 단색 벽지(01)는 그 색, 타일 벽지는 타일 평균색을 그 색으로 옮기는 배율 (무늬의 밝고 어두운 차이는 그대로)
    wallColorFor(w.mat.color, wallOverride ?? look.wall, w.solid, w.avg)
  }

  const api = {
    /** 칠할 수 있는 가구 하나 등록 (glb 복제본의 노드). kind base 는 모양 옵션도 */
    register(id: string, label: string, root: THREE.Object3D, kind: StyleKind) {
      const t: Target = { id, label, kind, root, entries: [], saved: snapshotTree(root), addons: [], mats: new Map() }
      collect(t, root)
      root.userData.styleId = id
      targets.push(t)
    },
    /** 묶음(root)이 방에서 빠짐 (꾸미기 소품 탭에서 단어를 바꿔 자리가 달라짐) → 그 가구 재질을 버림 */
    unregister(root: THREE.Object3D) {
      const i = targets.findIndex((t) => t.root === root)
      if (i < 0) return
      const old = targets[i]; restore(old); for (const ms of old.mats.values()) ms.mat.dispose(); targets.splice(i, 1)
    },
    /** 같은 묶음(root) 안의 가구가 바뀜 (꾸미기 가구 탭에서 갈아 끼움) → 그 가구 재질을 버리고 다시 등록 */
    replace(root: THREE.Object3D, id: string, label: string, kind: StyleKind) {
      const i = targets.findIndex((t) => t.root === root)
      if (i >= 0) { const old = targets[i]; restore(old); for (const ms of old.mats.values()) ms.mat.dispose(); targets.splice(i, 1) }
      api.register(id, label, root, kind)
    },
    /**
     * 방 껍데기 (껍데기 glb 복제본 + 이 장면의 벽지 재질). wallAvg = 벽지 타일 평균색(단색 벽지면 그 색), wallSolid = 단색 벽지인지
     */
    registerShell(root: THREE.Object3D, wallMat: THREE.MeshBasicMaterial | null, wallAvg: string, wallSolid: boolean) {
      const groups: Record<'floor' | 'wood' | 'rim', THREE.Mesh[]> = { floor: [], wood: [], rim: [] }
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || Array.isArray(m.material)) return
        const nm = `${m.name} ${m.parent?.name ?? ''}`
        if (/room_floor/.test(nm)) groups.floor.push(m)
        else if (/room_rib_|room_wainscot/.test(nm)) groups.wood.push(m)
        else if ((m.material as THREE.Material).name === 'wall_outer') groups.rim.push(m)
      })
      const part = (meshes: THREE.Mesh[], ref: string): ShellPart | null => {
        if (!meshes.length) return null
        const orig = meshes[0].material as THREE.MeshStandardMaterial
        const mat = orig.clone(); mat.name = `${orig.name}_shell`
        return { meshes, orig, mat, ref }
      }
      shell = {
        // 기준 = 원래 껍데기가 화면에 보이는 색 (빈 방 사진에서 잼, docs/room-diversity-2-2026-11-18.md)
        parts: { floor: part(groups.floor, SHELL_REF.floor), wood: part(groups.wood, SHELL_REF.wood), rim: part(groups.rim, SHELL_REF.wood) },
        wall: wallMat ? { mat: wallMat, base: wallMat.color.clone(), avg: new THREE.Color(wallAvg), solid: wallSolid } : null,
      }
    },
    /** 러그 메시 (껍데기 복제본) */
    registerRug(mesh: THREE.Mesh) {
      const orig = mesh.material as THREE.MeshStandardMaterial
      // 다시 칠할 때 기준 밝기: 원래 러그 크림색(약 #F5DEAA)의 선형 밝기. 그 색을 고르면 원래 밝기 그대로, 진한 색은 그만큼 어둡게
      const lum = RUG_REF_LUM
      rug = { mesh, orig, mat: null, sig: '', u: { uPatColor: { value: new THREE.Color() }, uPatCells: { value: 11 }, uPatFrame: { value: new THREE.Matrix4() } }, color: { value: new THREE.Color() }, lum: { value: lum } }
    },
    apply(s: RoomStyle) {
      for (const t of targets) {
        restore(t)
        if (t.kind === 'base') SHAPERS[t.id]?.(t, s)
        t.root.updateMatrixWorld(true)
        const used = new Set<string>()
        for (const e of t.entries) {
          const ps = resolve(t, e, s)
          const key = e.part
          const sig = `${ps.finish ?? 'clay'}|${ps.pattern?.kind ?? 'none'}`
          let ms = t.mats.get(key)
          if (!ms || ms.sig !== sig || ms.mat.userData.from !== e.orig.uuid) {
            ms?.mat.dispose()
            ms = makeMat(e, ps); ms.mat.userData.from = e.orig.uuid
            t.mats.set(key, ms)
          }
          used.add(key)
          const c = new THREE.Color(colorOf(t, e, s))
          ms.mat.color.copy(c)
          if ((e.orig as THREE.MeshStandardMaterial).emissive?.getHex() && t.kind === 'lights') {
            ms.mat.emissive.copy(c).lerp(new THREE.Color(1, 1, 1), .25)
          }
          const pm = ms.mat as THREE.MeshPhysicalMaterial
          if (pm.sheen) pm.sheenColor.copy(c).lerp(new THREE.Color(1, 1, 1), .55)
          if (ms.u && ps.pattern) { ms.u.uPatColor.value.set(ps.pattern.color); ms.u.uPatCells.value = cellsOf(ps.pattern) }
          e.mesh.material = ms.mat
        }
        for (const [k, ms] of t.mats) if (!used.has(k)) { ms.mat.dispose(); t.mats.delete(k) }
      }
      if (rug) {
        const r = rug, want = s.rug
        const pat = opts.patterns && want?.pattern && want.pattern.kind !== 'none' ? want.pattern : null
        if (!want?.color && !want?.pattern) {
          r.mesh.material = r.orig
        } else if (!pat) {
          // 무늬 없는 러그 (2026-11-18): 구운 빛에 색 배율을 곱함 → 셰이더가 원래와 같아서 새로 컴파일할 것이 없음 (저사양 PC 첫 진입).
          // 원래 러그의 두 색(크림 가운데 · 초록 테두리)이 목표 색의 밝고 어두운 두 톤으로 남음
          r.tint ??= (r.orig as THREE.MeshStandardMaterial).clone()
          tintTo(r.tint.emissive, want.color ?? '#E9B98A', RUG_REF)
          r.mesh.material = r.tint
        } else {
          const sig = want.pattern?.kind ?? 'none'
          if (!r.mat || r.sig !== sig) {
            r.mat?.dispose()
            r.mat = (r.orig as THREE.MeshStandardMaterial).clone()
            injectPattern(r.mat, want.pattern?.kind ?? 'none', r.u, { color: r.color, lum: r.lum })
            r.sig = sig
          }
          r.color.value.set(want.color ?? '#E9B98A')
          r.u.uPatColor.value.set(want.pattern?.color ?? want.color ?? '#E9B98A')
          if (want.pattern) r.u.uPatCells.value = cellsOf(want.pattern) * .7
          r.mesh.material = r.mat
        }
      }
      if (shell) applyShell(themeOf(s.theme).shell, s.floor, s.wall)
      api.update()
    },
    /** 꾸미기를 모두 걷어 내고 디자이너 원래 모습으로 (재질·모양·러그·껍데기) */
    reset() {
      for (const t of targets) { restore(t); for (const e of t.entries) e.mesh.material = e.orig; t.root.updateMatrixWorld(true) }
      if (rug) rug.mesh.material = rug.orig
      applyShell(undefined)
    },
    /** 무늬 좌표(가구 기준) 갱신. 떨어지는 가구처럼 움직이는 동안 프레임마다 */
    update() {
      for (const t of targets) {
        for (const ms of t.mats.values()) {
          if (!ms.u) continue
          t.root.matrixWorld.decompose(frameTmp.p, frameTmp.q, frameTmp.s)
          ms.u.uPatFrame.value.compose(frameTmp.p, frameTmp.q, new THREE.Vector3(1, 1, 1)).invert()
        }
      }
    },
    info(s: RoomStyle): StyleTargetInfo[] {
      return targets.map((t) => {
        const seen = new Map<string, StyleTargetInfo['parts'][number]>()
        for (const e of t.entries) {
          if (seen.has(e.part)) continue
          seen.set(e.part, { key: e.part, slot: e.slot, name: ADDON_LABEL[e.part] ?? SLOT_NAME[e.slot], color: '#' + new THREE.Color(colorOf(t, e, s)).getHexString() })
        }
        return { id: t.id, label: t.label, kind: t.kind, parts: [...seen.values()] }
      })
    },
    /** 노드 → 등록한 가구 id */
    idOf(o: THREE.Object3D | null) {
      for (; o; o = o.parent) if (o.userData.styleId) return o.userData.styleId as string
      return null
    },
    rootOf: (id: string) => targets.find((t) => t.id === id)?.root ?? null,
    dispose() {
      for (const t of targets) { restore(t); for (const ms of t.mats.values()) ms.mat.dispose(); for (const e of t.entries) e.mesh.material = e.orig }
      if (rug) { rug.mesh.material = rug.orig; rug.mat?.dispose(); rug.tint?.dispose() }
      if (shell) {
        for (const p of Object.values(shell.parts)) if (p) { for (const m of p.meshes) m.material = p.orig; p.mat.dispose() }
        shell.wall?.mat.color.copy(shell.wall.base)
      }
      env?.dispose(); pmrem?.dispose()
    },
  }
  return api
}
export type Styler = ReturnType<typeof createStyler>
