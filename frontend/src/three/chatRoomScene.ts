import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import shellUrl from '../assets/models/room_shell_v3_draco_webp.glb?url'
import baseUrl from '../assets/models/room/room_base_v3_1_draco_webp.glb?url'
import decoUrl from '../assets/models/room/room_deco_v1_draco_webp.glb?url'
import shelvesUrl from '../assets/models/room/room_shelves_v1_1_draco_webp.glb?url'
import { loadGlb } from './glb'
import { loadMoleGltf, MOLE_NODE_Y } from './moleModel'
import { markShadows } from './contactShadow'
import { applyWallpaper } from './roomScene'
import { approach, createRenderer, destroyRenderer, quality, startLoop, testParam } from './engine'
import { createMoleDress, handHiddenInChat, loadAccessories, type MoleDress } from './moleDress'
import {
  CAM_PRESETS, CAM_SECONDS, CUSHION_AHEAD, DRINK_EVERY, EMPTY_MARK, FIRST_TALK, MAX_SEATED, SEAT_MIN_MS, SIT_Y, ease, firstDrinkAt, fovFor, idlePhase,
  initialSeated, presetFor, seatToVacate, seatsFor, tagPoint, talkDelayAfterDrink, type CamPreset, type PresetName, type Seat,
} from './chatRoomLayout'

/*
 * 채팅방 3D (design/digul_3d_handoff_chat_v1, docs/chat-room-3d.md)
 * - 방: 땅굴 방의 껍데기(room_shell_v3) + 기본 가구(room_base_v3_1, 원탁이 이미 가운데) + 장식(room_deco_v1) + 벽 선반(room_shelves_v1_1).
 *   핸드오프의 room_base_v2 노드 옮기기 대신 v3_1 에 맞춤: 원탁만 (1.7, 0.9, 1.7) 로 키워 낮추고(찻주전자·찻잔은 크기 상쇄),
 *   수납장·스탠드·큰 화분·러그 둘·원래 방석 둘은 숨김. 방석은 원래 방석 노드를 자리마다 복제
 * - 두더지: mole_v1_4 (앱 공용 glb, 동작 26개, sit_talk 포함) + accessories v1.2. 4명 이상이면 손 소품 숨김 (moleDress.handHiddenInChat)
 * - 인원별 자리 · 카메라 프리셋 · 0.6초 전환 · 6명 초과(나 + 최근 말한 5명, 교체 쏙/퐁) 규칙은 chatRoomLayout.ts
 * - 모션: sit_idle 반복(하체) + 상체만 덮어쓰기. 10초마다 drink, 사이에 talk, 메시지 보낼 때 talk
 * - 이름표 · 누르기는 장면 위 HTML (이름표 위치를 매 프레임 투영해서 옮김)
 */
export interface ChatMember { id: string; name: string; worn: string[]; me?: boolean; gone?: boolean }
export interface ChatRoomUi {
  /** 이름표 CSS 클래스 (TeaRoom.module.css) */
  tag: string
  tagMe: string
  tagBtn: string
}
export interface ChatRoomInit {
  members: ChatMember[]
  /** 사용자별 마지막으로 말한 시각 (ms). 없으면 말한 적 없음 */
  spoke: Record<string, number>
  ui: ChatRoomUi
  onPick(id: string): void
  /** 자리를 못 받은 인원 ("+N" 배지) */
  onOverflow(n: number): void
  onReady(): void
}
export interface ChatRoomHandle {
  setMembers(members: ChatMember[], spoke: Record<string, number>): void
  /** 이 사용자가 메시지를 보냄 → talk 재생 (자리에 없으면 가장 오래 말 없던 사람과 교체) */
  speak(id: string): void
  /** 화면 시험용: 지금 앉은 사람 */
  seated(): string[]
  dispose(): void
}

const UPPER = /^(upper_body|arm_L|arm_R|mole_eye_L|mole_eye_R|coffee_cup)\./
/** 두더지 그룹 높이: sit point(SIT_Y) 에서 glb `mole` 노드의 +0.03 을 뺀 값 (그룹 위치에 노드 높이가 더해지므로. 3D 핸드오프 mole_v1_4 "높이 +0.03m") */
const ROOT_Y = SIT_Y - MOLE_NODE_Y
const FADE = 0.3
const POP_SECONDS = 0.3
const BG = '#E9B597'

interface Actor {
  id: string
  member: ChatMember
  root: THREE.Group
  model: THREE.Object3D
  mixer: THREE.AnimationMixer
  aUpper: THREE.AnimationAction
  aLower: THREE.AnimationAction
  aDrink: THREE.AnimationAction
  aTalk: THREE.AnimationAction
  dress: MoleDress | null
  cushion: THREE.Object3D | null
  hit: THREE.Mesh
  tag: HTMLElement
  /** 자리 목표 (월드) */
  target: { x: number; z: number; yaw: number }
  /** 퐁 등장 · 쏙 사라짐 진행 (초). appear: 0→POP_SECONDS, leaving: 0→POP_SECONDS 후 제거 */
  state: 'waiting' | 'appearing' | 'idle' | 'leaving'
  stateT: number
  waitFor: number
  /** 지금 상체를 덮어쓰는 동작 ('mole_drink'|'mole_sit_talk') 과 끝났는지 보는 함수 */
  overlay: string | null
  pending: (() => boolean) | null
  wantTalk: boolean
  t: number
  nextDrink: number
  nextTalk: number
}

export function mountChatRoom(el: HTMLElement, init: ChatRoomInit): ChatRoomHandle {
  const q = quality()
  const renderer = createRenderer(el, { alpha: false, exposure: 1, shadowType: THREE.PCFSoftShadowMap, quality: q })
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = false
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  const camera = new THREE.PerspectiveCamera(62, 780 / 1420, 0.1, 100)
  const camTarget = new THREE.Vector3()

  // 조명: 땅굴 방과 같은 값 (room_spec 3번). 올려 보니 벽이 허옇게 날아가 핸드오프 사진의 복숭아색과 멀어져서 그대로 둠. ?chatamb · ?chatbulb · ?chatfill 은 시험 손잡이
  scene.add(new THREE.AmbientLight(0xF0B47A, +(testParam('chatamb') ?? 0.785)))
  const bulb = new THREE.PointLight(0xFFDDB3, +(testParam('chatbulb') ?? 48.4), 0, 2); bulb.position.set(0, 2.436, -0.455); scene.add(bulb)
  const fill = new THREE.DirectionalLight(0xFFE7CB, +(testParam('chatfill') ?? 1.8)); fill.position.set(0, 2.86, 4.55); fill.target.position.set(0, 1, 0); scene.add(fill, fill.target)

  let W = 1, H = 1, dead = false, ready = false
  let members = init.members
  let spoke = { ...init.spoke }
  let seated: string[] = []
  const seatedAt: Record<string, number> = {}
  const actors = new Map<string, Actor>()
  const lowFps = q.level === 'low' ? +(testParam('teafps') ?? String(q.idleFps)) : 0

  // ---- 카메라 ----
  let preset: PresetName = 'close'
  let camNow: CamPreset = CAM_PRESETS.close
  let camTween: { t: number; delay: number; from: CamPreset; to: CamPreset } | null = null
  const lerpV = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
  const applyCamera = (c: CamPreset) => {
    camNow = c
    camera.position.set(...c.pos); camTarget.set(...c.target)
    camera.aspect = W / H
    camera.fov = fovFor(c.fov, W / H)
    camera.updateProjectionMatrix(); camera.lookAt(camTarget)
  }
  const moveCameraTo = (name: PresetName, delay = 0) => {
    if (name === preset && !camTween) return
    preset = name
    camTween = { t: 0, delay, from: camNow, to: CAM_PRESETS[name] }
  }

  // ---- 모델 ----
  let moleG: GLTF | null = null, accG: GLTF | undefined
  let cushions: { yellow: THREE.Object3D; sky: THREE.Object3D } | null = null
  let emptyMark: THREE.Group | null = null
  const hitGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  function buildEmptyMark() {
    // 점선 원: 반지름 0.36, 선 두께 0.028, 28칸 중 58%만 칠함
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: EMPTY_MARK.color, transparent: true, opacity: 0.9, depthWrite: false })
    const N = 28, arc = (Math.PI * 2) / N
    for (let i = 0; i < N; i++) {
      const geo = new THREE.RingGeometry(EMPTY_MARK.radius - 0.014, EMPTY_MARK.radius + 0.014, 6, 1, i * arc, arc * 0.58)
      const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2
      g.add(m)
    }
    g.position.set(EMPTY_MARK.x, EMPTY_MARK.y, EMPTY_MARK.z)
    g.renderOrder = 2
    g.visible = false
    scene.add(g)
    return g
  }

  function makeActor(member: ChatMember, seat: Seat, delay: number): Actor {
    const g = moleG!
    const model = cloneSkinned(g.scene)
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.frustumCulled = false })
    const root = new THREE.Group()
    root.add(model)
    root.position.set(seat.x, ROOT_Y, seat.z); root.rotation.y = seat.yaw
    root.scale.setScalar(0.0001)
    scene.add(root)

    const mixer = new THREE.AnimationMixer(model)
    const clip = (name: string) => THREE.AnimationClip.findByName(g.animations, name)
    const idle = clip('mole_sit_idle')
    const idleLower = new THREE.AnimationClip('sit_idle_lower', idle.duration, idle.tracks.filter((t) => !UPPER.test(t.name)))
    const idleUpper = new THREE.AnimationClip('sit_idle_upper', idle.duration, idle.tracks.filter((t) => UPPER.test(t.name)))
    const aLower = mixer.clipAction(idleLower).play()
    const aUpper = mixer.clipAction(idleUpper).play()
    const aDrink = mixer.clipAction(clip('mole_drink'))
    const aTalk = mixer.clipAction(clip('mole_sit_talk'))
    for (const a of [aDrink, aTalk]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false }
    // 마리마다 같이 움직이지 않게 시작 위상을 어긋나게
    aLower.time = aUpper.time = idlePhase(Math.random())

    const dress = accG ? createMoleDress(model, accG) : null
    dress?.setWorn(member.worn)

    let cushion: THREE.Object3D | null = null
    if (cushions) {
      cushion = (seat.cushion === 'yellow' ? cushions.yellow : cushions.sky).clone(true)
      cushion.visible = true
      cushion.position.set(seat.x + Math.sin(seat.yaw) * CUSHION_AHEAD, 0, seat.z + Math.cos(seat.yaw) * CUSHION_AHEAD)
      cushion.rotation.set(0, seat.yaw, 0)
      cushion.scale.setScalar(0.0001)
      scene.add(cushion)
      markShadows(cushion)
    }

    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.position.y = 0.5; hit.visible = false; hit.userData.actorId = member.id
    root.add(hit)

    const tag = document.createElement(member.me || member.gone ? 'span' : 'button')
    tag.textContent = member.me ? '나' : member.name
    tag.className = member.me ? init.ui.tagMe : init.ui.tag
    if (tag instanceof HTMLButtonElement) {
      tag.type = 'button'; tag.classList.add(init.ui.tagBtn)
      tag.setAttribute('aria-label', `${member.name} 프로필 보기`)
      tag.addEventListener('click', () => init.onPick(member.id))
    }
    tag.style.cssText += ';position:absolute;left:0;top:0;z-index:3;will-change:transform;visibility:hidden'
    el.appendChild(tag)

    const a: Actor = {
      id: member.id, member, root, model, mixer, aUpper, aLower, aDrink, aTalk, dress, cushion, hit, tag,
      target: { x: seat.x, z: seat.z, yaw: seat.yaw },
      state: delay > 0 ? 'waiting' : 'appearing', stateT: 0, waitFor: delay,
      overlay: null, pending: null, wantTalk: false, t: 0, nextDrink: firstDrinkAt(Math.random()), nextTalk: FIRST_TALK + Math.random() * 2,
    }
    root.visible = false
    if (cushion) cushion.visible = false
    return a
  }

  function playOverlay(a: Actor, action: THREE.AnimationAction, name: string) {
    action.reset().setEffectiveWeight(1).play()
    a.aUpper.crossFadeTo(action, FADE, false) // 상체 idle → 동작
    a.overlay = name
    a.pending = () => {
      if (action.time < action.getClip().duration - FADE) return false
      a.aUpper.reset().setEffectiveWeight(1).play() // 동작 → 상체 idle (하체와 시간 맞춤)
      a.aUpper.time = a.aLower.time
      action.crossFadeTo(a.aUpper, FADE, false)
      a.overlay = null
      return true
    }
  }
  const talkNow = (a: Actor) => {
    if (a.state === 'leaving') return
    if (a.pending) { a.wantTalk = a.overlay === 'mole_drink'; return } // 동작 중엔 새 동작 안 넣음. drink 중이면 끝난 뒤
    playOverlay(a, a.aTalk, 'mole_sit_talk')
    a.nextTalk = Infinity
  }

  // ---- 앉는 사람 · 자리 ----
  function dropActor(a: Actor) {
    a.tag.remove()
    a.root.removeFromParent(); a.cushion?.removeFromParent()
    a.dress?.dispose(); a.mixer.stopAllAction()
    actors.delete(a.id)
  }
  const meIdOf = () => members.find((m) => m.me)?.id ?? ''
  const seatOf = (id: string): Seat | undefined => seatsFor(seated.length)[seated.indexOf(id)]

  /** seated 에 맞춰 두더지 만들기 · 자리 옮기기 · 내보내기 · 카메라 · 손 소품 숨김 · "+N" */
  function sync(opts: { initial?: boolean } = {}) {
    if (!moleG) return
    const layout = seatsFor(seated.length)
    const before = preset
    const grow = presetFor(seated.length) !== before && CAM_PRESETS[presetFor(seated.length)].pos[2] > camNow.pos[2]
    const now = performance.now()
    // 나가는 사람
    let leaving = false
    for (const a of actors.values()) if (!seated.includes(a.id) && a.state !== 'leaving') { a.state = 'leaving'; a.stateT = 0; leaving = true }
    // 앉는 사람
    seated.forEach((id, i) => {
      const seat = layout[i]
      const member = members.find((m) => m.id === id)
      if (!member) return
      seatedAt[id] ??= now
      let a = actors.get(id)
      if (!a) {
        // 카메라를 먼저 빼고(0.6초) 그다음 새 두더지 등장 (늘 때)
        a = makeActor(member, seat, opts.initial ? 0 : grow ? CAM_SECONDS : 0)
        actors.set(id, a)
        if (opts.initial) a.root.position.set(seat.x, ROOT_Y, seat.z)
      } else {
        a.member = member
        a.target = { x: seat.x, z: seat.z, yaw: seat.yaw }
        if (a.state === 'leaving') { a.state = 'appearing'; a.stateT = 0 }
      }
    })
    const mode = presetFor(seated.length)
    if (opts.initial) { preset = mode; camTween = null; applyCamera(CAM_PRESETS[mode]) }
    else moveCameraTo(mode, leaving && !grow ? POP_SECONDS : 0) // 줄 때는 두더지가 나간 뒤 카메라를 당김
    const hide = handHiddenInChat(seated.length)
    for (const a of actors.values()) a.dress?.setHandsHidden(hide)
    if (emptyMark) emptyMark.visible = seated.length === 1
    init.onOverflow(Math.max(0, members.length - seated.length))
  }

  function placeNow(a: Actor) {
    // 자리가 바뀐 사람 방석 색 (노랑 ↔ 하늘): 새 방석으로 갈아 끼움
    const seat = seatOf(a.id)
    if (!seat || !a.cushion || !cushions) return
    const want = seat.cushion === 'yellow' ? cushions.yellow : cushions.sky
    if ((a.cushion.userData.kind as string | undefined) === seat.cushion) return
    const old = a.cushion
    const next = want.clone(true); next.visible = old.visible; next.position.copy(old.position); next.rotation.copy(old.rotation); next.scale.copy(old.scale)
    next.userData.kind = seat.cushion
    old.removeFromParent(); scene.add(next); markShadows(next); a.cushion = next
  }

  function setMembersInner(next: ChatMember[], sp: Record<string, number>) {
    members = next; spoke = { ...sp }
    const ids = members.map((m) => m.id)
    const meId = meIdOf()
    if (!seated.length) { seated = initialSeated({ ids, meId, spoke }) }
    else {
      seated = seated.filter((id) => ids.includes(id))
      const rest = ids.filter((id) => !seated.includes(id))
      if (meId && !seated.includes(meId) && ids.includes(meId)) seated.unshift(meId)
      // 자리가 남으면 최근에 말한 사람부터 채움
      const room = MAX_SEATED - seated.length
      const add = [...rest].sort((a, b) => (spoke[b] ?? -Infinity) - (spoke[a] ?? -Infinity)).slice(0, Math.max(0, room))
      seated = [...seated, ...rest.filter((id) => add.includes(id))]
    }
    // 이름 · 꾸민 것 바뀜
    for (const a of actors.values()) {
      const m = members.find((x) => x.id === a.id)
      if (!m) continue
      if (m.worn.join('+') !== a.member.worn.join('+')) a.dress?.setWorn(m.worn)
      a.member = m
      if (!m.me && !m.gone) a.tag.textContent = m.name
    }
    sync()
    for (const a of actors.values()) placeNow(a)
  }

  function speakInner(id: string) {
    const now = performance.now()
    spoke[id] = Date.now()
    const a = actors.get(id)
    if (a && seated.includes(id)) { talkNow(a); return }
    if (!members.some((m) => m.id === id)) return
    // 자리에 없는 사람: 가장 오래 말이 없던 두더지와 교체 (한 자리 최소 5초)
    const seatedMs: Record<string, number> = {}
    for (const sid of seated) seatedMs[sid] = seatedAt[sid] ?? 0
    const out = seatToVacate(seated, meIdOf(), seatedMs, spoke, now)
    if (!out) return
    const i = seated.indexOf(out)
    seated[i] = id
    delete seatedAt[out]; seatedAt[id] = now
    sync()
    const n = actors.get(id)
    if (n) { n.nextDrink = firstDrinkAt(Math.random()); talkNow(n) }
    for (const x of actors.values()) placeNow(x)
  }

  // ---- 화면 위 이름표 · 누르기 ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const pick = (e: PointerEvent): Actor | null => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const list = [...actors.values()].filter((a) => a.state !== 'leaving' && a.state !== 'waiting').map((a) => a.hit)
    const hit = ray.intersectObjects(list, false)[0]
    return hit ? actors.get(hit.object.userData.actorId as string) ?? null : null
  }
  const clickable = (a: Actor | null) => !!a && !a.member.me && !a.member.gone
  const onClick = (e: PointerEvent) => { const a = pick(e); if (a && clickable(a)) init.onPick(a.id) }
  const onMove = (e: PointerEvent) => { el.style.cursor = clickable(pick(e)) ? 'pointer' : '' }
  el.addEventListener('click', onClick as EventListener)
  el.addEventListener('pointermove', onMove)

  const v3 = new THREE.Vector3()
  const placeTags = () => {
    for (const a of actors.values()) {
      const seat: Seat = { x: a.root.position.x, z: a.root.position.z, yaw: a.root.rotation.y, cushion: 'yellow' }
      const p = tagPoint(seat)
      v3.set(p.x, 0, p.z).project(camera)
      const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H
      a.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
      a.tag.style.visibility = a.state === 'idle' || a.state === 'appearing' ? 'visible' : 'hidden'
    }
  }

  const angleStep = (cur: number, target: number, dt: number) => {
    let d = target - cur
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return cur + (approach(0, d, dt, 0.1))
  }

  const update = (dt: number) => {
    // 카메라
    if (camTween) {
      if (camTween.delay > 0) camTween.delay -= dt
      else {
        camTween.t = Math.min(1, camTween.t + dt / CAM_SECONDS)
        const k = ease(camTween.t)
        const { from, to } = camTween
        applyCamera({ pos: lerpV(from.pos, to.pos, k), target: lerpV(from.target, to.target, k), fov: from.fov + (to.fov - from.fov) * k })
        if (camTween.t >= 1) camTween = null
      }
    }
    for (const a of [...actors.values()]) {
      a.t += dt
      if (a.state === 'waiting') { a.waitFor -= dt; if (a.waitFor <= 0) { a.state = 'appearing'; a.stateT = 0 } else continue }
      if (a.state === 'appearing') {
        a.root.visible = true; if (a.cushion) a.cushion.visible = true
        a.stateT += dt
        const k = Math.min(1, a.stateT / POP_SECONDS)
        const s = k < 0.7 ? (k / 0.7) * 1.1 : 1.1 - ((k - 0.7) / 0.3) * 0.1 // 0 → 1.1 → 1
        a.root.scale.setScalar(Math.max(0.0001, s)); a.cushion?.scale.setScalar(Math.max(0.0001, s))
        if (k >= 1) a.state = 'idle'
      } else if (a.state === 'leaving') {
        a.stateT += dt
        const k = Math.min(1, a.stateT / POP_SECONDS)
        a.root.scale.setScalar(Math.max(0.0001, 1 - k)); a.root.position.y = ROOT_Y - 0.15 * k
        a.cushion?.scale.setScalar(Math.max(0.0001, 1 - k))
        if (k >= 1) { dropActor(a); continue }
      } else {
        // 자리가 바뀌면 부드럽게 옮김
        const p = a.root.position
        p.x = approach(p.x, a.target.x, dt, 0.12); p.z = approach(p.z, a.target.z, dt, 0.12)
        a.root.rotation.y = angleStep(a.root.rotation.y, a.target.yaw, dt)
        if (a.cushion) {
          const yaw = a.root.rotation.y
          a.cushion.position.set(p.x + Math.sin(yaw) * CUSHION_AHEAD, 0, p.z + Math.cos(yaw) * CUSHION_AHEAD); a.cushion.rotation.y = yaw
        }
        // 모션 스케줄: drink 는 10초 간격, talk 는 사이에 한 번
        if (a.pending && a.pending()) {
          a.pending = null
          if (a.wantTalk) { a.wantTalk = false; talkNow(a) }
        }
        if (!a.pending) {
          if (a.t >= a.nextDrink) { playOverlay(a, a.aDrink, 'mole_drink'); a.nextDrink += DRINK_EVERY; a.nextTalk = a.t + talkDelayAfterDrink(Math.random()) }
          else if (a.t >= a.nextTalk) { playOverlay(a, a.aTalk, 'mole_sit_talk'); a.nextTalk = Infinity }
        }
      }
      a.mixer.update(dt)
      a.dress?.update(dt, a.overlay === 'mole_drink' ? 'mole_drink' : 'mole_sit_idle', false)
    }
  }

  const loop = startLoop(el, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      applyCamera(camNow)
    },
    frame(dt) {
      update(dt)
      placeTags()
      renderer.render(scene, camera)
    },
    busy: () => true,
    maxFps: () => lowFps,
    downgrade(nq) { renderer.setPixelRatio(nq.pixelRatio) },
  }, q)

  // ---- 불러오기 ----
  Promise.all([loadGlb(shellUrl), loadGlb(baseUrl), loadGlb(decoUrl), loadGlb(shelvesUrl), loadMoleGltf(), loadAccessories().catch(() => undefined)])
    .then(([shell, base, deco, shelves, mole, acc]) => {
      if (dead) return
      moleG = mole; accG = acc
      // 벽: 땅굴 방 01 기본 벽지(단색 #F0B47A × 구운 음영). 껍데기 원본 재질은 허옇게 나와서 핸드오프 사진(복숭아색)과 다름
      const shellRoot = shell.scene.clone()
      applyWallpaper(shellRoot, null)
      scene.add(shellRoot)
      const baseRoot = base.scene.clone()
      const byName = (n: string) => baseRoot.getObjectByName(n)
      // 원탁: 핸드오프 2번 표 (지름 1.224m, 윗면 0.354m). 찻주전자·찻잔은 부모 크기를 상쇄
      byName('round_table')?.scale.set(1.7, 0.9, 1.7)
      for (const n of ['round_table_teapot', 'round_table_cup_01', 'round_table_cup_02']) byName(n)?.scale.set(0.7353, 1.3889, 0.7353)
      const ky = byName('cushion_yellow'), ks = byName('cushion_sky')
      if (ky && ks) {
        // 자리마다 복제할 원본 (원래 자리 방석은 숨김). 방석 색 구분용 kind
        const y = ky.clone(true), s = ks.clone(true)
        y.userData.kind = 'yellow'; s.userData.kind = 'sky'
        cushions = { yellow: y, sky: s }
      }
      for (const n of ['cushion_yellow', 'cushion_sky', 'cabinet_low', 'floor_lamp', 'floor_plant_big', 'rug_front_oval', 'rug_right_small']) { const o = byName(n); if (o) o.visible = false }
      markShadows(baseRoot)
      scene.add(baseRoot)
      const decoRoot = deco.scene.clone(), shelfRoot = shelves.scene.clone()
      markShadows(decoRoot); markShadows(shelfRoot)
      scene.add(decoRoot, shelfRoot)
      emptyMark = buildEmptyMark()
      applyCamera(CAM_PRESETS.close)
      // 처음 앉는 사람은 연출 없이 바로 (pop 은 중간에 들어오고 나갈 때만)
      seated = initialSeated({ ids: members.map((m) => m.id), meId: meIdOf(), spoke })
      const now = performance.now()
      seated.forEach((id) => { seatedAt[id] = now - SEAT_MIN_MS }) // 처음 앉은 사람은 바로 교체 대상이 될 수 있음 (최소 5초는 새로 앉은 사람만)
      sync({ initial: true })
      for (const a of actors.values()) { a.state = 'idle'; a.root.visible = true; a.root.scale.setScalar(1); if (a.cushion) { a.cushion.visible = true; a.cushion.scale.setScalar(1) } }
      loop.ready()
      ready = true
      init.onReady()
    })
    .catch((e) => console.warn('[3D] 채팅방을 못 불러왔어요', e))

  return {
    setMembers(m, sp) { if (ready) setMembersInner(m, sp); else { members = m; spoke = { ...sp } } },
    speak(id) { if (ready) speakInner(id) },
    seated: () => [...seated],
    dispose() {
      dead = true
      el.removeEventListener('click', onClick as EventListener)
      el.removeEventListener('pointermove', onMove)
      loop.stop()
      for (const a of [...actors.values()]) dropActor(a)
      hitGeo.dispose(); hitMat.dispose()
      // 방·두더지 지오메트리와 재질은 glb 캐시라 남김
      destroyRenderer(renderer)
    },
  }
}
