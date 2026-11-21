/**
 * 디자이너 핸드오프에서 옮긴 JSON 무결성
 * - data/fieldLayout150.json: 3D 핸드오프 v3.11 (들판 108×72m, 구역 36×36 6칸, 구역마다 25자리 → 150자리, 흙 노드·작물 9종·카메라 3단계), app/scripts/build-field-layout.mjs 가 만듦
 * - data/furnitureCatalog.json · slots.json · interestCatalog.json: 3D 핸드오프 v3 ~ v3.6 (카테고리 가구 슬롯 고정, 선반 12칸, 반려동물 짝)
 * - data/wallpapers.json: v3.5.1 (mood_map)
 * 새 JSON 을 받아 바꿨을 때 앱이 조용히 깨지지 않게 (자리 빠짐·번호 중복·없는 가구 id·슬롯 없음)
 */
import { describe, expect, it } from 'vitest'
import layout from '../data/fieldLayout150.json'
import catalogRaw from '../data/furnitureCatalog.json'
import slotsRaw from '../data/slots.json'
import { INTEREST_CATS, INTEREST_SUBS } from '../data/interests'
import wallRaw from '../data/wallpapers.json'

interface Row { id: string; type: string; category: string | null; sub_interest?: string | null; glb: string | null; glb_compressed?: string; size_m: { w: number; d: number; h: number }; slot: { kind: string; name?: string | null } | null; status: string; sit_point: string | null }
interface Slot { name: string; kind: string; category: string | null; pos_three: number[]; ry_deg: number; max_m: { w: number; d: number; h: number }; drop: { mode: string } }
const CATALOG = catalogRaw as unknown as Row[]
const SLOTS = slotsRaw as unknown as Slot[]
/** 관심사는 2026-11-18 확정본(data/interestTags.ts + 3D 연결 data/interest3d.ts). 예전 interestCatalog.json 복사본은 지움 */
const CATS = INTEREST_CATS
const SUBS = INTEREST_SUBS
const slot = (name: string) => SLOTS.find((s) => s.name === name)

describe('fieldLayout150.json (3D 핸드오프 v3.11 들판)', () => {
  const [x0, x1] = [...layout.field.x_range].sort((a, b) => a - b)
  const [z0, z1] = [...layout.field.z_range].sort((a, b) => a - b)
  const within = (v: number, [a, b]: number[]) => v >= Math.min(a, b) && v <= Math.max(a, b)

  it('들판 108×72m, 구역 6칸(36×36)', () => {
    expect(layout.field.size).toEqual([108, 72])
    expect(x1 - x0).toBe(108)
    expect(z1 - z0).toBe(72)
    expect(layout.zones).toHaveLength(6)
    for (const z of layout.zones) {
      expect(Math.abs(z.bounds.x[1] - z.bounds.x[0]), z.name).toBe(layout.field.zone_size[0])
      expect(Math.abs(z.bounds.z[1] - z.bounds.z[0]), z.name).toBe(layout.field.zone_size[1])
    }
  })
  it('구역 번호 1~6, 구역 k 의 자리 = 25(k−1)+1 ~ 25k (켜는 순서 = 번호 순서)', () => {
    layout.zones.forEach((z, i) => {
      expect(z.zone).toBe(i + 1)
      expect(z.seats).toEqual([25 * i + 1, 25 * (i + 1)])
    })
  })
  it('자리 150개, 번호 1~150 이 하나씩 (빠짐·중복 없음)', () => {
    const seats = layout.zones.flatMap((z) => z.holes.map((h) => h[0]))
    expect(seats).toHaveLength(150)
    expect([...seats].sort((a, b) => a - b)).toEqual(Array.from({ length: 150 }, (_, i) => i + 1))
  })
  it('구멍은 자기 구역의 번호 범위 · 경계 안, 들판 안', () => {
    for (const z of layout.zones) {
      expect(z.holes).toHaveLength(25)
      for (const [seat, x, zz] of z.holes) {
        expect(seat, `${z.name} #${seat}`).toBeGreaterThanOrEqual(z.seats[0])
        expect(seat, `${z.name} #${seat}`).toBeLessThanOrEqual(z.seats[1])
        expect(within(x, z.bounds.x), `${z.name} #${seat} x=${x}`).toBe(true)
        expect(within(zz, z.bounds.z), `${z.name} #${seat} z=${zz}`).toBe(true)
        expect(within(x, [x0, x1]) && within(zz, [z0, z1])).toBe(true)
      }
    }
  })
  it('같은 자리에 구멍 두 개가 겹치지 않음 (구멍 중심 사이 2m 이상)', () => {
    const all = layout.zones.flatMap((z) => z.holes)
    let min = Infinity
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) min = Math.min(min, Math.hypot(all[i][1] - all[j][1], all[i][2] - all[j][2]))
    expect(min).toBeGreaterThanOrEqual(2)
  })
  it('구역끼리 겹치지 않고 들판을 빈틈없이 덮음', () => {
    const area = layout.zones.reduce((n, z) => n + Math.abs(z.bounds.x[1] - z.bounds.x[0]) * Math.abs(z.bounds.z[1] - z.bounds.z[0]), 0)
    expect(area).toBe(108 * 72)
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const a = layout.zones[i].bounds, b = layout.zones[j].bounds
      const ox = Math.min(Math.max(...a.x), Math.max(...b.x)) - Math.max(Math.min(...a.x), Math.min(...b.x))
      const oz = Math.min(Math.max(...a.z), Math.max(...b.z)) - Math.max(Math.min(...a.z), Math.min(...b.z))
      expect(ox > 0 && oz > 0, `${a} ${b}`).toBe(false)
    }
  })
  it('카메라 목표 사각형(camRect)은 구역 경계 안', () => {
    for (const z of layout.zones) {
      for (const v of z.camRect.x) expect(within(v, z.bounds.x), z.name).toBe(true)
      for (const v of z.camRect.z) expect(within(v, z.bounds.z), z.name).toBe(true)
    }
  })
  it('링 색 번호·노드 번호가 표 안을 가리킴', () => {
    const nodeOk = (t: number[]) => Number.isInteger(t[0]) && t[0] >= 0 && t[0] < layout.nodes.length
    for (const z of layout.zones) {
      for (const h of z.holes) expect(h[5] >= 0 && h[5] < layout.rings.length, `${z.name} #${h[0]}`).toBe(true)
      for (const t of [...z.tufts, ...z.crops, ...z.flowers]) expect(nodeOk(t), z.name).toBe(true)
      for (const p of [...z.paths, ...z.linkAdd, ...z.linkReplace]) expect(nodeOk(p.t), z.name).toBe(true)
    }
    for (const th of layout.themes) for (const zs of th.crops ?? []) for (const t of zs) expect(nodeOk(t), th.id).toBe(true)
    for (const t of [layout.ladder, ...layout.fence]) expect(nodeOk(t)).toBe(true)
    for (const c of [...layout.rings, layout.mineRing]) expect(c).toMatch(/^#[0-9A-F]{6}$/i)
  })
  // v3.10 (2026-11-18): 잔디 바닥 + 흙 노드, 작물 5종, 카메라 3단계 (docs/explore-field-v3-10.md)
  it('v3.10 잔디 덩어리 없음, 작은 풀은 grass_tuft_small.glb', () => {
    expect(layout.nodes.some((n) => n.startsWith('grass_patch'))).toBe(false)
    expect(layout.nodes).toContain('grass_tuft_small:grass_tuft_small')
    expect(layout.zones.every((z) => !('grass' in z))).toBe(true)
  })
  it('흙 노드: 구역마다 안쪽 흙 하나, 경계 흙은 맞닿은 두 구역 (이웃 7곳)', () => {
    expect(Object.keys(layout.soil.byZone).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    for (const [k, n] of Object.entries(layout.soil.byZone)) expect(n).toBe(`soil_zone${k}`)
    expect(layout.soil.links).toHaveLength(7)
    const touch = (a: number, b: number) => {
      const A = layout.zones[a - 1].bounds, Bb = layout.zones[b - 1].bounds
      const ox = Math.min(Math.max(...A.x), Math.max(...Bb.x)) - Math.max(Math.min(...A.x), Math.min(...Bb.x))
      const oz = Math.min(Math.max(...A.z), Math.max(...Bb.z)) - Math.max(Math.min(...A.z), Math.min(...Bb.z))
      return (ox === 0 && oz > 0) || (oz === 0 && ox > 0) // 한 변을 맞댐
    }
    for (const l of layout.soil.links) {
      expect(l.node).toBe(`soil_link_${l.zones[0]}_${l.zones[1]}`)
      expect(touch(l.zones[0], l.zones[1]), l.node).toBe(true)
    }
  })
  it('작물 테마 9종: 호박은 기본 슬롯(null), 나머지는 구역마다 기본 슬롯과 같은 수의 전용 슬롯, 그 작물 노드만', () => {
    expect(layout.themes.map((t) => t.id)).toEqual(['pumpkin', 'apple', 'strawberry', 'sweetpotato', 'carrot', 'corn', 'tomato', 'sunflower', 'bread'])
    for (const th of layout.themes) {
      expect(th.nodes, th.id).toHaveLength(3)
      if (th.id === 'pumpkin') { expect(th.crops).toBeNull(); continue }
      expect(th.crops, th.id).toHaveLength(6)
      th.crops!.forEach((zs, i) => {
        expect(zs.length, `${th.id} 구역 ${i + 1}`).toBe(layout.zones[i].crops.length)
        for (const t of zs) expect(th.nodes.map((n) => `${th.glb}:${n}`)).toContain(layout.nodes[t[0]])
      })
    }
  })
  it('작물 glb: 테마마다 앱 모델 폴더에 파일이 있음 (build-field-layout.mjs 가 복사), v3.11 딸기는 v3 · 옛 v2 는 없음', () => {
    // import.meta.glob 은 파일 이름만 모으고 불러오지는 않음 (프로젝트에 node 타입이 없어서 fs 대신)
    const files = Object.keys(import.meta.glob('../assets/models/field/*.glb')).map((f) => f.split('/').pop())
    for (const th of layout.themes) expect(files, th.glb).toContain(`${th.glb}.glb`)
    expect(layout.themes.find((t) => t.id === 'strawberry')!.glb).toBe('strawberry_patch_v3')
    expect(files).not.toContain('strawberry_patch_v2.glb')
  })
  it('카메라 3단계: 거리 12 / 24 / 46, 각도 45°·FOV 32.3° 같음, v3.11 은 far 도 구멍 중앙 정렬 허용 + 단계마다 안전 한계', () => {
    const L = layout.camera.levels
    expect([L.near.distance, L.mid.distance, L.far.distance]).toEqual([12, 24, 46])
    for (const v of [L.near, L.mid, L.far]) { expect(v.tilt).toBe(45); expect(v.fov).toBe(32.3) }
    expect([L.near.centering, L.mid.centering, L.far.centering]).toEqual([true, true, true])
    expect(L.near.safe).toEqual({ x: [-79.3, 79.3], y: [-30.2, 99.1] })
    expect(L.mid.safe).toEqual({ x: [-70.6, 70.6], y: [-26.4, 92.2] })
    expect(L.far.safe).toEqual({ x: [-54.7, 54.7], y: [-19.4, 79.5] })
  })
})

describe('관심사 3D 연결 · furnitureCatalog · slots (3D 핸드오프 v3, 관심사는 2026-11-18 확정본)', () => {
  it('id 는 하나씩 (가구 행 · 슬롯 · 관심사)', () => {
    expect(new Set(CATALOG.map((r) => r.id)).size).toBe(CATALOG.length)
    expect(new Set(SLOTS.map((s) => s.name)).size).toBe(SLOTS.length)
    expect(new Set([...CATS, ...SUBS].map((r) => r.id)).size).toBe(CATS.length + SUBS.length)
  })
  it('v3.8.1: 카탈로그에는 기본 가구(고정 장식 5개 포함) · 장식 · 우체통만 있고(관심사 모델은 interest_words_v3_8.json), 침대 · 협탁은 없음', () => {
    for (const r of CATALOG) expect(['base', 'deco', 'prop'], r.id).toContain(r.type)
    expect(CATALOG.filter((r) => r.type === 'base').map((r) => r.id).sort()).toEqual(['cabinet_low', 'ceiling_lamp', 'cushion_sky', 'cushion_yellow', 'floor_lamp', 'floor_plant_big', 'round_table', 'rug_front_oval', 'rug_right_small'])
    for (const r of CATALOG.filter((r) => r.type === 'base')) expect(r.glb_compressed, r.id).toBe('room_base_v3_1_draco_webp.glb')
  })
  it('대분류 12개 최대 10개, 3D 세트(kit)는 벽지 · 블록 색용으로 남음', () => {
    for (const c of CATS) { expect(c.max_pick, c.id).toBe(10); expect(c.kit, c.id).toBeTruthy(); expect(c.furniture, c.id).toEqual([]) }
    for (const s of SUBS) { expect(s.prop, s.id).toBeNull(); expect(s.slot_kind, s.id).toBeNull() }
  })
  it('슬롯 54개 v3.8.1: 바닥 공용 20 · 벽 공용 4 · 선반 12 · 동물 5 + 용품 5 · 앞 구석 2 · 우체통 1 · 작은 소품 바닥 3 + 원탁 위 2', () => {
    expect(SLOTS).toHaveLength(54)
    expect(SLOTS.filter((s) => s.kind === 'shelf')).toHaveLength(12)
    expect(SLOTS.filter((s) => s.kind === 'floor_prop')).toHaveLength(3)
    expect(SLOTS.filter((s) => s.kind === 'table_top')).toHaveLength(2)
    expect(SLOTS.filter((s) => s.kind === 'pet_floor')).toHaveLength(10)
    expect(SLOTS.filter((s) => s.name === 'mailbox_slot')).toHaveLength(1)
  })
  it('행이 가리키는 슬롯 이름은 모두 slots.json 에 있음', () => {
    for (const r of CATALOG) if (r.slot?.name) expect(slot(r.slot.name), `${r.id} → ${r.slot.name}`).toBeDefined()
  })
  it('built 인 행은 glb 파일 이름이 있음 (없으면 방에 안 보임)', () => {
    for (const r of CATALOG.filter((x) => x.status === 'built')) expect(r.glb_compressed ?? r.glb, r.id).toBeTruthy()
  })
  it('슬롯: 좌표 3개 · 낙하 방식이 정해진 값', () => {
    for (const s of SLOTS) {
      expect(s.pos_three, s.name).toHaveLength(3)
      // v3.8: 바닥 공용 자리는 drop.mode 대신 키 단계별 drop_by_height 줄을 씀
      const rows = (s as unknown as { drop_by_height?: { mode: string }[] }).drop_by_height
      if (rows) expect(rows.every((r) => ['fall', 'pop'].includes(r.mode)), s.name).toBe(true)
      else expect(['fall', 'pop', 'none'], s.name).toContain(s.drop.mode)
    }
  })
  it('행 type 은 앱이 아는 값 (roomPlan.ts FurnitureRow)', () => {
    // 'prop' 은 우체통(mailbox) 한 줄 — roomPlan.ts 의 타입 목록에는 없음 (three/mailbox.ts 가 따로 씀)
    const known = ['base', 'deco', 'category_furniture', 'sub_prop', 'pet', 'deco_attached', 'unused', 'prop']
    for (const r of CATALOG) expect(known, r.id).toContain(r.type)
  })
})

describe('wallpapers.json (v3.5.1)', () => {
  const w = wallRaw as unknown as { wallpapers: { id: string }[]; mood_map: { by_category_id: Record<string, string>; default: string } }
  it('mood_map 이 가리키는 벽지가 모두 있음, 기본 벽지도 있음', () => {
    const ids = w.wallpapers.map((x) => x.id)
    for (const v of Object.values(w.mood_map.by_category_id)) expect(ids).toContain(v)
    expect(ids).toContain(w.mood_map.default)
  })
  it('mood_map 의 카테고리 키는 3D 세트 id (관심사 대분류가 쓰는 kit, 차·커피만 "tea" 로 적혀 있어 앱이 따로 받음)', () => {
    const kits = CATS.map((c) => c.kit)
    for (const k of Object.keys(w.mood_map.by_category_id)) expect([...kits, 'tea'], k).toContain(k)
  })
})

describe('room_base_v3_1 (3D 핸드오프 v3.8.1): 고정 장식 5개', () => {
  const FIXED = ['cabinet_low', 'floor_lamp', 'floor_plant_big', 'rug_front_oval', 'rug_right_small']
  const FS = 'node:fs'
  it('고정 장식 5개가 base 행으로 있고 glb 노드 이름과 같음', () => {
    for (const id of FIXED) {
      const r = CATALOG.find((x) => x.id === id)
      expect(r, id).toBeDefined()
      expect(r!.type, id).toBe('base'); expect((r as unknown as { node: string }).node, id).toBe(id); expect(r!.status, id).toBe('built')
      expect(r!.glb_compressed, id).toBe('room_base_v3_1_draco_webp.glb')
    }
  })
  it('glb 파일 안에 5개 노드(fixed)와 조명 갓의 KHR_materials_emissive_strength 가 있고 옛 room_base_v3 파일은 없음', async () => {
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string): Uint8Array; existsSync(p: string): boolean }
    const buf = fs.readFileSync('src/assets/models/room/room_base_v3_1_draco_webp.glb')
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + dv.getUint32(12, true)))) as {
      nodes: { name: string; extras?: { fixed?: boolean } }[]; scenes: { nodes: number[] }[]
      materials: { name: string; extensions?: Record<string, { emissiveStrength?: number }> }[]; extensionsUsed: string[]
    }
    const roots = json.scenes[0].nodes.map((i) => json.nodes[i])
    for (const id of FIXED) expect(roots.find((n) => n.name === id)?.extras?.fixed, id).toBe(true)
    expect(json.extensionsUsed).toContain('KHR_materials_emissive_strength')
    expect(json.materials.find((m) => m.name === 'M_lamp_shade')?.extensions?.KHR_materials_emissive_strength?.emissiveStrength).toBeGreaterThan(1)
    expect(fs.existsSync('src/assets/models/room/room_base_v3_draco_webp.glb')).toBe(false)
  })
})
