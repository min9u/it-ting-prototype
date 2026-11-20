// 탐색 들판 배치·모델을 앱용으로 만든다 (3D 핸드오프 v3.11 — 작물 9종·딸기 v3·카메라 v1.2. v3.10 은 2026-11-18 docs/explore-field-v3-10.md)
// 실행: node app/scripts/build-field-layout.mjs  (저장소 루트에서)
//
// 1) 배치: design/digul_3d_handoff_v3_11/layout/explore_field_layout_150_v3_11.json (약 1MB) 에서 앱이 쓰는 값만 → app/src/data/fieldLayout150.json
//    항목 하나 = [노드 번호, x, y, z, ry, sx, sy, sz] (three.js 좌표, 절대 위치. 숫자는 소수 4자리)
//    구멍 = [자리 번호, x, z, ry, s, 링 색 번호]  (y=0, scale 은 x=z 균일·y=1)
//    v3.10: 잔디 덩어리 없음(grass 빠짐), 흙 노드 규칙(soil), 작물 테마(themes: 호박은 구역 기본 슬롯, 나머지는 작물 전용 슬롯), 카메라 3단계(camera.levels)
//    v3.11: 작물 테마 9종, 카메라 타깃은 모든 단계에서 구멍을 따라감(안전 한계 camera.levels.*.safe 만, 옛 한계·far 맞춤 고정은 없어짐)
// 2) 모델: app/src/assets/models/field/ 에 복사. 바닥(explore_ground_150_v3.glb, 1.5MB)은 흙 노드 13개만 양자화(KHR_mesh_quantization)해서 줄임
//    흙은 평평하고(높이 하나, 법선 모두 위) 정점 색만 있어서: 위치 float32×3 → uint16×3(+노드 배율), 법선 float32×3 → int8×3, 색 uint16×4 → uint8×4.
//    잔디 바닥(field_slab)·바깥 잔디는 그대로. three.js GLTFLoader 기본 지원 (땅굴 모델도 같은 방식, docs/3d-handoff-v2-integration.md)
import fs from 'fs'
import path from 'path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..')
const HAND = path.join(root, 'design/digul_3d_handoff_v3_11')
const src = path.join(HAND, 'layout/explore_field_layout_150_v3_11.json')
const out = path.join(root, 'app/src/data/fieldLayout150.json')
const modelsOut = path.join(root, 'app/src/assets/models/field')
const j = JSON.parse(fs.readFileSync(src, 'utf8'))

const r = (v) => Math.round(v * 1e4) / 1e4
const nodes = []
const nodeId = (glb, node) => {
  const k = `${glb.replace('.glb', '')}:${node}`
  let i = nodes.indexOf(k)
  if (i < 0) { i = nodes.length; nodes.push(k) }
  return i
}
const item = (it) => [nodeId(it.glb, it.node), r(it.position[0]), r(it.position[1]), r(it.position[2]), r(it.ry), ...it.scale.map(r)]
const rings = []
const ringId = (hex) => { let i = rings.indexOf(hex); if (i < 0) { i = rings.length; rings.push(hex) } return i }

const tile = (it) => ({ cell: it.cell.join(','), t: item(it) })

const zones = j.zones.map((z) => {
  if (z.holes.some((h) => h.scale[0] !== h.scale[2] || h.scale[1] !== 1 || h.position[1] !== 0)) throw new Error('구멍 scale/높이 가정이 틀림')
  if (z.grass.length) throw new Error('v3.10 이후는 잔디 덩어리가 없어야 함')
  return {
    zone: z.zone,
    name: z.name,
    seats: z.seat_range,
    bounds: { x: z.bounds_blender.x, z: z.bounds_blender.y.map((y) => -y) },
    camRect: { x: z.camera_target_rect_blender.x, z: z.camera_target_rect_blender.y.map((y) => -y) },
    holes: z.holes.map((h) => [h.seat, r(h.position[0]), r(h.position[2]), r(h.ry), r(h.scale[0]), ringId(h.ring_hex)]),
    paths: z.path_tiles.map(tile),
    linkAdd: z.links.add.map(tile),
    linkReplace: z.links.replace.map(tile),
    // 구역 안에 흩뿌린 것: 풀 뭉치(grass_tuft_small.glb)·작물 기본 슬롯(호박)·꽃
    tufts: z.grass_tufts.map(item),
    crops: z.pumpkins.map(item),
    flowers: z.flowers.map(item),
  }
})

// 흙 노드 규칙 (common.ground.soil_rule): soil_zoneN = 구역 N 이 켜질 때, soil_link_N_M = N·M 둘 다 켜졌을 때
const g = j.common.ground
const soil = {
  byZone: Object.fromEntries(Object.entries(g.soil_by_zone).map(([k, v]) => [k, v])),
  links: Object.values(g.soil_links).map((l) => ({ node: l.node, zones: l.zones })),
  always: g.always_on,
}

// 작물 테마 9종 (v3.11): 호박(slots = null)은 구역 기본 슬롯(zones[k].crops) 그대로, 나머지는 작물 전용 슬롯 (구역마다 나눠 둠)
const themes = j.themes.map((t) => {
  const glb = t.crop_glb.replace('.glb', '')
  let crops = null
  if (t.slots) {
    crops = j.zones.map(() => [])
    for (const s of t.slots) {
      if (s.unresolved) throw new Error(`${t.id} 슬롯 unresolved`)
      crops[s.zone - 1].push(item(s))
    }
  } else {
    // 호박: 기본 슬롯의 노드가 slot_map 과 같은지 확인
    for (const [a, b] of Object.entries(t.slot_map)) if (a !== b) throw new Error('호박 slot_map 이 바뀜')
  }
  return { id: t.id, glb, nodes: t.crop_nodes, grass: t.grass_color, soil: t.soil_color, crops }
})

const lv = j.camera.levels
// v3.11: 타깃 한계는 camera.levels.*.target_limit_safe_outer_grass 하나뿐 (옛 한계 키는 JSON 에 없음). x, y 는 Blender 좌표 (three z = −y)
const level = (k) => {
  const sf = lv[k].target_limit_safe_outer_grass
  if (!sf) throw new Error(`camera.levels.${k}.target_limit_safe_outer_grass 가 없음 (v3.11 이 아님?)`)
  return {
    distance: lv[k].distance, tilt: lv[k].tilt_deg, fov: lv[k].fov_v_deg,
    toNear: lv[k].target_to_near_edge, toFar: lv[k].target_to_far_edge, halfFar: lv[k].half_width_far_edge,
    lod: lv[k].lod, centering: lv[k].hole_centering_allowed,
    safe: { x: sf.x, y: sf.y },
  }
}
// far 활성 구역 1개 규칙의 숫자(구역 남쪽 + 11.1, 구멍 따라가기 ±9)는 문장으로만 들어 있어서 three/fieldCam.ts 에 상수로 두고, 여기서 문장이 그대로인지 확인
const szr = lv.far.single_zone_rule?.target ?? ''
if (!/Zy0 \+ 11\.1/.test(szr) || !/±9/.test(szr)) throw new Error(`far single_zone_rule 문장이 바뀜: ${szr}`)

const data = {
  source: 'design/digul_3d_handoff_v3_11/layout/explore_field_layout_150_v3_11.json (v3.11, 150 seats, 6 zones, grass floor + soil nodes + 9 crop themes + 3 camera levels, hole-following camera)',
  field: j.field,
  mineRing: j.mine_ring_hex,
  rings,
  camera: {
    levels: { near: level('near'), mid: level('mid'), far: level('far') },
  },
  soil,
  themes,
  nodes,
  ladder: item(j.common.ladder[0]),
  fence: j.common.fence.map(item),
  zones,
}
fs.writeFileSync(out, JSON.stringify(data))
const kb = (fs.statSync(out).size / 1024).toFixed(0)
console.log(`${out} ${kb}KB, 노드 ${nodes.length}개, 링 색 ${rings.length}개, 테마 ${themes.map((t) => t.id).join('·')}`)

/* ---------- 모델 ---------- */
const COPY = ['hole_v2', 'hole_mine_halo', 'empty_pad', 'path_kit', 'ladder_shaft', 'fence', 'flowers', 'grass_tuft_small',
  'vine_patch', 'apple_patch', 'strawberry_patch_v3', 'sweetpotato_patch', 'carrot_patch_v2',
  'corn_patch', 'tomato_patch', 'sunflower_patch', 'bread_patch_v2']
fs.mkdirSync(modelsOut, { recursive: true })
for (const n of COPY) fs.copyFileSync(path.join(HAND, 'models', `${n}.glb`), path.join(modelsOut, `${n}.glb`))
// 예전 버전에만 있던 파일 정리 (v3.9: grass_patch · 첫 바닥, v3.10: 딸기 v2)
for (const n of ['grass_patch', 'explore_ground_150', 'strawberry_patch_v2']) { const p = path.join(modelsOut, `${n}.glb`); if (fs.existsSync(p)) fs.unlinkSync(p) }

const groundIn = path.join(HAND, 'models/explore_ground_150_v3.glb')
const groundOut = path.join(modelsOut, 'explore_ground_150_v3.glb')
quantizeGround(groundIn, groundOut, (n) => n.startsWith('soil_'))
console.log(`${groundOut} ${(fs.statSync(groundIn).size / 1024).toFixed(0)}KB → ${(fs.statSync(groundOut).size / 1024).toFixed(0)}KB, 모델 ${COPY.length}개 복사`)

/** glb 의 이름이 pick 에 맞는 노드(평평한 흙)만 양자화. 나머지 노드·재질은 그대로 */
function quantizeGround(file, dest, pick) {
  const b = fs.readFileSync(file)
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('glb 아님')
  const jl = b.readUInt32LE(12)
  const J = JSON.parse(b.slice(20, 20 + jl).toString('utf8'))
  const bl = b.readUInt32LE(20 + jl)
  const BIN = b.slice(20 + jl + 8, 20 + jl + 8 + bl)
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
  const SZ = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
  /** 접근자 값 (정규화된 정수는 0~1·-1~1 로) */
  const read = (ai) => {
    const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], n = NC[a.type], cs = SZ[a.componentType]
    const stride = bv.byteStride || cs * n, off = (bv.byteOffset || 0) + (a.byteOffset || 0)
    const v = new Float64Array(a.count * n)
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) {
      const p = off + i * stride + c * cs
      let x
      switch (a.componentType) {
        case 5126: x = BIN.readFloatLE(p); break
        case 5123: x = BIN.readUInt16LE(p); if (a.normalized) x /= 65535; break
        case 5121: x = BIN.readUInt8(p); if (a.normalized) x /= 255; break
        case 5125: x = BIN.readUInt32LE(p); break
        case 5122: x = BIN.readInt16LE(p); if (a.normalized) x = Math.max(-1, x / 32767); break
        case 5120: x = BIN.readInt8(p); if (a.normalized) x = Math.max(-1, x / 127); break
      }
      v[i * n + c] = x
    }
    return { a, n, v }
  }
  /** 원래 바이트 그대로 (빽빽하게) */
  const raw = (ai) => {
    const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], n = NC[a.type], cs = SZ[a.componentType]
    const stride = bv.byteStride || cs * n, off = (bv.byteOffset || 0) + (a.byteOffset || 0)
    if (stride === cs * n) return Buffer.from(BIN.slice(off, off + a.count * stride))
    const o = Buffer.alloc(a.count * cs * n)
    for (let i = 0; i < a.count; i++) BIN.copy(o, i * cs * n, off + i * stride, off + i * stride + cs * n)
    return o
  }
  const chunks = [], views = [], accs = []
  let len = 0
  const addView = (buf, target, stride) => {
    const pad = (4 - (len % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); len += pad }
    views.push({ buffer: 0, byteOffset: len, byteLength: buf.length, ...(target ? { target } : {}), ...(stride ? { byteStride: stride } : {}) })
    chunks.push(buf); len += buf.length
    return views.length - 1
  }
  const addAcc = (o) => { accs.push(o); return accs.length - 1 }
  const copyAcc = (ai, target) => {
    const a = J.accessors[ai]
    const bv = addView(raw(ai), target)
    const { bufferView: _bv, byteOffset: _bo, ...rest } = a
    return addAcc({ ...rest, bufferView: bv })
  }
  const meshNode = new Map()
  J.nodes.forEach((n, i) => { if (n.mesh != null) meshNode.set(n.mesh, i) })
  for (const [mi, m] of J.meshes.entries()) {
    const ni = meshNode.get(mi)
    const node = J.nodes[ni]
    const q = pick(node.name)
    if (q && (node.translation || node.rotation || node.scale || node.matrix)) throw new Error(`${node.name}: 노드에 이미 변환이 있음`)
    for (const p of m.primitives) {
      const attrs = {}
      if (!q) {
        for (const [k, ai] of Object.entries(p.attributes)) attrs[k] = copyAcc(ai, 34962)
        if (p.indices != null) p.indices = copyAcc(p.indices, 34963)
        p.attributes = attrs
        continue
      }
      // 위치: uint16 (노드 배율·위치로 되돌림). 세 축 같은 배율이라 경계 구가 정확하고 법선도 그대로
      const pos = read(p.attributes.POSITION)
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < pos.a.count; i++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos.v[i * 3 + c]); mx[c] = Math.max(mx[c], pos.v[i * 3 + c]) }
      const s = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 65535 || 1
      const pb = Buffer.alloc(pos.a.count * 8)
      const qmn = [65535, 65535, 65535], qmx = [0, 0, 0]
      for (let i = 0; i < pos.a.count; i++) for (let c = 0; c < 3; c++) {
        const qv = Math.round((pos.v[i * 3 + c] - mn[c]) / s)
        pb.writeUInt16LE(qv, i * 8 + c * 2)
        qmn[c] = Math.min(qmn[c], qv); qmx[c] = Math.max(qmx[c], qv)
      }
      attrs.POSITION = addAcc({ bufferView: addView(pb, 34962, 8), componentType: 5123, count: pos.a.count, type: 'VEC3', min: qmn, max: qmx })
      node.translation = mn.map((v) => +v.toFixed(6))
      node.scale = [s, s, s]
      if (p.attributes.NORMAL != null) {
        const nor = read(p.attributes.NORMAL)
        const nb = Buffer.alloc(nor.a.count * 4)
        for (let i = 0; i < nor.a.count; i++) {
          const x = nor.v[i * 3], y = nor.v[i * 3 + 1], z = nor.v[i * 3 + 2], l = Math.hypot(x, y, z) || 1
          nb.writeInt8(Math.round(x / l * 127), i * 4); nb.writeInt8(Math.round(y / l * 127), i * 4 + 1); nb.writeInt8(Math.round(z / l * 127), i * 4 + 2)
        }
        attrs.NORMAL = addAcc({ bufferView: addView(nb, 34962, 4), componentType: 5120, normalized: true, count: nor.a.count, type: 'VEC3' })
      }
      if (p.attributes.COLOR_0 != null) {
        const col = read(p.attributes.COLOR_0)
        const cb = Buffer.alloc(col.a.count * 4)
        for (let i = 0; i < col.a.count; i++) for (let c = 0; c < 4; c++) cb.writeUInt8(Math.round(Math.min(1, Math.max(0, c < col.n ? col.v[i * col.n + c] : 1)) * 255), i * 4 + c)
        attrs.COLOR_0 = addAcc({ bufferView: addView(cb, 34962), componentType: 5121, normalized: true, count: col.a.count, type: 'VEC4' })
      }
      for (const k of Object.keys(p.attributes)) if (!attrs[k]) throw new Error(`${node.name}: 처리 못 한 속성 ${k}`)
      if (p.indices != null) p.indices = copyAcc(p.indices, 34963)
      p.attributes = attrs
    }
  }
  J.accessors = accs
  J.bufferViews = views
  const bin = Buffer.concat([...chunks, Buffer.alloc((4 - (len % 4)) % 4)])
  J.buffers = [{ byteLength: bin.length }]
  J.extensionsUsed = [...new Set([...(J.extensionsUsed ?? []), 'KHR_mesh_quantization'])]
  J.extensionsRequired = [...new Set([...(J.extensionsRequired ?? []), 'KHR_mesh_quantization'])]
  let js = Buffer.from(JSON.stringify(J), 'utf8')
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)])
  const head = Buffer.alloc(12)
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8)
  const ch = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h }
  fs.writeFileSync(dest, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]))
}
