/**
 * 디자이너 핸드오프에서 옮긴 JSON 무결성
 * - data/fieldLayout150.json: 3D 핸드오프 v3.9 (들판 108×72m, 구역 36×36 6칸, 구역마다 25자리 → 150자리), app/scripts/build-field-layout.mjs 가 만듦
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
const row = (id: string) => CATALOG.find((r) => r.id === id)
const slot = (name: string) => SLOTS.find((s) => s.name === name)
/** 가구 크기 허용 오차 1cm (디자이너 값에 1~2mm 넘치는 것이 있음: reading_lamp 0.301 > 0.3, yoga_mat 0.302 > 0.3) */
const TOL = 0.01
const fits = (a: Row['size_m'], b: Slot['max_m']) => a.w <= b.w + TOL && a.d <= b.d + TOL && a.h <= b.h + TOL

describe('fieldLayout150.json (3D 핸드오프 v3.9 들판)', () => {
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
      for (const t of [...z.grass, ...z.tufts, ...z.crops, ...z.flowers]) expect(nodeOk(t), z.name).toBe(true)
      for (const p of [...z.paths, ...z.linkAdd, ...z.linkReplace]) expect(nodeOk(p.t), z.name).toBe(true)
    }
    for (const t of [layout.ladder, ...layout.fence]) expect(nodeOk(t)).toBe(true)
    for (const c of [...layout.rings, layout.mineRing]) expect(c).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

describe('관심사 3D 연결 · furnitureCatalog · slots (3D 핸드오프 v3, 관심사는 2026-11-18 확정본)', () => {
  it('id 는 하나씩 (가구 행 · 슬롯 · 관심사)', () => {
    expect(new Set(CATALOG.map((r) => r.id)).size).toBe(CATALOG.length)
    expect(new Set(SLOTS.map((s) => s.name)).size).toBe(SLOTS.length)
    expect(new Set([...CATS, ...SUBS].map((r) => r.id)).size).toBe(CATS.length + SUBS.length)
  })
  it('대분류 가구: 가구 수 = 슬롯 수, 가구 행·슬롯이 있고 같은 3D 세트, 슬롯 크기 안', () => {
    for (const c of CATS) {
      expect(c.furniture.length, c.id).toBe(c.furniture_slots.length)
      expect(c.max_pick, c.id).toBe(10)
      c.furniture.forEach((fid, i) => {
        const r = row(fid), s = slot(c.furniture_slots[i])
        expect(r, fid).toBeDefined()
        expect(s, c.furniture_slots[i]).toBeDefined()
        expect(r!.type, fid).toBe('category_furniture')
        expect(r!.category, fid).toBe(c.kit)
        expect(s!.category, s!.name).toBe(c.kit)
        expect(fits(r!.size_m, s!.max_m), `${fid} ${JSON.stringify(r!.size_m)} > ${s!.name} ${JSON.stringify(s!.max_m)}`).toBe(true)
      })
    }
  })
  it('대분류 가구 슬롯이 겹치는 건 같은 3D 세트를 빌려 쓰는 대분류끼리뿐 (같은 슬롯 = 같은 가구)', () => {
    const bySlot = new Map<string, string>()
    for (const c of CATS) c.furniture_slots.forEach((sl, i) => {
      const f = c.furniture[i]
      if (bySlot.has(sl)) expect(bySlot.get(sl), sl).toBe(f)
      bySlot.set(sl, f)
    })
  })
  it('소분류 소품: 있으면 행이 있고 소품 행, 자리 종류가 같음', () => {
    for (const s of SUBS) {
      if (!s.prop) { expect(s.slot_kind, s.id).toBeNull(); continue }
      const p = row(s.prop)
      expect(p, s.id).toBeDefined()
      expect(p!.type, s.id).toBe('sub_prop')
      expect(p!.slot?.kind, s.id).toBe(s.slot_kind)
    }
  })
  it('선반 소품은 어느 선반 칸에도 들어감, 바닥 소품은 자기 슬롯 크기 안', () => {
    const shelves = SLOTS.filter((s) => s.kind === 'shelf')
    expect(shelves).toHaveLength(12)
    for (const s of SUBS) {
      if (!s.prop) continue
      const p = row(s.prop)!
      if (s.slot_kind === 'shelf') for (const sh of shelves) expect(fits(p.size_m, sh.max_m), `${p.id} → ${sh.name}`).toBe(true)
      else {
        const sl = slot(p.slot!.name!)
        expect(sl, `${p.id} → ${p.slot!.name}`).toBeDefined()
        expect(fits(p.size_m, sl!.max_m), `${p.id} → ${sl!.name}`).toBe(true)
      }
    }
  })
  it('반려동물: 용품을 고르면 짝 동물이 있고, 동물·용품 슬롯이 모두 반려동물 자리', () => {
    for (const s of SUBS.filter((x) => x.slot_kind === 'pet_floor')) {
      expect(s.pet, s.id).toBeTruthy()
      const pet = row(s.pet!)
      expect(pet?.type, s.pet!).toBe('pet')
      expect(slot(pet!.slot!.name!)?.kind).toBe('pet_floor')
      expect(slot(row(s.prop!)!.slot!.name!)?.kind).toBe('pet_floor')
    }
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
      expect(['fall', 'pop', 'none'], s.name).toContain(s.drop.mode)
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
