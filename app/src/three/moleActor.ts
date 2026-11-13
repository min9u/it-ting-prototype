import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import moleUrl from '../assets/models/mole.glb?url'
import { loadGlb } from './glb'
import { createMoleDress, type MoleDress } from './moleDress'

/*
 * glb 두더지 (design/digul_3d_handoff_v1_1: v1 + 액세서리 소켓 5개 + mole_showcase). 동작 20개 중 방에서 쓰는 것:
 *   mole_room_drop, mole_idle, mole_walk, mole_turn, mole_drink(상체만),
 *   mole_sit_cushion / _beanbag / _chair, mole_sit_idle / _chair, mole_stand_up_cushion / _beanbag / _chair,
 *   리액션: mole_greet, mole_look_around, mole_ground_scratch
 * 지상 전용(mole_burrow_enter/exit, mole_butt_wiggle)은 굴 입구 기준 자세라 방에서는 안 씀.
 *
 * 원본 mole_v1_1.glb 에서 텍스처만 1024px WebP 로 줄인 파일 (Draco 해독기 없이 읽힘, 만드는 법은 docs/3d-handoff-v2-integration.md)
 *
 * 좌표: 두더지 원점 = 두 발 사이 바닥, 정면 +Z. 핸드오프 수치(m)는 키 1m 기준이라 방에서는 scale 배.
 * 구조: actor(위치·회전·scale) > gltf.scene(애니메이션 루트)
 */

export type Reaction = 'greet' | 'look' | 'scratch' | 'drink'
export const REACTIONS: { kind: Reaction; label: string; emoji: string }[] = [
  { kind: 'greet', label: '인사', emoji: '👋' },
  { kind: 'look', label: '두리번', emoji: '👀' },
  { kind: 'scratch', label: '헛발질', emoji: '🐾' },
  { kind: 'drink', label: '커피', emoji: '☕' },
]

export interface Seat { kind: 'cushion' | 'beanbag' | 'chair'; h: number }
/** 가구 userData.furniture. sitAt = 앉는 위치 노드 (sit_point_*: 위치 = 엉덩이 자리, 회전 0 = 카메라 쪽을 봄) */
export interface FurnitureData {
  id: string; label: string; seat?: Seat; sitAt?: THREE.Object3D; act?: 'drink'; stand?: number
  /** 마우스를 올렸을 때 이름표 (관심사 가구) */
  hint?: string
  /** 눌러도 앞까지 걸어가지 않음 (벽걸이·선반 소품) */
  noWalk?: boolean
}

const SIT: Record<Seat['kind'], { sit: string; idle: string; up: string; upOff: number }> = {
  cushion: { sit: 'mole_sit_cushion', idle: 'mole_sit_idle', up: 'mole_stand_up_cushion', upOff: .35 },
  // 빈백 전용 v2 동작 (3D 핸드오프 v3.3, mole_v1_2). 높이 보정이 동작 안에 들어 있음
  beanbag: { sit: 'mole_sit_beanbag_v2', idle: 'mole_sit_idle_beanbag', up: 'mole_stand_up_beanbag_v2', upOff: .7 },
  chair: { sit: 'mole_sit_chair', idle: 'mole_sit_idle_chair', up: 'mole_stand_up_chair', upOff: .7 },
}
const UPPER = /^(upper_body|arm_L|arm_R|coffee_cup|mole_eye_L|mole_eye_R)\./
const WALK_BASE = .32          // 재생 속도 1.0일 때 미끄러지지 않는 이동 속도 (m/s)
const WALK_RATE = 1.25         // 걷기 동작 재생 속도 (자연스러운 범위 0.8~1.25배 중 가장 빠르게)
/**
 * 보폭 배율 = 이동 속도 배율 (2026-11-11 1.5배, 2026-11-12 2.25배).
 * 2026-11-13: 동작까지 빨리 틀면 촐싹대 보여서(사용자 의견) 재생 속도는 그대로 두고,
 * mole_walk 의 발 앞뒤 이동(foot_* translation z)을 가운데 기준으로 이만큼 늘려 보폭으로 빨라지게 함. 발은 여전히 미끄러지지 않음
 */
const STRIDE = 2.25
const STRIDE_LIFT = 1.6        // 보폭이 커진 만큼 발을 조금 더 들어 올림 (발 높이 y 의 들림 폭 배율)
const ARRIVE = .7              // 앉는 자리 앞 도착 거리 (m)

export const loadMoleGltf = () => loadGlb(moleUrl)

/** mole_walk 복제본: 발의 앞뒤 이동(z)을 STRIDE 배, 들림(y)을 STRIDE_LIFT 배로 (각각 곡선의 가운데·바닥 기준). 이름은 그대로 */
const strideCache = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>()
export function strideWalk(src: THREE.AnimationClip) {
  let c = strideCache.get(src)
  if (c) return c
  c = src.clone()
  for (const t of c.tracks) {
    if (!/^foot_[LR]\.position$/.test(t.name)) continue
    const v = t.values
    let zMin = Infinity, zMax = -Infinity, yMin = Infinity
    for (let i = 0; i < v.length; i += 3) { zMin = Math.min(zMin, v[i + 2]); zMax = Math.max(zMax, v[i + 2]); yMin = Math.min(yMin, v[i + 1]) }
    const zMid = (zMin + zMax) / 2
    for (let i = 0; i < v.length; i += 3) {
      v[i + 1] = yMin + (v[i + 1] - yMin) * STRIDE_LIFT
      v[i + 2] = zMid + (v[i + 2] - zMid) * STRIDE
    }
  }
  strideCache.set(src, c)
  return c
}

const smooth = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u) }
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }

/** 한 단계 동작. tick이 true를 돌려주면 끝. hold면 중간에 끊지 않음(앉기·일어나기·떨어지기) */
interface Step { begin(): void; tick(dt: number): boolean; cancel?(): void; hold?: boolean }

export interface MoleActor {
  object: THREE.Group
  update(dt: number): void
  /** 바닥 한 점으로 걸어감. scratch = 도착해서 땅 긁기 한 번 (지상에서 잔디를 눌렀을 때, animation_list) */
  walkTo(p: THREE.Vector3, o?: { scratch?: boolean }): void
  /** 방향키 입력 (월드 x, z) */
  drive(x: number, z: number): void
  /** 가구를 누름. 동작이 있는 가구면 true */
  interact(g: THREE.Object3D): boolean
  react(kind: Reaction): void
  /** 다른 두더지 앞(1.5m)까지 가서 마주 보고 먼저 인사, 상대는 0.25초 뒤 인사 (ground_move_spec 6번) */
  greetWith(other: MoleActor): void
  /** 그 점을 바라보게 돌기 */
  faceTowards(p: THREE.Vector3): void
  /** delay초 뒤 인사 */
  greet(delay: number): void
  /** 하는 일이 없는지 */
  isIdle(): boolean
  /** 조종·걷기·동작이 하나도 없음 (제자리 숨쉬기만). 저사양 모드에서 그리기를 멈춰도 되는지 */
  isResting(): boolean
  /** 지금 mole_greet 를 하는 중인지 (말풍선 타이밍용) */
  isGreeting(): boolean
  /** 말풍선 붙일 머리 위 월드 좌표 */
  headTop(out: THREE.Vector3): THREE.Vector3
  /** 액세서리 바꾸기 (acc 를 넘겨 만든 경우만) */
  setWorn(ids: string[]): void
  dispose(): void
}

export function createMoleActor(gltf: GLTF, opts: {
  scale: number
  start: THREE.Vector3
  clamp?: (p: THREE.Vector3) => THREE.Vector3
  /** 카메라 쪽을 바라보는 yaw (정면 +Z 기준) */
  faceCamera?: number
  /** 처음에 천장에서 떨어질지 (기본 true) */
  drop?: boolean
  /** 서서 가만히 있을 때 두리번까지 기다리는 시간 [최소, 최대] 초 */
  lookEvery?: [number, number]
  /** 처음 바라보는 방향 */
  yaw?: number
  /** 떨어지기 전에 숨어 있는 시간 (천장 구멍이 열리는 동안, 초) */
  dropDelay?: number
  /** 서 있을 때 발 높이 (러그 위 0.03) */
  floorY?: number
  /** 액세서리 glb + 처음 착용 */
  acc?: GLTF
  worn?: string[]
  /** 지상: 땅 높이 (x, z) → y. 주면 서 있는 동안 발을 땅에 붙임 (ground_move_spec 2번, 지면보다 1cm 아래) */
  groundAt?: (x: number, z: number) => number
  /** 지상: 가만히 있으면 center 근처(radius)를 혼자 돌아다님. rest = 쉬는 시간 [최소, 최대] 초. 직접 조종하면 6초 동안 쉼 */
  wander?: { center: THREE.Vector3; radius: number; rest: [number, number] }
  /**
   * F 단순한 두더지 (저사양 실험실, lib/lowLab.ts): 털 재질(sheen·specular·노멀맵의 Physical)을 Lambert 로 바꾸고 액세서리를 뺌.
   * CPU 렌더러에서 두더지 픽셀 비용을 줄임. 모양·동작은 그대로
   */
  simple?: boolean
}): MoleActor {
  const FY = opts.floorY ?? 0
  const S = opts.scale
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const object = new THREE.Group()
  object.name = 'mole-actor'
  // 같은 glb를 여러 마리에 씀. SkeletonUtils.clone 이 SkinnedMesh 뼈 연결까지 복제
  const model = cloneSkinned(gltf.scene)
  const simpleMats = new Map<THREE.Material, THREE.MeshLambertMaterial>()
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false }
    if (m.isMesh && opts.simple) {
      const src = m.material as THREE.MeshStandardMaterial
      let lm = simpleMats.get(src)
      if (!lm) {
        lm = new THREE.MeshLambertMaterial({ color: src.color, map: src.map, side: src.side, transparent: src.transparent, opacity: src.opacity })
        lm.name = `${src.name}_simple`
        simpleMats.set(src, lm)
      }
      m.material = lm
    }
  })
  object.add(model)
  const dress: MoleDress | null = opts.acc && !opts.simple ? createMoleDress(model, opts.acc) : null
  dress?.setWorn(opts.worn ?? [])
  object.scale.setScalar(S)
  object.position.copy(opts.start)
  object.rotation.order = 'YXZ'
  object.rotation.y = opts.yaw ?? 0

  const mixer = new THREE.AnimationMixer(model)
  const clips = new Map(gltf.animations.map((c) => [c.name, c.name === 'mole_walk' ? strideWalk(c) : c]))
  const clip = (name: string) => {
    const c = clips.get(name)
    if (!c) throw new Error(`두더지 동작 없음: ${name}`)
    return c
  }
  // 상체를 뺀 하체 전용 클립 (커피를 마시는 동안 서 있기·앉아 있기 위에 겹치기)
  const lower = (name: string) => {
    const key = `${name}#lower`
    if (!clips.has(key)) {
      const c = clip(name).clone(); c.name = key
      c.tracks = c.tracks.filter((t) => !UPPER.test(t.name))
      clips.set(key, c)
    }
    return clips.get(key)!
  }
  const act = (name: string) => mixer.clipAction(name.endsWith('#lower') ? lower(name.slice(0, -6)) : clip(name))
  let current: THREE.AnimationAction | null = null

  /** 기본 재생. fade=0 이면 다른 동작을 모두 멈추고 바로 바꿈 (두더지 위치를 옮길 때) */
  function play(name: string, o: { fade?: number; once?: boolean; from?: number; rate?: number } = {}) {
    const a = act(name)
    // 이미 같은 반복 동작이 돌고 있으면 그대로 둠 (처음부터 다시 틀면 튐)
    if (a === current && !o.once && o.from === undefined && a.isRunning() && a.getEffectiveWeight() > .99) { a.timeScale = o.rate ?? 1; return a }
    const fade = reduce ? 0 : (o.fade ?? .15)
    if (fade === 0) mixer.stopAllAction()
    a.reset()
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
    a.clampWhenFinished = !!o.once
    a.time = o.from ?? 0
    a.timeScale = o.rate ?? 1
    a.setEffectiveWeight(1)
    a.play()
    if (current && current !== a && fade > 0) a.crossFadeFrom(current, fade, false)
    current = a
    return a
  }

  /* ---------- 상태 ---------- */
  let pose: 'stand' | 'sit' = 'stand'
  let seatAt: { pos: THREE.Vector3; yaw: number; seat: Seat } | null = null
  let cur: Step | null = null
  let plan: Step[] = []
  const driveDir = new THREE.Vector2()
  let driving = false
  let idleFor = 0
  const yawOf = () => object.rotation.y

  function setPlan(steps: Step[]) {
    if (cur && !cur.hold) { cur.cancel?.(); cur = null }
    plan = steps
  }

  /* ---------- 단계들 ---------- */
  const speed = WALK_BASE * WALK_RATE * STRIDE * S

  function walkStep(target: THREE.Vector3, o: { strict?: boolean } = {}): Step {
    let goal = target.clone(); let stuck = 0; let last = Infinity
    return {
      begin() {
        goal.y = FY
        if (!o.strict && opts.clamp) goal = opts.clamp(goal)
        if (current !== act('mole_walk')) play('mole_walk', { from: .125, rate: WALK_RATE, fade: .12 })
      },
      tick(dt) {
        const dx = goal.x - object.position.x, dz = goal.z - object.position.z, d = Math.hypot(dx, dz)
        if (d < .03) { object.position.x = goal.x; object.position.z = goal.z; play('mole_idle', { fade: .12 }); return true }
        // 몸을 진행 방향으로 (빠르게 따라 돌기)
        const want = Math.atan2(dx, dz), diff = wrap(want - yawOf())
        object.rotation.y = yawOf() + diff * Math.min(1, dt * 9)
        // 많이 틀어져 있으면 제자리에서 먼저 돌기
        const go = Math.abs(diff) > 1.2 ? 0 : Math.min(d, speed * dt)
        object.position.x += dx / d * go; object.position.z += dz / d * go
        if (!o.strict && opts.clamp) opts.clamp(object.position)
        // 가구에 막혀 더 못 가면 멈춤
        if (d > last - 1e-4 && go > 0) stuck += dt; else stuck = 0
        last = d
        if (stuck > .5) { play('mole_idle', { fade: .12 }); plan = []; return true }
        return false
      },
      cancel() { play('mole_idle', { fade: .12 }) },
    }
  }

  function turnStep(yaw: () => number): Step {
    let y0 = 0, delta = 0, dur = .5, t = 0
    return {
      begin() {
        y0 = yawOf(); delta = wrap(yaw() - y0); t = 0
        // 120°보다 크면 mole_turn 두 번 (각각 반씩)
        dur = Math.abs(delta) > Math.PI * 2 / 3 ? 1 : .5
        if (Math.abs(delta) > .15) play('mole_turn', { fade: .1 })
      },
      tick(dt) {
        if (Math.abs(delta) <= .15) { object.rotation.y = y0 + delta; return true }
        t += dt
        object.rotation.y = y0 + delta * (dur === 1 ? (t < .5 ? smooth(t / .5) / 2 : .5 + smooth((t - .5) / .5) / 2) : smooth(t / dur))
        if (t >= dur) { object.rotation.y = y0 + delta; play('mole_idle', { fade: .1 }); return true }
        return false
      },
      cancel() { object.rotation.y = y0 + delta; play('mole_idle', { fade: .1 }) },
    }
  }

  function clipStep(name: string, length?: number): Step {
    let t = 0, end = 0
    return {
      begin() { t = 0; end = length ?? clip(name).duration; play(name, { once: !length, fade: .15 }) },
      tick(dt) {
        t += dt
        if (t >= end) { play('mole_idle', { fade: .2 }); return true }
        return false
      },
      cancel() { play('mole_idle', { fade: .15 }) },
    }
  }

  function waitStep(sec: number): Step {
    let t = 0
    return { begin() { t = 0 }, tick(dt) { t += dt; return t >= sec } }
  }

  /** 앉기: 두더지를 앉는 자리로 옮기고 sit 동작 (시작 자세 = 도착점에서 가구를 보고 선 자세) */
  function sitStep(pos: THREE.Vector3, yaw: number, seat: Seat): Step {
    const k = SIT[seat.kind]; let t = 0, end = 0
    return {
      hold: true,
      begin() {
        object.position.set(pos.x, seat.h * S, pos.z); object.rotation.y = yaw
        t = 0; end = clip(k.sit).duration
        play(k.sit, { once: true, fade: 0 })
      },
      tick(dt) {
        t += dt
        if (t < end) return false
        play(k.idle, { fade: .15 })
        pose = 'sit'; seatAt = { pos: pos.clone(), yaw, seat }
        return true
      },
    }
  }

  /** 일어나기: 끝나면 두더지를 "일어난 뒤 서 있는 지점"으로 옮김 */
  function standStep(): Step {
    let t = 0, end = 0
    return {
      hold: true,
      begin() {
        if (pose !== 'sit' || !seatAt) { end = -1; return }
        t = 0; end = clip(SIT[seatAt.seat.kind].up).duration
        play(SIT[seatAt.seat.kind].up, { once: true, fade: .1 })
      },
      tick(dt) {
        if (end < 0) return true
        t += dt
        if (t < end || !seatAt) return false
        const off = SIT[seatAt.seat.kind].upOff * S, y = seatAt.yaw
        object.position.set(seatAt.pos.x + Math.sin(y) * off, FY, seatAt.pos.z + Math.cos(y) * off)
        play('mole_idle', { fade: 0 })
        pose = 'stand'; seatAt = null
        return true
      },
    }
  }

  /** 커피: 서 있기·앉아 있기는 하체만 남기고 그 위에 mole_drink(상체) */
  function drinkStep(): Step {
    let base = '', t = 0, end = 0, out = false
    let full: THREE.AnimationAction | null = null, low: THREE.AnimationAction | null = null, drink: THREE.AnimationAction | null = null
    const restore = (fade: number) => {
      if (!full || !low || !drink) return
      full.reset(); full.time = low.time; full.setEffectiveWeight(1); full.play()
      if (fade > 0) { full.fadeIn(fade); low.fadeOut(fade); drink.fadeOut(fade) } else { low.stop(); drink.stop() }
      current = full
    }
    return {
      begin() {
        base = pose === 'sit' && seatAt ? SIT[seatAt.seat.kind].idle : 'mole_idle'
        if (current !== act(base)) play(base, { fade: .15 })
        full = act(base); low = act(`${base}#lower`); drink = act('mole_drink')
        const f = reduce ? 0 : .2
        low.reset(); low.setLoop(THREE.LoopRepeat, Infinity); low.time = full.time; low.setEffectiveWeight(1); low.play()
        drink.reset(); drink.setLoop(THREE.LoopOnce, 1); drink.clampWhenFinished = true; drink.setEffectiveWeight(1); drink.play()
        if (f) { low.fadeIn(f); drink.fadeIn(f); full.fadeOut(f) } else full.stop()
        t = 0; end = clip('mole_drink').duration; out = false
      },
      tick(dt) {
        t += dt
        if (!out && t >= end - .25) { out = true; restore(reduce ? 0 : .25) }
        return t >= end
      },
      cancel() { if (!out) restore(.15) },
    }
  }

  /** 떨어지기: dropDelay 동안 숨어 있다가 (천장 구멍이 열리는 동안) mole_room_drop */
  function dropStep(): Step {
    const delay = opts.dropDelay ?? 0
    let t = 0, end = 0, started = false
    const start = () => { started = true; object.visible = true; play('mole_room_drop', { once: true, fade: 0 }) }
    return {
      hold: true,
      begin() { t = 0; end = clip('mole_room_drop').duration; if (delay > 0) { object.visible = false; play('mole_idle', { fade: 0 }) } else start() },
      tick(dt) {
        t += dt
        if (!started) { if (t >= delay) { const over = t - delay; start(); mixer.update(over) } return false }
        if (t - delay < end) return false
        play('mole_idle', { fade: .15 }); return true
      },
    }
  }

  const camYaw = () => opts.faceCamera ?? 0
  const standUp = (): Step[] => [standStep()]

  /* ---------- 처음: 천장에서 떨어지기 ---------- */
  if (reduce || opts.drop === false) play('mole_idle', { fade: 0, from: Math.random() * 2 }); else { cur = dropStep(); cur.begin() }
  const [lookMin, lookMax] = opts.lookEvery ?? [9, 9]
  let lookAfter = lookMin + Math.random() * (lookMax - lookMin)

  /* ---------- 지상: 혼자 돌아다니기 ---------- */
  const W = opts.wander
  let userFor = W ? 4 : 0   // 직접 조종한 뒤 지난 시간이 아니라 "쉬어야 할 남은 시간" (처음에도 잠깐 쉼)
  let wanderAfter = W ? W.rest[0] + Math.random() * (W.rest[1] - W.rest[0]) : Infinity
  const userAct = () => { userFor = 6; idleFor = 0 }

  /* ---------- 밖에서 부르는 것 ---------- */
  function walkTo(p: THREE.Vector3, o: { scratch?: boolean } = {}) {
    userAct()
    setPlan([...standUp(), walkStep(p), ...(o.scratch && !reduce ? [clipStep('mole_ground_scratch')] : [])])
  }

  function interact(g: THREE.Object3D): boolean {
    const f = g.userData.furniture as FurnitureData | undefined
    if (!f) return false
    const gp = (f.sitAt ?? g).getWorldPosition(new THREE.Vector3())
    if (f.seat) {
      const yaw = f.sitAt ? new THREE.Euler().setFromQuaternion(f.sitAt.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y : g.rotation.y
      if (pose === 'sit' && seatAt && seatAt.pos.distanceTo(new THREE.Vector3(gp.x, seatAt.pos.y, gp.z)) < .01) return true
      const arrive = new THREE.Vector3(gp.x + Math.sin(yaw) * ARRIVE * S, FY, gp.z + Math.cos(yaw) * ARRIVE * S)
      setPlan([...standUp(), walkStep(arrive), turnStep(() => yaw + Math.PI), sitStep(new THREE.Vector3(gp.x, 0, gp.z), yaw, f.seat)])
      return true
    }
    if (f.noWalk) return true
    // 가구 앞(방 가운데 쪽) 선 자리
    const to = new THREE.Vector3(-gp.x, 0, 1 - gp.z); to.normalize()
    const stand = new THREE.Vector3(gp.x, 0, gp.z).addScaledVector(to, f.stand ?? 1.4)
    if (f.act === 'drink') {
      setPlan([...standUp(), walkStep(stand), turnStep(() => Math.atan2(gp.x - object.position.x, gp.z - object.position.z)), waitStep(.35), turnStep(camYaw), drinkStep()])
      return true
    }
    setPlan([...standUp(), walkStep(stand)])
    return false
  }

  function react(kind: Reaction) {
    if (kind === 'drink') {
      // 앉아 있으면 앉은 채로 마심
      setPlan(pose === 'sit' ? [drinkStep()] : [turnStep(camYaw), drinkStep()])
      return
    }
    const name = kind === 'greet' ? 'mole_greet' : kind === 'look' ? 'mole_look_around' : 'mole_ground_scratch'
    setPlan([...standUp(), turnStep(camYaw), clipStep(name)])
  }

  function callStep(fn: () => void): Step {
    return { begin: fn, tick: () => true }
  }
  function waitFor(cond: () => boolean, max: number): Step {
    let t = 0
    return { begin() { t = 0 }, tick(dt) { t += dt; return cond() || t >= max } }
  }
  const yawTo = (p: THREE.Vector3) => Math.atan2(p.x - object.position.x, p.z - object.position.z)

  function greetWith(other: MoleActor) {
    const op = other.object.position
    // 상대에서 나 쪽으로 1.5m (방 단위 ×scale), 카메라 쪽으로 조금 치우치게
    const dir = new THREE.Vector3(object.position.x - op.x, 0, object.position.z - op.z)
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1)
    dir.normalize().add(new THREE.Vector3(0, 0, .35)).normalize()
    const spot = new THREE.Vector3(op.x, 0, op.z).addScaledVector(dir, 1.5 * S)
    setPlan([
      ...standUp(),
      walkStep(spot),
      callStep(() => other.faceTowards(object.position)),
      turnStep(() => yawTo(op)),
      waitFor(() => other.isIdle(), 1.5),
      callStep(() => other.greet(.25)),
      clipStep('mole_greet'),
    ])
  }

  function drive(x: number, z: number) {
    driveDir.set(x, z)
    if (driveDir.lengthSq() > 0) { driveDir.normalize(); userAct() }
  }

  /** 지상: 근처 아무 데나 (clamp 안쪽) */
  function wanderPoint() {
    const a = Math.random() * Math.PI * 2, r = W!.radius * (.35 + .65 * Math.random())
    const p = new THREE.Vector3(W!.center.x + Math.cos(a) * r, FY, W!.center.z + Math.sin(a) * r)
    return opts.clamp ? opts.clamp(p) : p
  }

  function update(dt: number) {
    dt = Math.min(dt, .05)
    // 방향키로 직접 조종
    if (driveDir.lengthSq() > 0) {
      if (cur?.hold) { /* 앉기·일어나기가 끝나길 기다림 */ }
      else if (pose === 'sit') { if (!cur) setPlan(standUp()) }
      else {
        if (cur) { cur.cancel?.(); cur = null }
        plan = []
        if (!driving) { driving = true; play('mole_walk', { from: .125, rate: WALK_RATE, fade: .12 }) }
        const want = Math.atan2(driveDir.x, driveDir.y), diff = wrap(want - yawOf())
        object.rotation.y = yawOf() + diff * Math.min(1, dt * 9)
        const go = Math.abs(diff) > 1.2 ? 0 : speed * dt
        object.position.x += driveDir.x * go; object.position.z += driveDir.y * go
        opts.clamp?.(object.position)
      }
    } else if (driving) { driving = false; play('mole_idle', { fade: .12 }) }

    if (!driving) {
      if (!cur && plan.length) { cur = plan.shift()!; cur.begin() }
      if (cur && cur.tick(dt)) cur = null
      // 서서 한참 가만히 있으면 두리번 (지상은 돌아다니기와 번갈아)
      if (!cur && !plan.length && pose === 'stand') {
        idleFor += dt
        userFor = Math.max(0, userFor - dt)
        if (W && userFor <= 0 && idleFor > wanderAfter) {
          idleFor = 0; wanderAfter = W.rest[0] + Math.random() * (W.rest[1] - W.rest[0])
          if (Math.random() < .3 && !reduce) { cur = clipStep('mole_look_around'); cur.begin() }
          else { plan = [walkStep(wanderPoint())] }
        } else if (!W && idleFor > lookAfter && !reduce) { idleFor = 0; lookAfter = lookMin + Math.random() * (lookMax - lookMin); cur = clipStep('mole_look_around'); cur.begin() }
      } else idleFor = 0
    }
    // 지상: 발을 땅에 붙임 (ground_move_spec 2번. 탐색 화면 가까운 땅은 평평해서 몸 기울기는 생략)
    if (opts.groundAt && pose === 'stand') object.position.y = opts.groundAt(object.position.x, object.position.z) - .01 * S
    mixer.update(dt)
    dress?.update(dt, activeClip(), driving || (current === act('mole_walk')))
  }

  /** 손 소품 숨김 규칙에 쓰는 지금 동작 이름 (커피는 상체만 겹쳐 재생하므로 따로 봄) */
  const HIDE = ['mole_drink', 'mole_greet', 'mole_butt_wiggle', 'mole_burrow_enter']
  function activeClip() {
    for (const n of HIDE) {
      if (!clips.has(n)) continue
      const a = mixer.existingAction(clips.get(n)!)
      if (a && a.isRunning() && a.getEffectiveWeight() > .01) return n
    }
    return current?.getClip().name.replace('#lower', '') ?? 'mole_idle'
  }

  return {
    object, update, walkTo, drive, interact, react, greetWith,
    faceTowards(p) { const q = p.clone(); setPlan([...standUp(), turnStep(() => yawTo(q))]) },
    greet(delay) { setPlan([...standUp(), waitStep(delay), clipStep('mole_greet')]) },
    isIdle: () => !cur && !plan.length,
    isResting: () => !cur && !plan.length && !driving && driveDir.lengthSq() === 0,
    isGreeting: () => current === act('mole_greet') && current.isRunning(),
    headTop(out) { return out.set(object.position.x, object.position.y + 1.2 * S, object.position.z) },
    setWorn(ids) { dress?.setWorn(ids) },
    dispose() { dress?.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(model); simpleMats.forEach((m) => m.dispose()) },
  }
}
