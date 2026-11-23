/**
 * 두더지 glb 하나로 통일 (3D 핸드오프 mole_v1_4, 2026-11-22)
 * - 앱 · 채팅방이 같은 파일을 씀 (옛 mole.glb · mole_chat.glb 는 없음)
 * - 동작 26개 = v1_3 의 25개 + mole_sit_talk (채팅). 눈(mole_eye_L/R)은 크기(깜빡임) 트랙만 — 위치·회전 트랙이 있으면 눈이 머리 속으로 들어감
 * - `mole` 노드 y = +0.03 → 채팅방은 그룹 높이에서 그만큼 뺌 (MOLE_NODE_Y)
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LOOP_CLIPS, MOLE_NODE_Y, trimLoopSeams } from '../three/moleModel'
import { SIT_Y } from '../three/chatRoomLayout'

const FS = 'node:fs' // @types/node 가 없어서 문자열로 불러 타입 검사를 피함 (vitest 는 app/ 에서 실행)
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string): Uint8Array; existsSync(p: string): boolean }
const FILE = 'src/assets/models/mole_v1_4_draco_webp.glb'
function parse(path: string) {
  const buf = fs.readFileSync(path)
  const len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(12, true)
  return JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len))) as {
    nodes: { name?: string; translation?: number[] }[]
    animations: { name: string; channels: { target: { node: number; path: string } }[] }[]
  }
}
const j = parse(FILE)

describe('mole_v1_4 glb', () => {
  it('옛 두더지 파일이 없고 새 파일 하나만 있음', () => {
    expect(fs.existsSync('src/assets/models/mole.glb')).toBe(false)
    expect(fs.existsSync('src/assets/models/mole_chat.glb')).toBe(false)
  })
  it('동작 26개, 채팅 동작(sit_talk · drink · sit_idle)과 v1_3 의 hop 동작이 있음', () => {
    const names = j.animations.map((a) => a.name)
    expect(names).toHaveLength(26)
    for (const n of ['mole_sit_talk', 'mole_drink', 'mole_sit_idle', 'mole_hop_down', 'mole_hop_up', 'mole_sit_beanbag_v2', 'mole_showcase']) expect(names).toContain(n)
  })
  it('눈 노드는 크기 트랙만 있음 (위치 · 회전 트랙 없음 → 눈이 보임)', () => {
    const idx = new Set(j.nodes.map((n, i) => (/^mole_eye_[LR]$/.test(n.name ?? '') ? i : -1)).filter((i) => i >= 0))
    expect(idx.size).toBe(2)
    for (const a of j.animations) for (const c of a.channels) if (idx.has(c.target.node)) expect(c.target.path, a.name).toBe('scale')
  })
  it('drink · sit_talk 는 상체 트랙만 (하체 트랙이 있으면 앉은 하체가 끌려감)', () => {
    const lower = new Set(j.nodes.map((n, i) => (/^(root|lower_body|foot_L|foot_R)$/.test(n.name ?? '') ? i : -1)).filter((i) => i >= 0))
    for (const name of ['mole_drink', 'mole_sit_talk']) {
      const a = j.animations.find((x) => x.name === name)!
      for (const c of a.channels) expect(lower.has(c.target.node), `${name}: ${j.nodes[c.target.node].name}`).toBe(false)
    }
  })
})

describe('높이: mole 노드 +0.03', () => {
  it('glb 의 mole 노드 y 가 MOLE_NODE_Y 와 같음', () => {
    const mole = j.nodes.find((n) => n.name === 'mole')!
    expect(mole.translation?.[1]).toBeCloseTo(MOLE_NODE_Y, 6)
  })
  it('채팅방 그룹 높이 = sit point − 노드 높이 (더하면 3cm 뜸)', () => {
    expect(SIT_Y - MOLE_NODE_Y).toBeCloseTo(0.10, 6)
  })
})

describe('반복 동작 이음매 (시작 시간 0.0417초)', () => {
  const mk = (name: string, t0: number, len: number) => {
    // 첫 자세 = 마지막 자세인 한 바퀴: P → Q → P
    const times = [t0, t0 + len / 2, t0 + len]
    const tr = new THREE.NumberKeyframeTrack('a.position[y]', times, [0, 1, 0])
    return new THREE.AnimationClip(name, -1, [tr])
  }
  /** 24fps 로 두 바퀴 재생하며 같은 값이 연달아 나오는 횟수 (이음매 멈칫) */
  const stalls = (clip: THREE.AnimationClip, loops = 2) => {
    const o = new THREE.Object3D(); o.name = 'a'
    const m = new THREE.AnimationMixer(o)
    m.clipAction(clip).play()
    let prev = NaN, same = 0
    const frames = Math.round(clip.duration * 24 * loops)
    for (let i = 0; i < frames; i++) {
      m.setTime(i / 24)
      const y = o.position.y
      if (Math.abs(y - prev) < 1e-9) same++
      prev = y
    }
    return same
  }
  const T0 = 1 / 24
  it('당기기 전: 한 바퀴마다 같은 자세가 한 프레임 더 머묾 → 당긴 뒤: 없음', () => {
    const before = mk('mole_sit_idle', T0, 2.5)
    expect(before.duration).toBeCloseTo(2.5 + T0, 6)
    expect(stalls(before)).toBeGreaterThan(0)
    const clips = [mk('mole_sit_idle', T0, 2.5)]
    expect(trimLoopSeams(clips)).toBe(1)
    expect(clips[0].duration).toBeCloseTo(2.5, 6)
    expect(clips[0].tracks[0].times[0]).toBeCloseTo(0, 9)
    expect(stalls(clips[0])).toBe(0)
  })
  it('한 번만 하는 동작은 그대로, 두 번 불러도 같은 결과', () => {
    const once = mk('mole_sit_cushion', T0, 1.125)
    const loop = mk('mole_walk', T0, 1)
    expect(trimLoopSeams([once, loop])).toBe(1)
    expect(once.tracks[0].times[0]).toBeCloseTo(T0, 6)
    expect(trimLoopSeams([once, loop])).toBe(0)
    expect(loop.duration).toBeCloseTo(1, 6)
  })
  it('반복 동작 목록은 핸드오프 표의 "반복 O" 8개', () => {
    expect([...LOOP_CLIPS].sort()).toEqual(['mole_butt_wiggle', 'mole_idle', 'mole_look_around', 'mole_showcase', 'mole_sit_idle', 'mole_sit_idle_beanbag', 'mole_sit_idle_chair', 'mole_walk'])
  })
})
