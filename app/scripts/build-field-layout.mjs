// 탐색 들판 배치(3D 핸드오프 v3.9 explore_field_layout_150.json, 약 800KB)에서 앱이 쓰는 값만 뽑아 줄인 JSON을 만든다.
// 실행: node app/scripts/build-field-layout.mjs  (저장소 루트에서)
// 결과: app/src/data/fieldLayout150.json
//
// 항목 하나 = [노드 번호, x, y, z, ry, sx, sy, sz] (three.js 좌표, 절대 위치. 숫자는 소수 4자리)
// 구멍 = [자리 번호, x, z, ry, s, 링 색 번호]  (y=0, scale 은 x=z 균일·y=1)
import fs from 'fs'
import path from 'path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..')
const src = path.join(root, 'design/digul_3d_handoff_v3_9/layout/explore_field_layout_150.json')
const out = path.join(root, 'app/src/data/fieldLayout150.json')
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
    // 구역 안에 흩뿌린 것: 잔디·풀 뭉치·작물 슬롯·꽃
    grass: z.grass.map(item),
    tufts: z.grass_tufts.map(item),
    crops: z.pumpkins.map(item),
    flowers: z.flowers.map(item),
  }
})

const data = {
  source: 'design/digul_3d_handoff_v3_9/layout/explore_field_layout_150.json (v3.9, 150 seats, 6 zones)',
  field: j.field,
  theme: j.theme,
  mineRing: j.mine_ring_hex,
  rings,
  camera: { oneScreen: j.camera.one_screen, overflow: j.camera.overflow_when_centering_hole },
  nodes,
  ladder: item(j.common.ladder[0]),
  fence: j.common.fence.map(item),
  zones,
}
fs.writeFileSync(out, JSON.stringify(data))
const kb = (fs.statSync(out).size / 1024).toFixed(0)
console.log(`${out} ${kb}KB, 노드 ${nodes.length}개, 링 색 ${rings.length}개`)
