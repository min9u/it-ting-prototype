/**
 * 땅굴 방 구도 (three/roomFrame.ts, 2026-11-21 v3.8 3단계): 앞쪽 바닥의 반려동물 자리가 아래 버튼 줄 · 오른쪽 정보 패널에 안 가리게
 * - three/stills.ts 는 three 를 불러오지 않으려고 같은 값을 따로 적어 둠 → 둘이 같은지
 * - 슬롯 좌표(3D 담당 값)를 같은 카메라로 투영해서, 앞쪽 바닥 자리의 화면 위치가 화면 요소(하단 버튼 줄 y ≥ 885 · 정보 패널 x ≥ 1068)에 안 걸리는지
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ROOM_FRAME } from '../three/roomFrame'
import slotsRaw from '../data/slots.json'

interface Slot { name: string; slot_type?: string; pos_three: number[]; max_m: { w: number; d: number; h: number } }
const SLOTS = slotsRaw as unknown as Slot[]
const FS = 'node:fs'
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, enc: string): string }

describe('땅굴 방 구도 ROOM_FRAME', () => {
  it('stills.ts 에 따로 적은 값과 같음', () => {
    const src = fs.readFileSync('src/three/stills.ts', 'utf8')
    const m = /const ROOM_TOP = (-?[\d.]+), ROOM_H = ([\d.]+)/.exec(src)!
    expect([+m[1], +m[2]]).toEqual([ROOM_FRAME.top, ROOM_FRAME.h])
  })
  it('반려동물 자리(동물 + 짝 용품)가 1440×960 화면의 하단 버튼 줄(y ≥ 885, 왼쪽 35~353 · 오른쪽 938~1051)과 정보 패널(x ≥ 1068)에 안 걸림', () => {
    // roomScene.ts 와 같은 카메라 · 구도. 캔버스 = 헤더 아래(y 62~960), 방 가운데 x = 580
    const W = 1440, H = 898, Y0 = 62, focus = 580 / 1440
    const cam = new THREE.PerspectiveCamera(48.5, 4 / 3, .1, 100)
    cam.position.set(0, 1.56, 6.37); cam.lookAt(0, 2.04, 0)
    const bh = H * ROOM_FRAME.h, bw = bh * 4 / 3
    cam.aspect = bw / bh; cam.setViewOffset(bw, bh, -(focus * W - bw / 2), -ROOM_FRAME.top * H, W, H); cam.updateProjectionMatrix(); cam.updateMatrixWorld()
    const P = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x * .5 + .5) * W, y: Y0 + (1 - (v.y * .5 + .5)) * H } }
    const pets = SLOTS.filter((s) => /^pet_slot_|^prop_slot_(1[5-9])$/.test(s.name))
    expect(pets).toHaveLength(10)
    for (const s of pets) {
      const [x, y, z] = s.pos_three, m = s.max_m
      const left = P(x - m.w / 2, y, z + m.d / 2), right = P(x + m.w / 2, y, z + m.d / 2)
      expect(right.x, `${s.name} 오른쪽 끝이 정보 패널 안`).toBeLessThan(1068)
      expect(Math.max(left.y, right.y), `${s.name} 앞쪽 끝이 하단 버튼 줄 안`).toBeLessThan(885 - 20)
    }
  })
})
